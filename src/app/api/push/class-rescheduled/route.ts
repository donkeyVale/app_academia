import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

function formatWhen(dateIso?: string | null) {
  if (!dateIso) return '';
  try {
    const d = new Date(dateIso);
    return d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Asuncion' });
  } catch {
    return '';
  }
}

async function getWhereTextFromCourtId(courtId?: string | null) {
  if (!courtId) return '';
  try {
    const { data: courtRow, error: courtErr } = await supabaseAdmin
      .from('courts')
      .select('id, name, location_id')
      .eq('id', courtId)
      .maybeSingle();

    if (courtErr || !courtRow) return '';

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

    if (courtName && locationName) return `${locationName} - ${courtName}`;
    if (courtName) return courtName;
    if (locationName) return locationName;
    return '';
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      classId,
      academyId,
      studentIds,
      coachId,
      oldDateIso,
      newDateIso,
      oldCourtId,
      newCourtId,
      oldCoachId,
      newCoachId,
      rescheduledByRole,
      rescheduledByUserId,
    } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (!classId || typeof classId !== 'string') {
      return NextResponse.json({ error: 'Falta classId.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    // Destinatarios: profesor (coachId) y alumnos (studentIds)
    const coachUserIds = new Set<string>();
    if (coachId && typeof coachId === 'string') {
      const { data: coachRow } = await supabaseAdmin
        .from('coaches')
        .select('user_id')
        .eq('id', coachId)
        .maybeSingle();
      if ((coachRow as any)?.user_id) coachUserIds.add((coachRow as any).user_id as string);
    }

    const uniqueStudentIds =
      studentIds && Array.isArray(studentIds) && studentIds.length > 0
        ? Array.from(new Set(studentIds as string[]))
        : [];

    const studentUserIds = new Set<string>();
    if (uniqueStudentIds.length > 0) {
      const { data: stRows } = await supabaseAdmin
        .from('students')
        .select('id, user_id')
        .in('id', uniqueStudentIds);
      for (const row of (stRows ?? []) as any[]) {
        if (row.user_id) studentUserIds.add(row.user_id as string);
      }
    }

    // Admins de la academia
    const academyAdminUserIds = new Set<string>();
    const { data: uaAdminRows, error: uaAdminErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, role')
      .eq('academy_id', academyId)
      .eq('is_active', true);

    if (uaAdminErr) {
      return NextResponse.json({ error: uaAdminErr.message }, { status: 500 });
    }

    for (const row of (uaAdminRows ?? []) as any[]) {
      if (!row.user_id) continue;
      if (row.role === 'admin' || row.role === 'super_admin') {
        academyAdminUserIds.add(row.user_id as string);
      }
    }

    const targetUserIds = new Set<string>();
    for (const id of coachUserIds) targetUserIds.add(id);
    for (const id of studentUserIds) targetUserIds.add(id);
    for (const id of academyAdminUserIds) targetUserIds.add(id);

    if (targetUserIds.size === 0) {
      return NextResponse.json({ error: 'No se encontraron usuarios para notificar.' }, { status: 404 });
    }

    // Respetar preferencia notifications_enabled
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

    // Multiacademia: filtrar usuarios asignados a esa academia
    if (allowedUserIds.size > 0) {
      const { data: uaRows, error: uaErr } = await supabaseAdmin
        .from('user_academies')
        .select('user_id')
        .eq('academy_id', academyId)
        .eq('is_active', true)
        .in('user_id', Array.from(allowedUserIds));

      if (uaErr) {
        return NextResponse.json({ error: uaErr.message }, { status: 500 });
      }

      const academyUserIds = new Set<string>();
      for (const row of (uaRows ?? []) as any[]) {
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
      return NextResponse.json({ error: 'Ningún usuario tiene activadas las notificaciones para esta clase.' }, { status: 404 });
    }

    const allowedCoachUserIds = new Set<string>();
    const allowedStudentUserIds = new Set<string>();
    for (const id of allowedUserIds) {
      if (coachUserIds.has(id)) allowedCoachUserIds.add(id);
      if (studentUserIds.has(id)) allowedStudentUserIds.add(id);
    }

    const allowedAdminUserIds = new Set<string>();
    for (const id of allowedUserIds) {
      if (academyAdminUserIds.has(id)) allowedAdminUserIds.add(id);
    }

    const { data: subsAll, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(allowedUserIds));

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    const subs = (subsAll ?? []) as any[];
    if (subs.length === 0) {
      return NextResponse.json({ error: 'No hay suscripciones registradas para los usuarios objetivo.' }, { status: 404 });
    }

    // Datos nominales
    let actorName: string | null = null;
    try {
      if (rescheduledByUserId && typeof rescheduledByUserId === 'string') {
        const { data: pRow } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', rescheduledByUserId)
          .maybeSingle();
        actorName = ((pRow as any)?.full_name as string | undefined) ?? null;
      }
    } catch {
      // ignorar
    }

    let coachName: string | null = null;
    try {
      if (coachId) {
        const { data: cRow } = await supabaseAdmin
          .from('coaches')
          .select('user_id')
          .eq('id', coachId)
          .maybeSingle();
        const coachUserId = (cRow as any)?.user_id as string | undefined;
        if (coachUserId) {
          const { data: pRow } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', coachUserId)
            .maybeSingle();
          coachName = ((pRow as any)?.full_name as string | undefined) ?? null;
        }
      }
    } catch {
      // ignorar
    }

    let firstStudentName: string | null = null;
    let studentsCount = 0;
    try {
      if (uniqueStudentIds.length > 0) {
        studentsCount = uniqueStudentIds.length;
        const { data: stRows } = await supabaseAdmin
          .from('students')
          .select('id, user_id')
          .in('id', uniqueStudentIds);
        const firstUserId = (stRows as any[])?.find((r) => r.user_id)?.user_id as string | undefined;
        if (firstUserId) {
          const { data: pRow } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', firstUserId)
            .maybeSingle();
          firstStudentName = ((pRow as any)?.full_name as string | undefined) ?? null;
        }
      }
    } catch {
      // ignorar
    }

    // Mensajes (antes -> después)
    const whenOld = formatWhen(oldDateIso);
    const whenNew = formatWhen(newDateIso);

    // Si no mandaron canchas, intentamos usar lo de la clase actual
    const oldWhere = await getWhereTextFromCourtId(oldCourtId ?? null);
    let newWhere = await getWhereTextFromCourtId(newCourtId ?? null);

    if (!newWhere) {
      try {
        const { data: csRow } = await supabaseAdmin
          .from('class_sessions')
          .select('court_id')
          .eq('id', classId)
          .maybeSingle();
        const cId = (csRow as any)?.court_id as string | undefined;
        if (cId) newWhere = await getWhereTextFromCourtId(cId);
      } catch {
        // ignorar
      }
    }

    const changesParts: string[] = [];
    if (whenOld && whenNew && whenOld !== whenNew) changesParts.push(`Horario: ${whenOld} → ${whenNew}`);
    else if (!whenOld && whenNew) changesParts.push(`Nuevo horario: ${whenNew}`);

    if (oldWhere && newWhere && oldWhere !== newWhere) changesParts.push(`Lugar: ${oldWhere} → ${newWhere}`);
    else if (!oldWhere && newWhere) changesParts.push(`Nuevo lugar: ${newWhere}`);

    if (oldCoachId && newCoachId && oldCoachId !== newCoachId) {
      changesParts.push('Profesor actualizado');
    }

    const changesText = changesParts.length > 0 ? changesParts.join(' | ') : 'Se actualizó la clase.';

    const actorSuffix = actorName
      ? ` por ${actorName}`
      : rescheduledByRole && typeof rescheduledByRole === 'string'
        ? ` por ${rescheduledByRole === 'coach' ? 'el profesor' : rescheduledByRole === 'admin' || rescheduledByRole === 'super_admin' ? 'un administrador' : rescheduledByRole}`
        : '';

    const studentBody = `Tu clase${coachName ? ` con ${coachName}` : ''} fue reprogramada${actorSuffix}. ${changesText}`;

    let coachWithText = '';
    if (studentsCount <= 0) coachWithText = '';
    else if (studentsCount === 1) coachWithText = firstStudentName ? ` con ${firstStudentName}` : ' con un alumno';
    else coachWithText = firstStudentName ? ` con ${firstStudentName} y ${studentsCount - 1} más` : ` con ${studentsCount} alumnos`;

    const coachBody = `Tu clase${coachWithText} fue reprogramada${actorSuffix}. ${changesText}`;

    const payloadStudents = JSON.stringify({
      title: 'Clase reprogramada',
      body: studentBody,
      data: { url: '/schedule' },
    });

    const payloadCoach = JSON.stringify({
      title: 'Clase reprogramada',
      body: coachBody,
      data: { url: '/schedule' },
    });

    let studentsLabel = '';
    if (studentsCount <= 0) studentsLabel = 'Sin alumnos';
    else if (studentsCount === 1) studentsLabel = firstStudentName ? firstStudentName : '1 alumno';
    else studentsLabel = firstStudentName ? `${firstStudentName} y ${studentsCount - 1} más` : `${studentsCount} alumnos`;

    const adminBody = `Clase de ${studentsLabel}${coachName ? ` con ${coachName}` : ''} fue reprogramada${actorSuffix}. ${changesText}`;

    const payloadAdmins = JSON.stringify({
      title: 'Clase reprogramada',
      body: adminBody,
      data: { url: '/schedule' },
    });

    // In-app notifications (mismos destinatarios que push)
    try {
      await createInAppNotifications([
        ...Array.from(allowedStudentUserIds).map((userId) => ({
          user_id: userId,
          type: 'class_rescheduled_student',
          title: 'Clase reprogramada',
          body: studentBody,
          data: { url: '/schedule', classId, academyId, oldDateIso, newDateIso },
        })),
        ...Array.from(allowedCoachUserIds).map((userId) => ({
          user_id: userId,
          type: 'class_rescheduled_coach',
          title: 'Clase reprogramada',
          body: coachBody,
          data: { url: '/schedule', classId, academyId, oldDateIso, newDateIso },
        })),
        ...Array.from(allowedAdminUserIds).map((userId) => ({
          user_id: userId,
          type: 'class_rescheduled_admin',
          title: 'Clase reprogramada',
          body: adminBody,
          data: { url: '/schedule', classId, academyId, oldDateIso, newDateIso },
        })),
      ]);
    } catch (e) {
      console.error('Error creando notificación in-app (class-rescheduled)', e);
    }

    // OneSignal (Android/iOS) - best effort
    try {
      if (allowedStudentUserIds.size > 0) {
        await sendOneSignalNotification({
          externalUserIds: Array.from(allowedStudentUserIds),
          title: 'Clase reprogramada',
          body: studentBody,
          launchUrl: 'agendo://schedule',
          data: { url: '/schedule', classId, academyId, oldDateIso, newDateIso },
        });
      }
    } catch (e) {
      console.error('Error enviando OneSignal class-rescheduled (students)', e);
    }

    try {
      if (allowedCoachUserIds.size > 0) {
        await sendOneSignalNotification({
          externalUserIds: Array.from(allowedCoachUserIds),
          title: 'Clase reprogramada',
          body: coachBody,
          launchUrl: 'agendo://schedule',
          data: { url: '/schedule', classId, academyId, oldDateIso, newDateIso },
        });
      }
    } catch (e) {
      console.error('Error enviando OneSignal class-rescheduled (coach)', e);
    }

    try {
      if (allowedAdminUserIds.size > 0) {
        await sendOneSignalNotification({
          externalUserIds: Array.from(allowedAdminUserIds),
          title: 'Clase reprogramada',
          body: adminBody,
          launchUrl: 'agendo://schedule',
          data: { url: '/schedule', classId, academyId, oldDateIso, newDateIso },
        });
      }
    } catch (e) {
      console.error('Error enviando OneSignal class-rescheduled (admins)', e);
    }

    const studentSubs = subs.filter((s) => allowedStudentUserIds.has(s.user_id));
    const coachSubs = subs.filter((s) => allowedCoachUserIds.has(s.user_id));
    const adminSubs = subs.filter((s) => allowedAdminUserIds.has(s.user_id));

    const resultsStudents = await Promise.allSettled(
      studentSubs.map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStudents,
        ),
      ),
    );

    const resultsCoach = await Promise.allSettled(
      coachSubs.map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadCoach,
        ),
      ),
    );

    const resultsAdmins = await Promise.allSettled(
      adminSubs.map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadAdmins,
        ),
      ),
    );

    const results = [...resultsStudents, ...resultsCoach, ...resultsAdmins];

    // Limpiar endpoints muertos (410/404) para mejorar confiabilidad
    await Promise.allSettled(
      results.map((r, idx) => {
        if (r.status !== 'rejected') return Promise.resolve();
        const reason: any = (r as any).reason;
        const statusCode = Number(reason?.statusCode ?? reason?.status);
        if (statusCode !== 404 && statusCode !== 410) return Promise.resolve();
        const mergedSubs = [...studentSubs, ...coachSubs, ...adminSubs];
        const endpoint = (mergedSubs as any[])[idx]?.endpoint as string | undefined;
        if (!endpoint) return Promise.resolve();
        return supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;

    return NextResponse.json({ ok, total: studentSubs.length + coachSubs.length + adminSubs.length });
  } catch (e: any) {
    console.error('Error en /api/push/class-rescheduled', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificaciones de clase reprogramada' }, { status: 500 });
  }
}
