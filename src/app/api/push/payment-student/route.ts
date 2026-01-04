import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';

function formatGs(amount: number) {
  try {
    return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(Math.round(amount));
  }
}

function formatWhen(paymentDate?: string | null) {
  // En UI el pago se registra con payment_date tipo YYYY-MM-DD.
  // Le agregamos hora actual para que sea útil en la notificación.
  try {
    if (paymentDate) {
      const now = new Date();
      const [y, m, d] = String(paymentDate).split('-').map((x) => Number(x));
      if (y && m && d) {
        const dt = new Date(Date.UTC(y, m - 1, d, now.getUTCHours(), now.getUTCMinutes(), 0));
        return dt.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Asuncion' });
      }
    }
    return new Date().toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Asuncion' });
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { academyId, studentId, studentPlanId, amount, currency = 'PYG', paymentDate } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json({ error: 'Falta studentId.' }, { status: 400 });
    }

    if (!studentPlanId || typeof studentPlanId !== 'string') {
      return NextResponse.json({ error: 'Falta studentPlanId.' }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    // studentId -> user_id
    const { data: studentRow, error: stErr } = await supabaseAdmin
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .maybeSingle();

    if (stErr) {
      return NextResponse.json({ error: stErr.message }, { status: 500 });
    }

    const studentUserId = (studentRow as any)?.user_id as string | undefined;
    if (!studentUserId) {
      return NextResponse.json({ error: 'El alumno no tiene user_id asociado.' }, { status: 404 });
    }

    // Multiacademia: asegurar que el usuario pertenece a la academia
    {
      const { data: uaRow, error: uaErr } = await supabaseAdmin
        .from('user_academies')
        .select('user_id')
        .eq('academy_id', academyId)
        .eq('user_id', studentUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (uaErr) {
        return NextResponse.json({ error: uaErr.message }, { status: 500 });
      }

      if (!uaRow) {
        return NextResponse.json({ error: 'El alumno no pertenece a esta academia.' }, { status: 404 });
      }
    }

    // Respetar preferencia notifications_enabled
    const { data: profRow, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .eq('id', studentUserId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    if ((profRow as any)?.notifications_enabled === false) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'notifications_disabled' });
    }

    // Obtener info del plan y precio final
    const { data: spRow, error: spErr } = await supabaseAdmin
      .from('student_plans')
      .select('id, base_price, final_price, plans(name)')
      .eq('id', studentPlanId)
      .maybeSingle();

    if (spErr) {
      return NextResponse.json({ error: spErr.message }, { status: 500 });
    }

    if (!spRow) {
      return NextResponse.json({ error: 'No se encontró el plan del alumno.' }, { status: 404 });
    }

    const planName = ((spRow as any)?.plans?.name as string | undefined) ?? 'tu plan';
    const basePrice = (spRow as any)?.base_price as number | null | undefined;
    const finalPrice = ((spRow as any)?.final_price as number | null | undefined) ?? basePrice ?? null;

    // Total pagado del plan (solo pagos pagados)
    const { data: payRows, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('amount,status')
      .eq('student_plan_id', studentPlanId);

    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 500 });
    }

    const totalPaid = (payRows ?? []).reduce((acc: number, p: any) => {
      if (p?.status !== 'pagado') return acc;
      const v = Number(p?.amount ?? 0);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);

    const balance = finalPrice != null ? Math.max(0, Number(finalPrice) - totalPaid) : null;

    const whenText = formatWhen(paymentDate);
    const amountText = currency === 'PYG' ? `Gs. ${formatGs(amountNum)}` : `${amountNum} ${currency}`;

    // Clasificación del pago
    const paidBeforeThis = totalPaid - amountNum;
    const hadBalanceBefore = finalPrice != null ? Math.max(0, Number(finalPrice) - paidBeforeThis) : null;

    const isFirstAndFull = finalPrice != null && paidBeforeThis <= 0 && amountNum >= Number(finalPrice);
    const completesBalance = finalPrice != null && hadBalanceBefore != null && hadBalanceBefore > 0 && balance === 0 && !isFirstAndFull;

    let title = 'Pago registrado';
    let bodyText = '';

    if (isFirstAndFull) {
      bodyText = `Se registró un pago total de ${amountText} por ${planName}. (${whenText})`;
    } else if (completesBalance) {
      title = 'Cuenta cancelada';
      bodyText = `Se registró el pago final de ${amountText} por ${planName}. Tu cuenta ya está cancelada. (${whenText})`;
    } else {
      const balanceText = balance != null ? `Saldo: Gs. ${formatGs(balance)}` : 'Saldo actualizado.';
      bodyText = `Se registró un pago parcial de ${amountText} por ${planName}. Recordá cancelar tu cuenta. ${balanceText}. (${whenText})`;
    }

    const payload = JSON.stringify({
      title,
      body: bodyText,
      data: { url: '/finance' },
    });

    // In-app notification (student)
    let inAppInserted = 0;
    try {
      const res = await createInAppNotifications([
        {
          user_id: studentUserId,
          type: title === 'Cuenta cancelada' ? 'payment_completed_student' : 'payment_registered_student',
          title,
          body: bodyText,
          data: { url: '/finance', academyId, studentId, studentPlanId, amount: amountNum, currency, paymentDate },
        },
      ]);
      inAppInserted = res.inserted;
    } catch (e) {
      console.error('Error creando notificación in-app (payment-student)', e);
    }

    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', studentUserId);

    if (subsErr) {
      return NextResponse.json({ error: subsErr.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, in_app: inAppInserted, skipped: 'no_push_subscriptions', balance, totalPaid, finalPrice });
    }

    const results = await Promise.allSettled(
      (subs as any[]).map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        ),
      ),
    );

    // Limpiar endpoints muertos (410/404)
    await Promise.allSettled(
      results.map((r, idx) => {
        if (r.status !== 'rejected') return Promise.resolve();
        const reason: any = (r as any).reason;
        const statusCode = Number(reason?.statusCode ?? reason?.status);
        if (statusCode !== 404 && statusCode !== 410) return Promise.resolve();
        const endpoint = (subs as any[])[idx]?.endpoint as string | undefined;
        if (!endpoint) return Promise.resolve();
        return supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok, total: subs.length, in_app: inAppInserted, balance, totalPaid, finalPrice });
  } catch (e: any) {
    console.error('Error en /api/push/payment-student', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de pago al alumno' }, { status: 500 });
  }
}
