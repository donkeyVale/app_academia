import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { coachId, studentIds, dateIso } = body || {};

    if (!coachId && (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0)) {
      return NextResponse.json({ error: 'Sin destinatarios para la clase.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    const userIds = new Set<string>();

    // Coach -> user_id
    if (coachId) {
      const { data: coachRow, error: coachErr } = await supabaseAdmin
        .from('coaches')
        .select('user_id')
        .eq('id', coachId)
        .maybeSingle();
      if (coachErr) {
        console.error('Error obteniendo coach.user_id', coachErr.message);
      } else if (coachRow?.user_id) {
        userIds.add(coachRow.user_id as string);
      }
    }

    // Students -> user_id
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      const { data: studentsRows, error: studErr } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .in('id', studentIds);
      if (studErr) {
        console.error('Error obteniendo students.user_id', studErr.message);
      } else {
        for (const row of studentsRows ?? []) {
          if (row.user_id) userIds.add(row.user_id as string);
        }
      }
    }

    if (userIds.size === 0) {
      return NextResponse.json({ error: 'No se encontraron usuarios para esta clase.' }, { status: 404 });
    }

    // Respetar preferencia de notificaciones en profiles.notifications_enabled
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .in('id', Array.from(userIds));

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const allowedUserIds = new Set<string>();
    for (const row of profiles ?? []) {
      const enabled = (row as any).notifications_enabled;
      // Si es true o null/undefined, dejamos pasar; solo filtramos cuando es false explícito
      if (enabled === false) continue;
      allowedUserIds.add((row as any).id as string);
    }

    if (allowedUserIds.size === 0) {
      return NextResponse.json({ error: 'Ningún usuario tiene activadas las notificaciones para esta clase.' }, { status: 404 });
    }

    // Buscar suscripciones push solo de usuarios con notificaciones habilitadas
    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(allowedUserIds));

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'No hay suscripciones registradas para los usuarios objetivo.' }, { status: 404 });
    }

    let when = '';
    try {
      if (dateIso) {
        const d = new Date(dateIso);
        when = d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Asuncion' });
      }
    } catch {
      // ignorar errores de formato
    }

    const bodyText = when
      ? `Tenés una nueva clase agendada el ${when}.`
      : 'Tenés una nueva clase agendada.';

    const payload = JSON.stringify({
      title: 'Nueva clase creada',
      body: bodyText,
      data: { url: '/schedule' },
    });

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
    console.error('Error en /api/push/class-created', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificaciones de clase creada' }, { status: 500 });
  }
}
