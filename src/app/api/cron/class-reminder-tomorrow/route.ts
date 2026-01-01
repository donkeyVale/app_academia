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
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
}

function getUtcRangeForLocalDayUtcMinus3(y: number, m: number, d: number, addDays: number) {
  // Local midnight (UTC-3) == UTC 03:00
  const baseStartUtcMs = Date.UTC(y, m, d, 3, 0, 0, 0);
  const startUtcMs = baseStartUtcMs + addDays * 24 * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;
  return { startIso: new Date(startUtcMs).toISOString(), endIso: new Date(endUtcMs).toISOString() };
}

export async function POST(req: NextRequest) {
  try {
    if (isUnauthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const debug = req.nextUrl.searchParams.get('debug') === '1';

    const now = new Date();
    const { y, m, d } = getLocalYmdUtcMinus3(now);
    const { startIso, endIso } = getUtcRangeForLocalDayUtcMinus3(y, m, d, 1);

    const { data: bookings, error: bookingsErr } = await supabaseAdmin
      .from('bookings')
      .select('student_id, class_id, class_sessions!inner(date,court_id,courts!inner(location_id))')
      .eq('status', 'reserved')
      .gte('class_sessions.date', startIso)
      .lte('class_sessions.date', endIso);

    if (bookingsErr) {
      return NextResponse.json({ error: bookingsErr.message }, { status: 500 });
    }

    const rows = (bookings ?? []) as any[];
    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: 'tomorrow',
        checked: 0,
        candidates: 0,
        inserted: 0,
        notifiedRequests: 0,
        debug: debug ? { dayRange: { startIso, endIso } } : undefined,
      });
    }

    // 1) Resolver academyId por locationId usando academy_locations
    const locationIds = Array.from(
      new Set(
        rows
          .map((r) => (r?.class_sessions as any)?.courts?.location_id as string | undefined)
          .filter((v): v is string => !!v),
      ),
    );

    const { data: alRows, error: alErr } = await supabaseAdmin
      .from('academy_locations')
      .select('academy_id, location_id')
      .in('location_id', locationIds);

    if (alErr) {
      return NextResponse.json({ error: alErr.message }, { status: 500 });
    }

    const academyByLocation = new Map<string, string>();
    for (const r of (alRows ?? []) as any[]) {
      const locId = r?.location_id as string | undefined;
      const acadId = r?.academy_id as string | undefined;
      if (locId && acadId && !academyByLocation.has(locId)) academyByLocation.set(locId, acadId);
    }

    // 2) Resolver student -> user_id
    const studentIds = Array.from(new Set(rows.map((r) => r?.student_id as string | undefined).filter(Boolean))) as string[];
    const { data: stRows, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id,user_id')
      .in('id', studentIds);

    if (stErr) {
      return NextResponse.json({ error: stErr.message }, { status: 500 });
    }

    const userIdByStudent = new Map<string, string>();
    for (const r of (stRows ?? []) as any[]) {
      const sid = r?.id as string | undefined;
      const uid = r?.user_id as string | undefined;
      if (sid && uid) userIdByStudent.set(sid, uid);
    }

    // 3) Construir candidatos con academyId y filtrar membresía activa
    const candidates = rows
      .map((r) => {
        const studentId = r?.student_id as string | undefined;
        const classId = r?.class_id as string | undefined;
        const dateIso = (r?.class_sessions as any)?.date as string | undefined;
        const locationId = (r?.class_sessions as any)?.courts?.location_id as string | undefined;
        const academyId = locationId ? academyByLocation.get(locationId) : undefined;
        const userId = studentId ? userIdByStudent.get(studentId) : undefined;
        if (!studentId || !classId || !dateIso || !academyId || !userId) return null;
        return { studentId, userId, academyId, classId, dateIso };
      })
      .filter(Boolean) as { studentId: string; userId: string; academyId: string; classId: string; dateIso: string }[];

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: 'tomorrow',
        checked: 0,
        candidates: rows.length,
        inserted: 0,
        notifiedRequests: 0,
        debug: debug ? { dayRange: { startIso, endIso }, reason: 'no_candidates_after_mapping' } : undefined,
      });
    }

    const academyIds = Array.from(new Set(candidates.map((c) => c.academyId)));
    const userIds = Array.from(new Set(candidates.map((c) => c.userId)));

    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, academy_id, is_active')
      .in('user_id', userIds)
      .in('academy_id', academyIds)
      .eq('is_active', true);

    if (uaErr) {
      return NextResponse.json({ error: uaErr.message }, { status: 500 });
    }

    const activePairs = new Set<string>();
    for (const r of (uaRows ?? []) as any[]) {
      const uid = r?.user_id as string | undefined;
      const aid = r?.academy_id as string | undefined;
      if (uid && aid) activePairs.add(`${uid}::${aid}`);
    }

    const activeCandidates = candidates.filter((c) => activePairs.has(`${c.userId}::${c.academyId}`));
    if (activeCandidates.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: 'tomorrow',
        checked: 0,
        candidates: candidates.length,
        inserted: 0,
        notifiedRequests: 0,
        debug: debug ? { dayRange: { startIso, endIso }, reason: 'no_active_memberships' } : undefined,
      });
    }

    // 4) Elegir la clase más próxima por alumno
    const firstByUser = new Map<string, { studentId: string; userId: string; academyId: string; classId: string; dateIso: string }>();
    for (const c of activeCandidates) {
      const existing = firstByUser.get(c.userId);
      if (!existing) {
        firstByUser.set(c.userId, c);
        continue;
      }
      if (new Date(c.dateIso).getTime() < new Date(existing.dateIso).getTime()) {
        firstByUser.set(c.userId, c);
      }
    }

    const targets = Array.from(firstByUser.values());

    // 5) Anti-spam por alumno+clase+tipo
    const eventType = 'class_reminder_tomorrow';
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('notification_events')
      .upsert(
        targets.map((t) => ({
          academy_id: t.academyId,
          student_id: t.studentId,
          class_id: t.classId,
          event_type: eventType,
        })),
        { onConflict: 'student_id,class_id,event_type' },
      )
      .select('student_id,class_id');

    if (insErr) {
      return NextResponse.json(
        {
          error: insErr.message,
          hint: 'Falta aplicar el SQL para agregar class_id + unique index en notification_events.',
        },
        { status: 500 },
      );
    }

    const insertedKeys = new Set<string>(((inserted ?? []) as any[]).map((r) => `${r.student_id}::${r.class_id}`));
    const toNotify = targets.filter((t) => insertedKeys.has(`${t.studentId}::${t.classId}`));

    const origin = req.nextUrl.origin;
    const bodyText = 'Tenés clases agendadas para mañana, revisá tu agenda!!';

    const results = await Promise.allSettled(
      toNotify.map((t) =>
        fetch(`${origin}/api/push/class-reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: t.studentId, classId: t.classId, dateIso: t.dateIso, bodyText }),
        }),
      ),
    );

    const pushResponses = await Promise.all(
      results.map(async (r, idx) => {
        const userId = toNotify[idx]?.userId ?? 'unknown';
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
      mode: 'tomorrow',
      checked: targets.length,
      candidates: rows.length,
      inserted: insertedKeys.size,
      notifiedRequests: okNotified,
      debug: debug ? { dayRange: { startIso, endIso }, pushResponses } : undefined,
    });
  } catch (e: any) {
    console.error('Error en /api/cron/class-reminder-tomorrow', e);
    return NextResponse.json({ error: e?.message ?? 'Error ejecutando cron de recordatorio de clase (mañana)' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
