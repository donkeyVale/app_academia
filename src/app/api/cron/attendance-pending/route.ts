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

function getUtcRangeForLocalDayUtcMinus3(y: number, m: number, d: number) {
  // Local midnight (UTC-3) == UTC 03:00
  const startUtcMs = Date.UTC(y, m, d, 3, 0, 0, 0);
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
    const { startIso, endIso } = getUtcRangeForLocalDayUtcMinus3(y, m, d);

    // 1) Buscar clases de hoy con asistencia pendiente
    const { data: clsRows, error: clsErr } = await supabaseAdmin
      .from('class_sessions')
      .select('id, date, court_id, coach_id, courts!inner(location_id), attendance_pending, status')
      .gte('date', startIso)
      .lte('date', endIso)
      .eq('attendance_pending', true)
      .neq('status', 'cancelled');

    if (clsErr) {
      return NextResponse.json({ error: clsErr.message }, { status: 500 });
    }

    const rows = (clsRows ?? []) as any[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, academies: 0, notifiedRequests: 0, debug: debug ? { dayRange: { startIso, endIso } } : undefined });
    }

    // 2) Mapear location -> academy (multiacademia)
    const locationIds = Array.from(
      new Set(
        rows
          .map((r) => (r?.courts as any)?.location_id as string | undefined)
          .filter((v): v is string => !!v),
      ),
    );

    if (locationIds.length === 0) {
      return NextResponse.json({ ok: true, checked: rows.length, academies: 0, notifiedRequests: 0, debug: debug ? { reason: 'no_location_ids' } : undefined });
    }

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

    const academies = Array.from(
      new Set(
        rows
          .map((r) => {
            const loc = (r?.courts as any)?.location_id as string | undefined;
            return loc ? academyByLocation.get(loc) : undefined;
          })
          .filter((v): v is string => !!v),
      ),
    );

    if (academies.length === 0) {
      return NextResponse.json({ ok: true, checked: rows.length, academies: 0, notifiedRequests: 0, debug: debug ? { reason: 'no_academies_after_mapping' } : undefined });
    }

    // 3) Resolver coaches (coach_id -> user_id) y agrupar por academy
    const coachIds = Array.from(
      new Set(
        rows
          .map((r) => (r?.coach_id as string | null | undefined) ?? null)
          .filter((v): v is string => !!v),
      ),
    );

    const coachUserIdByCoachId = new Map<string, string>();
    if (coachIds.length > 0) {
      const { data: coachRows, error: coachErr } = await supabaseAdmin
        .from('coaches')
        .select('id,user_id')
        .in('id', coachIds);

      if (coachErr) {
        return NextResponse.json({ error: coachErr.message }, { status: 500 });
      }

      for (const r of (coachRows ?? []) as any[]) {
        const cid = r?.id as string | undefined;
        const uid = r?.user_id as string | undefined;
        if (cid && uid) coachUserIdByCoachId.set(cid, uid);
      }
    }

    const coachUserIdsByAcademy = new Map<string, Set<string>>();
    for (const r of rows) {
      const loc = (r?.courts as any)?.location_id as string | undefined;
      const academyId = loc ? academyByLocation.get(loc) : undefined;
      if (!academyId) continue;
      const coachId = (r?.coach_id as string | null | undefined) ?? null;
      if (!coachId) continue;
      const coachUserId = coachUserIdByCoachId.get(coachId);
      if (!coachUserId) continue;
      if (!coachUserIdsByAcademy.has(academyId)) coachUserIdsByAcademy.set(academyId, new Set());
      coachUserIdsByAcademy.get(academyId)!.add(coachUserId);
    }

    // 4) Notificar por academia (no dedupeamos acá porque la frecuencia la controla el cron cada 6h)
    const origin = req.nextUrl.origin;
    const bodyText = 'Hay clases aun sin marcar asistencia, revisa la agenda';

    const settled = await Promise.allSettled(
      academies.map((academyId) =>
        fetch(`${origin}/api/push/attendance-pending`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ academyId, bodyText, coachUserIds: Array.from(coachUserIdsByAcademy.get(academyId) ?? []) }),
        }),
      ),
    );

    const pushResponses = await Promise.all(
      settled.map(async (r, idx) => {
        const academyId = academies[idx] ?? 'unknown';
        if (r.status !== 'fulfilled') {
          return { academyId, status: null as number | null, body: debug ? { error: 'fetch_failed' } : undefined };
        }
        const res = r.value;
        if (!debug) {
          return { academyId, status: res.status, body: undefined };
        }
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        return { academyId, status: res.status, body: json };
      }),
    );

    const okNotified = pushResponses.filter((r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300).length;

    return NextResponse.json({
      ok: true,
      checked: rows.length,
      academies: academies.length,
      notifiedRequests: okNotified,
      debug: debug ? { dayRange: { startIso, endIso }, academies, pushResponses } : undefined,
    });
  } catch (e: any) {
    console.error('Error en /api/cron/attendance-pending', e);
    return NextResponse.json({ error: e?.message ?? 'Error ejecutando cron de asistencia pendiente' }, { status: 500 });
  }
}
