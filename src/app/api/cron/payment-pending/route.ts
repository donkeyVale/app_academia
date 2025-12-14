import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

function isUnauthorized(req: NextRequest) {
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

    const now = new Date();
    const threshold = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // 1) Candidatos: planes asignados hace >= 12h
    const { data: plans, error: spErr } = await supabaseAdmin
      .from('student_plans')
      .select('id, student_id, academy_id, purchased_at')
      .lte('purchased_at', threshold.toISOString());

    if (spErr) {
      return NextResponse.json({ error: spErr.message }, { status: 500 });
    }

    const rows = (plans ?? []) as any[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0 });
    }

    const planIds = rows.map((r) => r.id as string).filter(Boolean);

    // 2) Planes que ya tienen pago pagado
    const { data: payRows, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('student_plan_id,status')
      .in('student_plan_id', planIds);

    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 500 });
    }

    const hasPaid = new Set<string>();
    for (const p of (payRows ?? []) as any[]) {
      if (p?.status !== 'pagado') continue;
      if (p?.student_plan_id) hasPaid.add(p.student_plan_id as string);
    }

    // 3) Filtrar solo los que NO tienen pagos pagados
    const pending = rows.filter((r) => {
      const id = r.id as string;
      if (!id) return false;
      return !hasPaid.has(id);
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, checked: rows.length, notified: 0 });
    }

    // 4) Anti-spam: registrar notificación única por plan
    // Requiere tabla public.notification_events con unique(student_plan_id,event_type)
    const eventType = 'payment_pending_12h';

    // Bulk insert (si ya existe por unique, lo ignoramos vía upsert)
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('notification_events')
      .upsert(
        pending
          .filter((r) => r.academy_id)
          .map((r) => ({
            academy_id: r.academy_id,
            student_plan_id: r.id,
            student_id: r.student_id,
            event_type: eventType,
          })),
        { onConflict: 'student_plan_id,event_type' },
      )
      .select('student_plan_id');

    if (insErr) {
      return NextResponse.json(
        {
          error: insErr.message,
          hint: 'Falta crear la tabla notification_events (ver SQL sugerido).',
        },
        { status: 500 },
      );
    }

    const insertedIds = new Set<string>(((inserted ?? []) as any[]).map((r) => r.student_plan_id as string));

    // 5) Enviar push solo a los que se insertaron recién (evita repetir)
    const origin = req.nextUrl.origin;
    const results = await Promise.allSettled(
      pending
        .filter((r) => insertedIds.has(r.id as string))
        .map((r) =>
          fetch(`${origin}/api/push/payment-pending`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              academyId: r.academy_id,
              studentId: r.student_id,
              studentPlanId: r.id,
            }),
          }),
        ),
    );

    const notified = results.filter((r) => r.status === 'fulfilled').length;

    return NextResponse.json({ ok: true, checked: rows.length, pending: pending.length, notified });
  } catch (e: any) {
    console.error('Error en /api/cron/payment-pending', e);
    return NextResponse.json({ error: e?.message ?? 'Error ejecutando cron de pago pendiente' }, { status: 500 });
  }
}
