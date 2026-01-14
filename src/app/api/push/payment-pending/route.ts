import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

function formatWhen(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-PY', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Asuncion',
    });
  } catch {
    return '';
  }
}

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendToSubs(subs: SubscriptionRow[], payload: string) {
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  );

  await Promise.allSettled(
    results.map((r, idx) => {
      if (r.status !== 'rejected') return Promise.resolve();
      const reason: any = (r as any).reason;
      const statusCode = Number(reason?.statusCode ?? reason?.status);
      if (statusCode !== 404 && statusCode !== 410) return Promise.resolve();
      const endpoint = subs[idx]?.endpoint;
      if (!endpoint) return Promise.resolve();
      return supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }),
  );

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { academyId, studentId, studentPlanId } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json({ error: 'Falta studentId.' }, { status: 400 });
    }

    if (!studentPlanId || typeof studentPlanId !== 'string') {
      return NextResponse.json({ error: 'Falta studentPlanId.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    // Student -> user_id
    const { data: studentRow, error: stErr } = await supabaseAdmin
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .maybeSingle();

    if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

    const studentUserId = (studentRow as any)?.user_id as string | undefined;
    if (!studentUserId) {
      return NextResponse.json({ error: 'El alumno no tiene user_id asociado.' }, { status: 404 });
    }

    // Multiacademia: asegurar que el alumno pertenece a la academia
    {
      const { data: uaRow, error: uaErr } = await supabaseAdmin
        .from('user_academies')
        .select('user_id')
        .eq('academy_id', academyId)
        .eq('user_id', studentUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (uaErr) return NextResponse.json({ error: uaErr.message }, { status: 500 });
      if (!uaRow) return NextResponse.json({ error: 'El alumno no pertenece a esta academia.' }, { status: 404 });
    }

    // Student name
    let studentName: string | null = null;
    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', studentUserId)
        .maybeSingle();
      studentName = ((prof as any)?.full_name as string | undefined) ?? null;
    } catch {
      // ignore
    }

    // Plan name + purchased_at
    const { data: spRow, error: spErr } = await supabaseAdmin
      .from('student_plans')
      .select('id, purchased_at, plans(name)')
      .eq('id', studentPlanId)
      .maybeSingle();

    if (spErr) return NextResponse.json({ error: spErr.message }, { status: 500 });
    if (!spRow) return NextResponse.json({ error: 'No se encontró el plan del alumno.' }, { status: 404 });

    const planName = ((spRow as any)?.plans?.name as string | undefined) ?? 'tu plan';
    const purchasedAt = ((spRow as any)?.purchased_at as string | undefined) ?? null;
    const purchasedAtText = formatWhen(purchasedAt);

    // Admins
    const { data: uaRows, error: uaErr2 } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, role')
      .eq('academy_id', academyId)
      .eq('is_active', true);

    if (uaErr2) return NextResponse.json({ error: uaErr2.message }, { status: 500 });

    const adminUserIds = Array.from(
      new Set(
        ((uaRows ?? []) as any[])
          .filter((r) => r.user_id && (r.role === 'admin' || r.role === 'super_admin'))
          .map((r) => r.user_id as string),
      ),
    );

    // Respetar notifications_enabled
    const allUserIds = Array.from(new Set([studentUserId, ...adminUserIds]));
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .in('id', allUserIds);

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    const enabledSet = new Set<string>();
    for (const row of profiles ?? []) {
      if ((row as any)?.notifications_enabled === false) continue;
      enabledSet.add((row as any).id as string);
    }

    const allowedStudent = enabledSet.has(studentUserId);
    const allowedAdminIds = adminUserIds.filter((id) => enabledSet.has(id));

    const targetUserIds = new Set<string>();
    if (allowedStudent) targetUserIds.add(studentUserId);
    for (const id of allowedAdminIds) targetUserIds.add(id);

    if (targetUserIds.size === 0) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'notifications_disabled' });
    }

    const { data: subsAll, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(targetUserIds));

    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const subs = (subsAll ?? []) as SubscriptionRow[];
    if (subs.length === 0) {
      return NextResponse.json({ error: 'No hay suscripciones registradas para los usuarios objetivo.' }, { status: 404 });
    }

    const studentPayload = JSON.stringify({
      title: 'Pago pendiente',
      body: `Se asignó el plan “${planName}” y aún no se registró el pago. Si ya pagaste, avisá al admin para que lo registre.`,
      data: { url: '/finance' },
    });

    const who = studentName ? `${studentName}: ` : '';
    const adminPayload = JSON.stringify({
      title: 'Pago pendiente',
      body: `${who}Plan “${planName}” asignado${purchasedAtText ? ` el ${purchasedAtText}` : ''} y aún no se registró ningún pago.`,
      data: { url: '/finance' },
    });

    // In-app notifications
    try {
      const inAppRows: any[] = [];
      if (allowedStudent) {
        inAppRows.push({
          user_id: studentUserId,
          type: 'payment_pending_student',
          title: 'Pago pendiente',
          body: `Se asignó el plan “${planName}” y aún no se registró el pago. Si ya pagaste, avisá al admin para que lo registre.`,
          data: { url: '/finance', academyId, studentId, studentPlanId },
        });
      }
      for (const adminUserId of allowedAdminIds) {
        inAppRows.push({
          user_id: adminUserId,
          type: 'payment_pending_admin',
          title: 'Pago pendiente',
          body: `${who}Plan “${planName}” asignado${purchasedAtText ? ` el ${purchasedAtText}` : ''} y aún no se registró ningún pago.`,
          data: { url: '/finance', academyId, studentId, studentPlanId },
        });
      }
      await createInAppNotifications(inAppRows);
    } catch (e) {
      console.error('Error creando notificación in-app (payment-pending)', e);
    }

    // OneSignal (Android/iOS) - best effort
    try {
      if (allowedStudent) {
        await sendOneSignalNotification({
          externalUserIds: [studentUserId],
          title: 'Pago pendiente',
          body: `Se asignó el plan “${planName}” y aún no se registró el pago. Si ya pagaste, avisá al admin para que lo registre.`,
          launchUrl: 'agendo://finance',
          data: { url: '/finance', academyId, studentId, studentPlanId },
        });
      }
    } catch (e) {
      console.error('Error enviando OneSignal payment-pending (student)', e);
    }

    try {
      if (allowedAdminIds.length > 0) {
        await sendOneSignalNotification({
          externalUserIds: allowedAdminIds,
          title: 'Pago pendiente',
          body: `${who}Plan “${planName}” asignado${purchasedAtText ? ` el ${purchasedAtText}` : ''} y aún no se registró ningún pago.`,
          launchUrl: 'agendo://finance',
          data: { url: '/finance', academyId, studentId, studentPlanId },
        });
      }
    } catch (e) {
      console.error('Error enviando OneSignal payment-pending (admins)', e);
    }

    const studentSubs = allowedStudent ? subs.filter((s) => s.user_id === studentUserId) : [];
    const adminSubs = subs.filter((s) => allowedAdminIds.includes(s.user_id));

    const resultsStudent = studentSubs.length > 0 ? await sendToSubs(studentSubs, studentPayload) : [];
    const resultsAdmin = adminSubs.length > 0 ? await sendToSubs(adminSubs, adminPayload) : [];

    const results = [...resultsStudent, ...resultsAdmin];
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok, total: studentSubs.length + adminSubs.length });
  } catch (e: any) {
    console.error('Error en /api/push/payment-pending', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificaciones de pago pendiente' }, { status: 500 });
  }
}
//ajuste