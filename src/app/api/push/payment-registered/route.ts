import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

function formatGs(amount: number) {
  try {
    return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(Math.round(amount));
  }
}

function formatWhen(paymentDate?: string | null) {
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

    // Destinatarios: admins asignados a esta academia
    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, role, is_active')
      .eq('academy_id', academyId)
      .eq('is_active', true);

    if (uaErr) {
      return NextResponse.json({ error: uaErr.message }, { status: 500 });
    }

    const adminUserIds = Array.from(
      new Set(
        ((uaRows ?? []) as any[])
          .filter((r) => r.user_id && (r.role === 'admin' || r.role === 'super_admin'))
          .map((r) => r.user_id as string),
      ),
    );

    if (adminUserIds.length === 0) {
      return NextResponse.json({ error: 'No hay admins asignados a esta academia.' }, { status: 404 });
    }

    // Respetar preferencia de notificaciones en profiles.notifications_enabled
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .in('id', adminUserIds);

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const allowedUserIds = new Set<string>();
    for (const row of profiles ?? []) {
      const enabled = (row as any).notifications_enabled;
      if (enabled === false) continue;
      allowedUserIds.add((row as any).id as string);
    }

    if (allowedUserIds.size === 0) {
      return NextResponse.json({ error: 'Ningún admin tiene activadas las notificaciones.' }, { status: 404 });
    }

    // Enriquecer con nombre del alumno si es posible
    let studentName: string | null = null;
    let studentUserId: string | null = null;
    try {
      const { data: studentRow, error: stErr } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('id', studentId)
        .maybeSingle();
      if (!stErr && studentRow?.user_id) {
        studentUserId = studentRow.user_id as unknown as string;
        const { data: prof, error: pErr } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', studentRow.user_id)
          .maybeSingle();
        if (!pErr) studentName = (prof as any)?.full_name ?? null;
      }
    } catch {
      // ignorar
    }

    // Plan + saldo
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

    const paidBeforeThis = totalPaid - amountNum;
    const hadBalanceBefore = finalPrice != null ? Math.max(0, Number(finalPrice) - paidBeforeThis) : null;

    const isFirstAndFull = finalPrice != null && paidBeforeThis <= 0 && amountNum >= Number(finalPrice);
    const completesBalance = finalPrice != null && hadBalanceBefore != null && hadBalanceBefore > 0 && balance === 0 && !isFirstAndFull;

    let title = 'Pago registrado';
    let bodyText = '';
    const who = studentName ? `${studentName}: ` : '';

    if (isFirstAndFull) {
      bodyText = `${who}Pago total registrado (${amountText}) por ${planName}. (${whenText})`;
    } else if (completesBalance) {
      title = 'Cuenta cancelada';
      bodyText = `${who}Pago final registrado (${amountText}) por ${planName}. Cuenta cancelada. (${whenText})`;
    } else {
      const balanceText = balance != null ? `Saldo: Gs. ${formatGs(balance)}` : 'Saldo actualizado.';
      bodyText = `${who}Pago parcial registrado (${amountText}) por ${planName}. ${balanceText}. (${whenText})`;
    }

    const payload = JSON.stringify({
      title,
      body: bodyText,
      data: { url: '/finance' },
    });

    // In-app notifications (admins)
    try {
      await createInAppNotifications(
        Array.from(allowedUserIds).map((userId) => ({
          user_id: userId,
          type: title === 'Cuenta cancelada' ? 'payment_completed_admin' : 'payment_registered_admin',
          title,
          body: bodyText,
          data: { url: '/finance', academyId, studentId, studentPlanId, amount: amountNum, currency, paymentDate },
        }))
      );
    } catch (e) {
      console.error('Error creando notificación in-app (payment-registered)', e);
    }

    // OneSignal (Android/iOS) - best effort
    try {
      await sendOneSignalNotification({
        externalUserIds: Array.from(allowedUserIds),
        title,
        body: bodyText,
        launchUrl: 'agendo://finance',
        data: { url: '/finance', academyId, studentId, studentPlanId, amount: amountNum, currency, paymentDate },
      });
    } catch (e) {
      console.error('Error enviando OneSignal payment-registered', e);
    }

    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(allowedUserIds));

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'no_push_subscriptions' });
    }

    const results = await Promise.allSettled(
      (subs as any[]).map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        ),
      ),
    );

    // Limpiar endpoints muertos (410/404) para mejorar confiabilidad
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
    return NextResponse.json({ ok, total: subs.length });
  } catch (e: any) {
    console.error('Error en /api/push/payment-registered', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de pago registrado' }, { status: 500 });
  }
}
