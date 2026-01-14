import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? body.userId : null;

    if (!userId) {
      return NextResponse.json({ error: 'Falta userId.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    const payload = JSON.stringify({
      title: 'Notificación de prueba',
      body: 'Si ves esto, las notificaciones push están funcionando.',
      data: { url: '/' },
    });

    let oneSignalId: string | null = null;
    let oneSignalError: string | null = null;

    // OneSignal (Android/iOS) - best effort
    try {
      const res = await sendOneSignalNotification({
        externalUserIds: [userId],
        title: 'Notificación de prueba',
        body: 'Si ves esto, las notificaciones push están funcionando.',
        launchUrl: 'agendo://schedule',
        data: { url: '/schedule' },
      });
      oneSignalId = (res as any)?.id ?? null;
    } catch (e) {
      try {
        oneSignalError = (e as any)?.message ?? String(e);
      } catch {
        oneSignalError = 'unknown_error';
      }
      console.error('Error enviando OneSignal send-test', e);
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, skipped: 'no_push_subscriptions', onesignal_id: oneSignalId, onesignal_error: oneSignalError });
    }

    const results = await Promise.allSettled(
      subs.map((sub: any) =>
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

    return NextResponse.json({ ok, total: subs.length, onesignal_id: oneSignalId, onesignal_error: oneSignalError });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de prueba' }, { status: 500 });
  }
}
