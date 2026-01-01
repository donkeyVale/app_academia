import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, coachId, studentIds, dateIso, academyId } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

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

    const coachUserIds = new Set<string>();
    const studentUserIds = new Set<string>();

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
        coachUserIds.add(coachRow.user_id as string);
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
          if (row.user_id) studentUserIds.add(row.user_id as string);
        }
      }
    }

    const userIds = new Set<string>();
    for (const id of coachUserIds) userIds.add(id);
    for (const id of studentUserIds) userIds.add(id);

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

    // Multiacademia: filtrar solo usuarios asignados a la academia objetivo
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

    // Separar destinatarios por tipo (profesor vs alumnos) manteniendo allowed + multiacademia
    const allowedCoachUserIds = new Set<string>();
    const allowedStudentUserIds = new Set<string>();
    for (const id of allowedUserIds) {
      if (coachUserIds.has(id)) allowedCoachUserIds.add(id);
      if (studentUserIds.has(id)) allowedStudentUserIds.add(id);
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

    let when = '';
    try {
      if (dateIso) {
        const d = new Date(dateIso);
        when = d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Asuncion' });
      }
    } catch {
      // ignorar errores de formato
    }

    // Datos nominales
    let coachName: string | null = null;
    try {
      if (coachId) {
        const { data: cRow, error: cErr } = await supabaseAdmin
          .from('coaches')
          .select('user_id')
          .eq('id', coachId)
          .maybeSingle();
        const coachUserId = (cRow as any)?.user_id as string | undefined;
        if (!cErr && coachUserId) {
          const { data: pRow, error: pErr } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', coachUserId)
            .maybeSingle();
          if (!pErr) coachName = ((pRow as any)?.full_name as string | undefined) ?? null;
        }
      }
    } catch {
      // ignorar
    }

    let firstStudentName: string | null = null;
    let studentsCount = 0;
    try {
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        studentsCount = Array.from(new Set(studentIds as string[])).length;
        const { data: stRows, error: stErr } = await supabaseAdmin
          .from('students')
          .select('id, user_id')
          .in('id', Array.from(new Set(studentIds as string[])));
        if (!stErr && stRows && stRows.length > 0) {
          const firstUserId = (stRows as any[]).find((r) => r.user_id)?.user_id as string | undefined;
          if (firstUserId) {
            const { data: pRow, error: pErr } = await supabaseAdmin
              .from('profiles')
              .select('full_name')
              .eq('id', firstUserId)
              .maybeSingle();
            if (!pErr) firstStudentName = ((pRow as any)?.full_name as string | undefined) ?? null;
          }
        }
      }
    } catch {
      // ignorar
    }

    // Datos de cancha/sede
    let whereText = '';
    try {
      const idToUse = (classId as string | undefined) ?? null;
      if (idToUse) {
        const { data: csRow, error: csErr } = await supabaseAdmin
          .from('class_sessions')
          .select('court_id')
          .eq('id', idToUse)
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
      }
    } catch {
      // ignorar
    }

    const whenText = when ? ` el ${when}` : '';
    const whereSuffix = whereText ? ` (${whereText})` : '';

    const studentBody = `Tenés una nueva clase${coachName ? ` con ${coachName}` : ''}${whenText}${whereSuffix}.`;

    let coachWithText = '';
    if (studentsCount <= 0) {
      coachWithText = '';
    } else if (studentsCount === 1) {
      coachWithText = firstStudentName ? ` con ${firstStudentName}` : ' con un alumno';
    } else {
      coachWithText = firstStudentName ? ` con ${firstStudentName} y ${studentsCount - 1} más` : ` con ${studentsCount} alumnos`;
    }
    const coachBody = `Nueva clase agendada${coachWithText}${whenText}${whereSuffix}.`;

    const payloadStudents = JSON.stringify({
      title: 'Nueva clase creada',
      body: studentBody,
      data: { url: '/schedule' },
    });

    const payloadCoach = JSON.stringify({
      title: 'Nueva clase creada',
      body: coachBody,
      data: { url: '/schedule' },
    });

    const studentSubs = subs.filter((s) => allowedStudentUserIds.has(s.user_id));
    const coachSubs = subs.filter((s) => allowedCoachUserIds.has(s.user_id));

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

    const results = [...resultsStudents, ...resultsCoach];

    // Limpiar endpoints muertos (410/404) para mejorar confiabilidad
    await Promise.allSettled(
      results.map((r, idx) => {
        if (r.status !== 'rejected') return Promise.resolve();
        const reason: any = (r as any).reason;
        const statusCode = Number(reason?.statusCode ?? reason?.status);
        if (statusCode !== 404 && statusCode !== 410) return Promise.resolve();
        const mergedSubs = [...studentSubs, ...coachSubs];
        const endpoint = (mergedSubs as any[])[idx]?.endpoint as string | undefined;
        if (!endpoint) return Promise.resolve();
        return supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;

    return NextResponse.json({ ok, total: studentSubs.length + coachSubs.length });
  } catch (e: any) {
    console.error('Error en /api/push/class-created', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificaciones de clase creada' }, { status: 500 });
  }
}
