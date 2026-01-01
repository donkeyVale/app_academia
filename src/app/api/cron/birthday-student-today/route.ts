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

function parseBirthDate(value: any): { d: number; m: number; y: number } | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();

  // DD/MM/YYYY
  {
    const m = /^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/.exec(s);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yy = Number(m[3]);
      if (!dd || !mm || !yy) return null;
      if (dd < 1 || dd > 31) return null;
      if (mm < 1 || mm > 12) return null;
      return { d: dd, m: mm, y: yy };
    }
  }

  // YYYY-MM-DD
  {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const yy = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      if (!dd || !mm || !yy) return null;
      if (dd < 1 || dd > 31) return null;
      if (mm < 1 || mm > 12) return null;
      return { d: dd, m: mm, y: yy };
    }
  }

  return null;
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
    const { y, m, d } = getLocalYmdUtcMinus3(now);
    const eventDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 1) Candidatos: alumnos activos en al menos 1 academia
    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, academy_id, role, is_active')
      .eq('role', 'student')
      .eq('is_active', true);

    if (uaErr) {
      return NextResponse.json({ error: uaErr.message }, { status: 500 });
    }

    const academyByUser = new Map<string, string>();
    const studentUserIds = new Set<string>();
    for (const r of (uaRows ?? []) as any[]) {
      const uid = r?.user_id as string | undefined;
      const aid = r?.academy_id as string | undefined;
      if (!uid) continue;
      studentUserIds.add(uid);
      if (aid && !academyByUser.has(uid)) academyByUser.set(uid, aid);
    }

    if (studentUserIds.size === 0) {
      return NextResponse.json({ ok: true, checked: 0, inserted: 0, notifiedRequests: 0 });
    }

    // 2) Leer users desde Auth (birth_date está en user_metadata)
    const authUsers = await listAllAuthUsers();

    const birthdayUserIds: string[] = [];
    for (const u of authUsers as any[]) {
      const uid = u?.id as string | undefined;
      if (!uid || !studentUserIds.has(uid)) continue;

      const birthDate = parseBirthDate(u?.user_metadata?.birth_date);
      if (!birthDate) continue;
      if (birthDate.d === d && birthDate.m === m) {
        birthdayUserIds.push(uid);
      }
    }

    if (birthdayUserIds.length === 0) {
      return NextResponse.json({
        ok: true,
        checked: studentUserIds.size,
        birthday: 0,
        inserted: 0,
        notifiedRequests: 0,
        debug: debug ? { eventDate } : undefined,
      });
    }

    // 3) Anti-spam: registrar evento por usuario por día
    const eventType = 'birthday_student_today';
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('notification_events')
      .upsert(
        birthdayUserIds.map((userId) => ({
          academy_id: academyByUser.get(userId) ?? null,
          user_id: userId,
          event_type: eventType,
          event_date: eventDate,
        })),
        { onConflict: 'user_id,event_type,event_date' },
      )
      .select('user_id');

    if (insErr) {
      return NextResponse.json(
        {
          error: insErr.message,
          hint: 'Falta aplicar el SQL notification-events-birthday.sql para agregar user_id/event_date + índices únicos.',
        },
        { status: 500 },
      );
    }

    const insertedIds = new Set<string>(((inserted ?? []) as any[]).map((r) => r.user_id as string));
    const toNotify = birthdayUserIds.filter((id) => insertedIds.has(id));

    const origin = req.nextUrl.origin;
    const results = await Promise.allSettled(
      toNotify.map((userId) =>
        fetch(`${origin}/api/push/birthday-student`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }),
      ),
    );

    const pushResponses = await Promise.all(
      results.map(async (r, idx) => {
        const userId = toNotify[idx] ?? 'unknown';
        if (r.status !== 'fulfilled') {
          return { userId, status: null as number | null, body: debug ? { error: 'fetch_failed' } : undefined };
        }
        const res = r.value;
        if (!debug) {
          return { userId, status: res.status, body: undefined };
        }
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        return { userId, status: res.status, body: json };
      }),
    );

    const okNotified = pushResponses.filter((r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300).length;

    return NextResponse.json({
      ok: true,
      checked: studentUserIds.size,
      birthday: birthdayUserIds.length,
      inserted: insertedIds.size,
      notifiedRequests: okNotified,
      debug: debug ? { eventDate, pushResponses } : undefined,
    });
  } catch (e: any) {
    console.error('Error en /api/cron/birthday-student-today', e);
    return NextResponse.json({ error: e?.message ?? 'Error ejecutando cron de cumpleaños (alumno)' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
