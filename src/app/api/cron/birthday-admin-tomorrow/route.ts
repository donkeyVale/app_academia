import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-service';

function isUnauthorized(req: NextRequest) {
  const vercelCron = req.headers.get('x-vercel-cron');
  if (vercelCron && vercelCron !== '0' && vercelCron.toLowerCase() !== 'false') {
    return false;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const querySecret = req.nextUrl.searchParams.get('secret');
  if (querySecret) {
    return querySecret !== secret;
  }

  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    return token !== secret;
  }

  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret) return headerSecret !== secret;

  return true;
}

function getLocalYmdUtcMinus3(now: Date) {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
}

function addDaysLocalUtcMinus3(y: number, m: number, d: number, addDays: number) {
  // Representamos el "día local" como UTC (sin tz) y sumamos días en ms.
  const base = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  const dt = new Date(base + addDays * 24 * 60 * 60 * 1000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function parseBirthDateDdMmYyyy(value: any): { d: number; m: number; y: number } | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  const m = /^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  if (!dd || !mm || !yy) return null;
  if (dd < 1 || dd > 31) return null;
  if (mm < 1 || mm > 12) return null;
  return { d: dd, m: mm, y: yy };
}

async function listAllAuthUsers() {
  const users: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = (data as any)?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

export async function POST(req: NextRequest) {
  try {
    if (isUnauthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const debug = req.nextUrl.searchParams.get('debug') === '1';

    const now = new Date();
    const today = getLocalYmdUtcMinus3(now);
    const tomorrow = addDaysLocalUtcMinus3(today.y, today.m, today.d, 1);
    const eventDate = `${tomorrow.y}-${String(tomorrow.m).padStart(2, '0')}-${String(tomorrow.d).padStart(2, '0')}`;

    // 1) Mapear alumnos activos por academia
    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, academy_id, role, is_active')
      .eq('role', 'student')
      .eq('is_active', true);

    if (uaErr) {
      return NextResponse.json({ error: uaErr.message }, { status: 500 });
    }

    const academyUsers = new Map<string, Set<string>>();
    const allStudentUserIds = new Set<string>();

    for (const r of (uaRows ?? []) as any[]) {
      const uid = r?.user_id as string | undefined;
      const aid = r?.academy_id as string | undefined;
      if (!uid || !aid) continue;
      allStudentUserIds.add(uid);
      if (!academyUsers.has(aid)) academyUsers.set(aid, new Set());
      academyUsers.get(aid)!.add(uid);
    }

    if (academyUsers.size === 0) {
      return NextResponse.json({ ok: true, academies: 0, candidates: 0, inserted: 0, notifiedRequests: 0 });
    }

    // 2) Leer users desde Auth y filtrar los que cumplen mañana
    const authUsers = await listAllAuthUsers();
    const birthdayTomorrowUserIds = new Set<string>();

    for (const u of authUsers as any[]) {
      const uid = u?.id as string | undefined;
      if (!uid || !allStudentUserIds.has(uid)) continue;

      const birthDate = parseBirthDateDdMmYyyy(u?.user_metadata?.birth_date);
      if (!birthDate) continue;
      if (birthDate.d === tomorrow.d && birthDate.m === tomorrow.m) {
        birthdayTomorrowUserIds.add(uid);
      }
    }

    if (birthdayTomorrowUserIds.size === 0) {
      return NextResponse.json({
        ok: true,
        academies: academyUsers.size,
        candidates: 0,
        inserted: 0,
        notifiedRequests: 0,
        debug: debug ? { eventDate } : undefined,
      });
    }

    // 3) Nombres (para armar el mensaje)
    const { data: profRows, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(birthdayTomorrowUserIds));

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const nameByUser = new Map<string, string>();
    for (const r of (profRows ?? []) as any[]) {
      const id = r?.id as string | undefined;
      const nm = (r?.full_name as string | null | undefined) ?? null;
      if (id && nm) nameByUser.set(id, nm);
    }

    const origin = req.nextUrl.origin;
    const eventType = 'birthday_admin_tomorrow';

    // 4) Por academia, si hay cumpleañeros mañana, dedupe por academia+día
    const settled = await Promise.allSettled(
      Array.from(academyUsers.entries()).map(async ([academyId, userSet]) => {
        const names = Array.from(userSet)
          .filter((uid) => birthdayTomorrowUserIds.has(uid))
          .map((uid) => nameByUser.get(uid) ?? 'Alumno')
          .filter(Boolean);

        if (names.length === 0) {
          return { academyId, skipped: 'no_birthdays', inserted: false, push: null as any };
        }

        const { data: insertedRows, error: insErr } = await supabaseAdmin
          .from('notification_events')
          .upsert(
            [
              {
                academy_id: academyId,
                user_id: null,
                event_type: eventType,
                event_date: eventDate,
              },
            ],
            { onConflict: 'academy_id,event_type,event_date' },
          )
          .select('academy_id');

        if (insErr) {
          return { academyId, error: insErr.message };
        }

        const didInsert = ((insertedRows ?? []) as any[]).length > 0;
        if (!didInsert) {
          return { academyId, skipped: 'already_sent', inserted: false, push: null as any };
        }

        const res = await fetch(`${origin}/api/push/birthday-admins`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ academyId, names }),
        });

        let json: any = null;
        if (debug) {
          try {
            json = await res.json();
          } catch {
            json = null;
          }
        }

        return { academyId, inserted: true, push: { status: res.status, body: json } };
      }),
    );

    const results = settled.map((s) => (s.status === 'fulfilled' ? s.value : { error: 'fetch_failed' }));
    const insertedCount = results.filter((r: any) => r?.inserted).length;
    const notifiedCount = results.filter((r: any) => r?.push?.status >= 200 && r?.push?.status < 300).length;

    return NextResponse.json({
      ok: true,
      academies: academyUsers.size,
      candidates: birthdayTomorrowUserIds.size,
      inserted: insertedCount,
      notifiedRequests: notifiedCount,
      debug: debug ? { eventDate, results } : undefined,
    });
  } catch (e: any) {
    console.error('Error en /api/cron/birthday-admin-tomorrow', e);
    return NextResponse.json({ error: e?.message ?? 'Error ejecutando cron de cumpleaños (admins)' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
