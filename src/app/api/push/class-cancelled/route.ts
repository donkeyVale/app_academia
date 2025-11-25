import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, coachId, dateIso } = body || {};

    if (!classId) {
      return NextResponse.json({ error: 'Falta classId.' }, { status: 400 });
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

    // Students reservados en esta clase -> student_id -> user_id
    const { data: bookings, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('student_id')
      .eq('class_id', classId);
    if (bErr) {
      console.error('Error obteniendo bookings para clase cancelada', bErr.message);
    } else if (bookings && bookings.length > 0) {
      const studentIds = Array.from(new Set((bookings as any[]).map((b) => b.student_id as string)));
      if (studentIds.length) {
        const { data: studentsRows, error: studErr } = await supabaseAdmin
          .from('students')
          .select('id, user_id')
          .in('id', studentIds);
        if (studErr) {
          console.error('Error obteniendo students.user_id para clase cancelada', studErr.message);
        } else {
          for (const row of studentsRows ?? []) {
            if (row.user_id) userIds.add(row.user_id as string);
          }
        }
      }
    }

    if (userIds.size === 0) {
      return NextResponse.json({ error: 'No se encontraron usuarios con push para esta clase cancelada.' }, { status: 404 });
    }

    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(userIds));

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
        when = d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });
      }
    } catch {
      // ignorar errores de formato
    }

    const bodyText = when
      ? `Tu clase del ${when} fue cancelada.`
      : 'Tu clase fue cancelada.';

    const payload = JSON.stringify({
      title: 'Clase cancelada',
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

    const ok = results.filter((r) => r.status === 'fulfilled').length;

    return NextResponse.json({ ok, total: subs.length });
  } catch (e: any) {
    console.error('Error en /api/push/class-cancelled', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificaciones de clase cancelada' }, { status: 500 });
  }
}
