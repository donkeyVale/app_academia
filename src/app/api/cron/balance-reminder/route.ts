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
    const force = req.nextUrl.searchParams.get('force') === '1';

    const now = new Date();
    const threshold = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // 1) Candidatos: planes asignados hace >= 12h (para evitar notificar apenas se asigna)
    const { data: plans, error: spErr } = await supabaseAdmin
      .from('student_plans')
      .select('id, student_id, academy_id, purchased_at, remaining_classes, base_price, final_price')
      .lte('purchased_at', force ? now.toISOString() : threshold.toISOString());

    if (spErr) {
      return NextResponse.json({ error: spErr.message }, { status: 500 });
    }

    const rows = (plans ?? []) as any[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0, debug: debug ? { force } : undefined });
    }

    // 2) Para cada plan: contar usos + calcular restantes reales y saldo
    const evaluated: {
      id: string;
      student_id: string;
      academy_id: string | null;
      remaining_real: number;
      balance: number;
    }[] = [];

    for (const r of rows) {
      const planId = r?.id as string | undefined;
      const studentId = r?.student_id as string | undefined;
      const academyId = (r?.academy_id as string | null | undefined) ?? null;
      const remainingBase = Number(r?.remaining_classes ?? 0);

      if (!planId || !studentId) continue;

      const basePrice = r?.base_price as number | null | undefined;
      const finalPrice = (r?.final_price as number | null | undefined) ?? basePrice ?? null;

      if (finalPrice == null) continue;

      const { count: usedCount, error: usageErr } = await supabaseAdmin
        .from('plan_usages')
        .select('id', { count: 'exact', head: true })
        .eq('student_plan_id', planId)
        .eq('student_id', studentId);

      if (usageErr) {
        return NextResponse.json({ error: usageErr.message }, { status: 500 });
      }

      const used = Number(usedCount ?? 0);
      const remainingReal = Math.max(0, remainingBase - used);

      const { data: payRows, error: payErr } = await supabaseAdmin
        .from('payments')
        .select('amount,status')
        .eq('student_plan_id', planId);

      if (payErr) {
        return NextResponse.json({ error: payErr.message }, { status: 500 });
      }

      const totalPaid = (payRows ?? []).reduce((acc: number, p: any) => {
        if (p?.status !== 'pagado') return acc;
        const v = Number(p?.amount ?? 0);
        return acc + (Number.isFinite(v) ? v : 0);
      }, 0);

      const balance = Math.max(0, Number(finalPrice) - totalPaid);

      evaluated.push({
        id: planId,
        student_id: studentId,
        academy_id: academyId,
        remaining_real: remainingReal,
        balance,
      });
    }

    const pending = evaluated.filter((r) => r.remaining_real === 2 && r.balance > 0);

    if (pending.length === 0) {
      return NextResponse.json({
        ok: true,
        checked: rows.length,
        pending: 0,
        notified: 0,
        debug: debug
          ? {
              force,
              candidates: rows.length,
              candidatePlanIds: rows.slice(0, 20).map((r) => r.id),
            }
          : undefined,
      });
    }

    // 3) Anti-spam
    const eventType = 'balance_pending_2_classes';
    const pendingWithAcademy = pending.filter((r) => r.academy_id);

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('notification_events')
      .upsert(
        pendingWithAcademy.map((r) => ({
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

    const origin = req.nextUrl.origin;
    const toNotify = pendingWithAcademy.filter((r) => insertedIds.has(r.id));

    const results = await Promise.allSettled(
      toNotify.map((r) =>
        fetch(`${origin}/api/push/balance-reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academyId: r.academy_id,
            studentId: r.student_id,
            studentPlanId: r.id,
            remainingClasses: r.remaining_real,
            balance: r.balance,
          }),
        }),
      ),
    );

    const pushResponses = await Promise.all(
      results.map(async (r, idx) => {
        const studentPlanId = toNotify[idx]?.id ?? 'unknown';
        if (r.status !== 'fulfilled') {
          return { studentPlanId, status: null as number | null, body: debug ? { error: 'fetch_failed' } : undefined };
        }
        const res = r.value;
        if (!debug) {
          return { studentPlanId, status: res.status, body: undefined };
        }
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        return { studentPlanId, status: res.status, body: json };
      }),
    );

    const okNotified = pushResponses.filter((r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300).length;

    return NextResponse.json({
      ok: true,
      checked: rows.length,
      pending: pending.length,
      pendingMissingAcademy: pending.length - pendingWithAcademy.length,
      inserted: insertedIds.size,
      notifiedRequests: okNotified,
      debug: debug
        ? {
            force,
            candidates: rows.length,
            candidatePlanIds: rows.slice(0, 20).map((r) => r.id),
            pendingPlanIds: pending.slice(0, 20).map((r) => r.id),
            insertedPlanIds: Array.from(insertedIds).slice(0, 20),
            pushResponses,
          }
        : undefined,
    });
  } catch (e: any) {
    console.error('Error en /api/cron/balance-reminder', e);
    return NextResponse.json({ error: e?.message ?? 'Error ejecutando cron de saldo pendiente' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
