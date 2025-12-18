import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      classId,
      coachId,
      studentIds,
      dateIso,
      academyId,
      cancelledByRole,
      cancelledByStudentId,
      cancelledByCoachId,
      cancelledByUserId,
    } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (!classId) {
      return NextResponse.json({ error: 'Falta classId.' }, { status: 400 });
    }

    if (!cancelledByRole || typeof cancelledByRole !== 'string') {
      return NextResponse.json({ error: 'Falta cancelledByRole.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    const coachUserIdSet = new Set<string>();
    if (coachId) {
      const { data: coachRow, error: coachErr } = await supabaseAdmin
        .from('coaches')
        .select('user_id')
        .eq('id', coachId)
        .maybeSingle();
      if (coachErr) {
        console.error('Error obteniendo coach.user_id', coachErr.message);
      } else if (coachRow?.user_id) {
        coachUserIdSet.add(coachRow.user_id as string);
      }
    }

    const studentUserIds = new Set<string>();
    const uniqueStudentIds =
      studentIds && Array.isArray(studentIds) && studentIds.length > 0
        ? Array.from(new Set(studentIds as string[]))
        : [];

    if (uniqueStudentIds.length > 0) {
      const { data: studentsRows, error: studErr } = await supabaseAdmin
        .from('students')
        .select('id, user_id')
        .in('id', uniqueStudentIds);
      if (studErr) {
        console.error('Error obteniendo students.user_id para clase cancelada', studErr.message);
      } else {
        for (const row of studentsRows ?? []) {
          if ((row as any)?.user_id) studentUserIds.add((row as any).user_id as string);
        }
      }
    }

    // Admins de la academia
    const academyAdminUserIds = new Set<string>();
    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, role')
      .eq('academy_id', academyId);

    if (uaErr) {
      return NextResponse.json({ error: uaErr.message }, { status: 500 });
    }

    for (const row of (uaRows ?? []) as any[]) {
      if (!row.user_id) continue;
      if (row.role === 'admin' || row.role === 'super_admin') {
        academyAdminUserIds.add(row.user_id as string);
      }
    }

    // Destinatarios según quién canceló
    const targetUserIds = new Set<string>();
    if (cancelledByRole === 'student') {
      for (const id of coachUserIdSet) targetUserIds.add(id);
      for (const id of academyAdminUserIds) targetUserIds.add(id);
    } else if (cancelledByRole === 'coach') {
      for (const id of studentUserIds) targetUserIds.add(id);
      for (const id of academyAdminUserIds) targetUserIds.add(id);
    } else if (cancelledByRole === 'admin' || cancelledByRole === 'super_admin') {
      for (const id of coachUserIdSet) targetUserIds.add(id);
      for (const id of studentUserIds) targetUserIds.add(id);
      for (const id of academyAdminUserIds) targetUserIds.add(id);

      // Evitar notificar al mismo admin que ejecutó la acción
      if (cancelledByUserId && typeof cancelledByUserId === 'string') {
        targetUserIds.delete(cancelledByUserId);
      }
    } else {
      // fallback conservador
      for (const id of coachUserIdSet) targetUserIds.add(id);
      for (const id of studentUserIds) targetUserIds.add(id);
      for (const id of academyAdminUserIds) targetUserIds.add(id);
    }

    if (targetUserIds.size === 0) {
      return NextResponse.json({ error: 'No se encontraron destinatarios para esta cancelación.' }, { status: 404 });
    }

    // Respetar preferencia de notificaciones en profiles.notifications_enabled
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .in('id', Array.from(targetUserIds));

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const allowedUserIds = new Set<string>();
    for (const row of profiles ?? []) {
      const enabled = (row as any).notifications_enabled;
      if (enabled === false) continue;
      allowedUserIds.add((row as any).id as string);
    }

    // Multiacademia: filtrar solo usuarios asignados a la academia objetivo
    if (allowedUserIds.size > 0) {
      const { data: uaRows2, error: uaErr2 } = await supabaseAdmin
        .from('user_academies')
        .select('user_id')
        .eq('academy_id', academyId)
        .in('user_id', Array.from(allowedUserIds));

      if (uaErr2) {
        return NextResponse.json({ error: uaErr2.message }, { status: 500 });
      }

      const academyUserIds = new Set<string>();
      for (const row of (uaRows2 ?? []) as any[]) {
        if (row.user_id) academyUserIds.add(row.user_id as string);
      }

      const filtered = new Set<string>();
      for (const id of allowedUserIds) {
        if (academyUserIds.has(id)) filtered.add(id);
      }
      allowedUserIds.clear();
      for (const id of filtered) allowedUserIds.add(id);
    }

    if (allowedUserIds.size === 0) {
      return NextResponse.json({ error: 'Ningún usuario tiene activadas las notificaciones para esta clase cancelada.' }, { status: 404 });
    }

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

    // Nombre del actor que canceló (nominal)
    let actorName: string | null = null;
    try {
      if (cancelledByUserId) {
        const { data: pRow } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', cancelledByUserId)
          .maybeSingle();
        actorName = ((pRow as any)?.full_name as string | undefined) ?? null;
      } else if (cancelledByRole === 'student' && cancelledByStudentId) {
        const { data: stRow } = await supabaseAdmin
          .from('students')
          .select('user_id')
          .eq('id', cancelledByStudentId)
          .maybeSingle();
        if ((stRow as any)?.user_id) {
          const { data: pRow } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', (stRow as any).user_id)
            .maybeSingle();
          actorName = ((pRow as any)?.full_name as string | undefined) ?? null;
        }
      } else if (cancelledByRole === 'coach' && cancelledByCoachId) {
        const { data: cRow } = await supabaseAdmin
          .from('coaches')
          .select('user_id')
          .eq('id', cancelledByCoachId)
          .maybeSingle();
        if ((cRow as any)?.user_id) {
          const { data: pRow } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', (cRow as any).user_id)
            .maybeSingle();
          actorName = ((pRow as any)?.full_name as string | undefined) ?? null;
        }
      }
    } catch {
      // ignorar
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

    // Datos de cancha/sede
    let whereText = '';
    try {
      const { data: csRow, error: csErr } = await supabaseAdmin
        .from('class_sessions')
        .select('court_id')
        .eq('id', classId)
        .maybeSingle();

      const courtIdFromClass = (csRow as any)?.court_id as string | undefined;
      if (!csErr && courtIdFromClass) {
        const { data: courtRow, error: courtErr } = await supabaseAdmin
          .from('courts')
          .select('id, name, location_id')
          .eq('id', courtIdFromClass)
          .maybeSingle();

        if (!courtErr && courtRow) {
          const courtName = (courtRow as any)?.name as string | undefined;
          const locationId = (courtRow as any)?.location_id as string | undefined;

          let locationName: string | null = null;
          if (locationId) {
            const { data: locRow, error: locErr } = await supabaseAdmin
              .from('locations')
              .select('name')
              .eq('id', locationId)
              .maybeSingle();
            if (!locErr) locationName = ((locRow as any)?.name as string | undefined) ?? null;
          }

          if (courtName && locationName) whereText = `${locationName} - ${courtName}`;
          else if (courtName) whereText = courtName;
          else if (locationName) whereText = locationName;
        }
      }
    } catch {
      // ignorar
    }

    let bodyText = '';
    if (cancelledByRole === 'student') {
      bodyText = `${actorName ?? 'Un alumno'} canceló la clase${when ? ` del ${when}` : ''}${whereText ? ` (${whereText})` : ''}.`;
    } else if (cancelledByRole === 'coach') {
      bodyText = `${actorName ?? 'El profesor'} canceló la clase${when ? ` del ${when}` : ''}${whereText ? ` (${whereText})` : ''}.`;
    } else {
      bodyText = `${actorName ?? 'Un administrador'} canceló la clase${when ? ` del ${when}` : ''}${whereText ? ` (${whereText})` : ''}.`;
    }

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
    console.error('Error en /api/push/class-cancelled', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificaciones de clase cancelada' }, { status: 500 });
  }
}
