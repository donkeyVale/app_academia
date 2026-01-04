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
    const { userId } = body || {};

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Falta userId.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    // Respetar notifications_enabled
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    if ((profile as any)?.notifications_enabled === false) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'notifications_disabled' });
    }

    const { data: subsAll, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const subs = (subsAll ?? []) as SubscriptionRow[];
    if (subs.length === 0) {
      return NextResponse.json({ error: 'No hay suscripciones registradas para el usuario.' }, { status: 404 });
    }

    const payload = JSON.stringify({
      title: 'Feliz cumpleaños',
      body: 'Feliz cumpleaños! Te deseamos un gran día de parte de AGENDO!!',
      data: { url: '/schedule' },
    });

    // In-app notification
    try {
      await createInAppNotifications([
        {
          user_id: userId,
          type: 'birthday_student',
          title: 'Feliz cumpleaños',
          body: 'Feliz cumpleaños! Te deseamos un gran día de parte de AGENDO!!',
          data: { url: '/schedule' },
        },
      ]);
    } catch (e) {
      console.error('Error creando notificación in-app (birthday-student)', e);
    }

    const results = await sendToSubs(subs, payload);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok, total: subs.length });
  } catch (e: any) {
    console.error('Error en /api/push/birthday-student', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de cumpleaños' }, { status: 500 });
  }
}
