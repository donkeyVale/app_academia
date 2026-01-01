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

export async function POST(req: NextRequest) {
  try {
    if (isUnauthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const debug = req.nextUrl.searchParams.get('debug') === '1';

    const now = new Date();
    const classReminderWindowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const windowEndIso = classReminderWindowEnd.toISOString();

    const { data: bookings, error: bookingsErr } = await supabaseAdmin
      .from('bookings')
      .select('student_id, class_id, class_sessions!inner(date)')
      .eq('status', 'reserved')
      .gt('class_sessions.date', nowIso)
      .lte('class_sessions.date', windowEndIso);

    if (bookingsErr) {
      return NextResponse.json({ error: bookingsErr.message }, { status: 500 });
    }

    // Elegir la clase más próxima por alumno
    const firstByStudent = new Map<string, { studentId: string; classId: string; dateIso: string }>();
    for (const b of (bookings ?? []) as any[]) {
      const studentId = b?.student_id as string | undefined;
      const classId = b?.class_id as string | undefined;
      const dateIso = (b?.class_sessions as any)?.date as string | undefined;
      if (!studentId || !classId || !dateIso) continue;

      const existing = firstByStudent.get(studentId);
      if (!existing) {
        firstByStudent.set(studentId, { studentId, classId, dateIso });
        continue;
      }

      if (new Date(dateIso).getTime() < new Date(existing.dateIso).getTime()) {
        firstByStudent.set(studentId, { studentId, classId, dateIso });
      }
    }

    const classReminderTargets = Array.from(firstByStudent.values());
    if (classReminderTargets.length === 0) {
      return NextResponse.json({
        ok: true,
        checked: 0,
        notifiedRequests: 0,
        debug: debug
          ? {
              classReminderWindow: { nowIso, windowEndIso },
              pushResponses: [],
            }
          : undefined,
      });
    }

    const origin = req.nextUrl.origin;
    const results = await Promise.allSettled(
      classReminderTargets.map((t) =>
        fetch(`${origin}/api/push/class-reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: t.studentId,
            classId: t.classId,
            dateIso: t.dateIso,
          }),
        }),
      ),
    );

    const pushResponses = await Promise.all(
      results.map(async (r, idx) => {
        const studentId = classReminderTargets[idx]?.studentId ?? 'unknown';
        if (r.status !== 'fulfilled') {
          return { studentId, status: null as number | null, body: debug ? { error: 'fetch_failed' } : undefined };
        }
        const res = r.value;
        if (!debug) {
          return { studentId, status: res.status, body: undefined };
        }
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        return { studentId, status: res.status, body: json };
      }),
    );

    const okNotified = pushResponses.filter((r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300).length;

    return NextResponse.json({
      ok: true,
      checked: classReminderTargets.length,
      notifiedRequests: okNotified,
      debug: debug
        ? {
            classReminderWindow: { nowIso, windowEndIso },
            pushResponses,
          }
        : undefined,
    });
  } catch (e: any) {
    console.error('Error en /api/cron/class-reminder', e);
    return NextResponse.json({ error: e?.message ?? 'Error ejecutando cron de recordatorio de clase' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
