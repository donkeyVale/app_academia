import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';

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
    const { academyId, names } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    const list = Array.isArray(names) ? names.filter((n: any) => typeof n === 'string' && n.trim()) : [];

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    // Admins activos de la academia
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

    if (adminUserIds.length === 0) {
      return NextResponse.json({ error: 'No hay admins asignados a esta academia.' }, { status: 404 });
    }

    // Respetar notifications_enabled
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .in('id', adminUserIds);

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    const allowedUserIds = new Set<string>();
    for (const row of profiles ?? []) {
      const enabled = (row as any).notifications_enabled;
      if (enabled === false) continue;
      allowedUserIds.add((row as any).id as string);
    }

    if (allowedUserIds.size === 0) {
      return NextResponse.json({ error: 'Ningún admin tiene activadas las notificaciones.' }, { status: 404 });
    }

    const shown = list.slice(0, 3);
    const extra = Math.max(0, list.length - shown.length);
    const who = shown.join(', ');

    const bodyText =
      list.length === 0
        ? 'Mañana hay cumpleaños en la academia. Revisá la lista de alumnos.'
        : extra > 0
          ? `Mañana es el cumpleaños de ${who} y ${extra} más. Revisá la lista de alumnos.`
          : `Mañana es el cumpleaños de ${who}. Revisá la lista de alumnos.`;

    const payload = JSON.stringify({
      title: 'Cumpleaños',
      body: bodyText,
      data: { url: '/students' },
    });

    const { data: subsAll, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(allowedUserIds));

    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const subs = (subsAll ?? []) as SubscriptionRow[];
    if (subs.length === 0) {
      return NextResponse.json({ error: 'No hay suscripciones registradas para admins.' }, { status: 404 });
    }

    const results = await sendToSubs(subs, payload);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok, total: subs.length });
  } catch (e: any) {
    console.error('Error en /api/push/birthday-admins', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de cumpleaños a admins' }, { status: 500 });
  }
}
