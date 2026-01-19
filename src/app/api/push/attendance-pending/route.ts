import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

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
    const { academyId, bodyText, coachUserIds } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (bodyText != null && typeof bodyText !== 'string') {
      return NextResponse.json({ error: 'bodyText inválido.' }, { status: 400 });
    }

    if (coachUserIds != null && !Array.isArray(coachUserIds)) {
      return NextResponse.json({ error: 'coachUserIds inválido.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, role, is_active')
      .eq('academy_id', academyId)
      .eq('is_active', true);

    if (uaErr) return NextResponse.json({ error: uaErr.message }, { status: 500 });

    const adminUserIds = Array.from(
      new Set(
        ((uaRows ?? []) as any[])
          .filter((r) => r.user_id && (r.role === 'admin' || r.role === 'super_admin'))
          .map((r) => r.user_id as string),
      ),
    );

    const coachUserIdsAllowedInAcademy = new Set<string>();
    for (const r of (uaRows ?? []) as any[]) {
      if (!r?.user_id) continue;
      if (r?.role !== 'coach') continue;
      coachUserIdsAllowedInAcademy.add(r.user_id as string);
    }

    const requestedCoachUserIds = Array.isArray(coachUserIds)
      ? coachUserIds.filter((id: any) => typeof id === 'string' && id.trim())
      : [];

    const filteredCoachTargets = requestedCoachUserIds.filter((id: string) => coachUserIdsAllowedInAcademy.has(id));

    const staffUserIds = Array.from(new Set([...adminUserIds, ...filteredCoachTargets]));
    if (staffUserIds.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'no_targets' }, { status: 200 });
    }

    // Respetar notifications_enabled
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .in('id', staffUserIds);

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    const allowedUserIds = new Set<string>();
    for (const row of profiles ?? []) {
      if ((row as any)?.notifications_enabled === false) continue;
      allowedUserIds.add((row as any).id as string);
    }

    const targets = staffUserIds.filter((id) => allowedUserIds.has(id));
    if (targets.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'notifications_disabled' }, { status: 200 });
    }

    const finalBody = bodyText ?? 'Hay clases aun sin marcar asistencia, revisa la agenda';

    // OneSignal (Android/iOS) - best effort
    try {
      await sendOneSignalNotification({
        externalUserIds: targets,
        title: 'Asistencia pendiente',
        body: finalBody,
        launchUrl: 'agendo://schedule',
        data: { url: '/schedule?scope=today', academyId },
      });
    } catch (e) {
      console.error('Error enviando OneSignal attendance-pending', e);
    }

    const { data: subsAll, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targets);

    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const subs = (subsAll ?? []) as SubscriptionRow[];

    const payload = JSON.stringify({
      title: 'Asistencia pendiente',
      body: finalBody,
      data: { url: '/schedule?scope=today', academyId },
    });

    // In-app notifications (staff)
    let inAppInserted = 0;
    try {
      const res = await createInAppNotifications(
        targets.map((userId) => ({
          user_id: userId,
          type: 'attendance_pending',
          title: 'Asistencia pendiente',
          body: finalBody,
          data: { url: '/schedule?scope=today', academyId },
        })),
      );
      inAppInserted = res.inserted;
    } catch (e) {
      console.error('Error creando notificación in-app (attendance-pending)', e);
    }

    if (subs.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, in_app: inAppInserted, skipped: 'no_push_subscriptions' });
    }

    const results = await sendToSubs(subs, payload);
    const ok = results.filter((r) => r.status === 'fulfilled').length;

    return NextResponse.json({ ok, total: subs.length, in_app: inAppInserted, staff: targets.length });
  } catch (e: any) {
    console.error('Error en /api/push/attendance-pending', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de asistencia pendiente' }, { status: 500 });
  }
}
