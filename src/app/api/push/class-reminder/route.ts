import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';

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
    const { studentId, classId, dateIso, bodyText } = body || {};

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json({ error: 'Falta studentId.' }, { status: 400 });
    }

    if (!classId || typeof classId !== 'string') {
      return NextResponse.json({ error: 'Falta classId.' }, { status: 400 });
    }

    if (!dateIso || typeof dateIso !== 'string') {
      return NextResponse.json({ error: 'Falta dateIso.' }, { status: 400 });
    }

    if (bodyText != null && typeof bodyText !== 'string') {
      return NextResponse.json({ error: 'bodyText inválido.' }, { status: 400 });
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

    // Respetar notifications_enabled
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .eq('id', studentUserId)
      .maybeSingle();

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    if ((profile as any)?.notifications_enabled === false) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'notifications_disabled' });
    }

    const { data: subsAll, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', studentUserId);

    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const subs = (subsAll ?? []) as SubscriptionRow[];

    const payload = JSON.stringify({
      title: 'Recordatorio',
      body: bodyText ?? 'Recordá que tenés clases agendadas, revisá tu agenda!!',
      data: { url: '/schedule', classId, dateIso },
    });

    // In-app notification (student)
    let inAppInserted = 0;
    try {
      const res = await createInAppNotifications([
        {
          user_id: studentUserId,
          type: 'class_reminder',
          title: 'Recordatorio',
          body: bodyText ?? 'Recordá que tenés clases agendadas, revisá tu agenda!!',
          data: { url: '/schedule', classId, dateIso },
        },
      ]);
      inAppInserted = res.inserted;
    } catch (e) {
      console.error('Error creando notificación in-app (class-reminder)', e);
    }

    if (subs.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, in_app: inAppInserted, skipped: 'no_push_subscriptions' });
    }

    const results = await sendToSubs(subs, payload);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok, total: subs.length, in_app: inAppInserted });
  } catch (e: any) {
    console.error('Error en /api/push/class-reminder', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando recordatorio de clase' }, { status: 500 });
  }
}
