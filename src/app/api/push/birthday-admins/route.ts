import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

function getLocalYmdUtcMinus3(now: Date) {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
}

function addDaysLocalUtcMinus3(y: number, m: number, d: number, addDays: number) {
  const base = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  const dt = new Date(base + addDays * 24 * 60 * 60 * 1000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function parseBirthDate(value: any): { d: number; m: number; y: number } | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();

  {
    const m = /^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/.exec(s);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yy = Number(m[3]);
      if (!dd || !mm || !yy) return null;
      if (dd < 1 || dd > 31) return null;
      if (mm < 1 || mm > 12) return null;
      return { d: dd, m: mm, y: yy };
    }
  }

  {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const yy = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      if (!dd || !mm || !yy) return null;
      if (dd < 1 || dd > 31) return null;
      if (mm < 1 || mm > 12) return null;
      return { d: dd, m: mm, y: yy };
    }
  }

  return null;
}

async function listAllAuthUsers() {
  const users: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = (data as any)?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function computeBirthdayNamesTomorrowForAcademy(academyId: string): Promise<string[]> {
  const now = new Date();
  const today = getLocalYmdUtcMinus3(now);
  const tomorrow = addDaysLocalUtcMinus3(today.y, today.m, today.d, 1);

  const { data: uaRows, error: uaErr } = await supabaseAdmin
    .from('user_academies')
    .select('user_id, role, is_active')
    .eq('academy_id', academyId)
    .eq('role', 'student')
    .eq('is_active', true);
  if (uaErr) throw uaErr;

  const studentUserIds = new Set<string>();
  for (const r of (uaRows ?? []) as any[]) {
    const uid = r?.user_id as string | undefined;
    if (uid) studentUserIds.add(uid);
  }
  if (studentUserIds.size === 0) return [];

  const authUsers = await listAllAuthUsers();
  const birthdayTomorrowUserIds: string[] = [];
  for (const u of authUsers as any[]) {
    const uid = u?.id as string | undefined;
    if (!uid || !studentUserIds.has(uid)) continue;
    const birthDate = parseBirthDate(u?.user_metadata?.birth_date);
    if (!birthDate) continue;
    if (birthDate.d === tomorrow.d && birthDate.m === tomorrow.m) {
      birthdayTomorrowUserIds.push(uid);
    }
  }

  if (birthdayTomorrowUserIds.length === 0) return [];

  const { data: profRows, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .in('id', birthdayTomorrowUserIds);
  if (profErr) throw profErr;

  const nameByUser = new Map<string, string>();
  for (const r of (profRows ?? []) as any[]) {
    const id = r?.id as string | undefined;
    const nm = (r?.full_name as string | null | undefined) ?? null;
    if (id && nm) nameByUser.set(id, nm);
  }

  return birthdayTomorrowUserIds.map((uid) => nameByUser.get(uid) ?? 'Alumno');
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
    const { academyId, names } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    let list = Array.isArray(names) ? names.filter((n: any) => typeof n === 'string' && n.trim()) : [];
    if (list.length === 0) {
      try {
        list = await computeBirthdayNamesTomorrowForAcademy(academyId);
      } catch (e) {
        console.error('Error calculando cumpleañeros de mañana (birthday-admins)', e);
      }
    }

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

    // In-app notifications
    let inAppInserted = 0;
    try {
      const res = await createInAppNotifications(
        Array.from(allowedUserIds).map((userId) => ({
          user_id: userId,
          type: 'birthday_admins',
          title: 'Cumpleaños',
          body: bodyText,
          data: { url: '/students', academyId },
        }))
      );
      inAppInserted = res.inserted;
    } catch (e) {
      console.error('Error creando notificación in-app (birthday-admins)', e);
    }

    // OneSignal (Android/iOS) - best effort
    try {
      await sendOneSignalNotification({
        externalUserIds: Array.from(allowedUserIds),
        title: 'Cumpleaños',
        body: bodyText,
        launchUrl: 'agendo://',
        data: { url: '/', academyId },
      });
    } catch (e) {
      console.error('Error enviando OneSignal birthday-admins', e);
    }

    const { data: subsAll, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(allowedUserIds));

    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const subs = (subsAll ?? []) as SubscriptionRow[];
    if (subs.length === 0) {
      return NextResponse.json({ ok: 0, total: 0, in_app: inAppInserted, skipped: 'no_push_subscriptions' });
    }

    const results = await sendToSubs(subs, payload);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok, total: subs.length, in_app: inAppInserted });
  } catch (e: any) {
    console.error('Error en /api/push/birthday-admins', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de cumpleaños a admins' }, { status: 500 });
  }
}
