import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';
import nodemailer from 'nodemailer';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { createInAppNotifications } from '@/lib/in-app-notifications';

function getNotificationCcEmails(): string[] {
  const raw = (process.env.NOTIFICATION_CC_EMAILS || 'alisamudio1@gmail.com,nativatechpy@gmail.com').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => !!s);
}

async function sendDeactivationRequestEmail(params: {
  to: string;
  academyName: string;
  adminName: string;
  studentName: string;
  reason: string | null;
}) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!user || !pass || !from) {
    return 'skipped' as const;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const reasonLine = params.reason?.trim() ? `<p style="margin:0 0 10px;"><strong>Motivo:</strong> ${params.reason.trim()}</p>` : '';

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#0f172a; padding:32px 16px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.35);">
        <div style="background:linear-gradient(135deg,#0f172a,#1d3b4f,#3cadaf);padding:24px 24px 20px; text-align:center; color:#e5f6ff;">
          <img src="https://agendo.nativatech.com.py/icons/LogoAgendo1024.png" alt="Agendo" style="height:56px;width:auto;display:block;margin:0 auto 12px;" />
          <h1 style="margin:0;font-size:20px;font-weight:650;letter-spacing:0.02em;color:#ffffff;">Solicitud de inactivación de alumno</h1>
        </div>
        <div style="padding:20px 24px 24px; color:#111827; font-size:14px; line-height:1.6;">
          <p style="margin:0 0 12px;">Se registró una solicitud de inactivación de un alumno.</p>
          <p style="margin:0 0 10px;"><strong>Academia:</strong> ${params.academyName}</p>
          <p style="margin:0 0 10px;"><strong>Solicitado por:</strong> ${params.adminName}</p>
          <p style="margin:0 0 10px;"><strong>Alumno:</strong> ${params.studentName}</p>
          ${reasonLine}
          <div style="margin:18px 0 16px; text-align:center;">
            <a href="${process.env.APP_BASE_URL || ''}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#3cadaf;color:#ffffff;font-weight:600;font-size:13px;text-decoration:none;letter-spacing:0.03em;">Abrir Agendo</a>
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Este correo es informativo. La inactivación no se aplica automáticamente.</p>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: params.to,
    cc: getNotificationCcEmails(),
    subject: 'Inactivación de usuario (solicitud)',
    html,
  });

  return 'sent' as const;
}

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
};

async function sendPushToUsers(userIds: string[], payload: any) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    return { ok: 0, total: 0, skipped: true as const };
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subsAll, error: subsErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth,user_id')
    .in('user_id', userIds);

  if (subsErr) {
    return { ok: 0, total: 0, skipped: true as const };
  }

  const subs = (subsAll ?? []) as SubscriptionRow[];
  if (subs.length === 0) {
    return { ok: 0, total: 0, skipped: true as const };
  }

  const message = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        message,
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

  return {
    ok: results.filter((r) => r.status === 'fulfilled').length,
    total: subs.length,
    skipped: false as const,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, targetUserId, academyId, reason } = body as {
      currentUserId?: string;
      targetUserId?: string;
      academyId?: string;
      reason?: string;
    };

    if (!currentUserId) {
      return NextResponse.json({ error: 'currentUserId es requerido.' }, { status: 400 });
    }

    if (!targetUserId || !academyId) {
      return NextResponse.json({ error: 'targetUserId y academyId son requeridos.' }, { status: 400 });
    }

    const { data: currentProfile, error: currentProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', currentUserId)
      .maybeSingle();

    if (currentProfileErr) {
      return NextResponse.json({ error: 'No se pudo verificar permisos.' }, { status: 403 });
    }

    const currentRole = (currentProfile?.role as string | null) ?? null;
    if (currentRole !== 'admin' && currentRole !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    if (currentRole === 'admin') {
      const { data: uaRow, error: uaErr } = await supabaseAdmin
        .from('user_academies')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('academy_id', academyId)
        .eq('role', 'admin')
        .eq('is_active', true)
        .maybeSingle();

      if (uaErr || !uaRow) {
        return NextResponse.json({ error: 'No autorizado para esta academia.' }, { status: 403 });
      }
    }

    const { data: targetUa, error: targetUaErr } = await supabaseAdmin
      .from('user_academies')
      .select('id, role, is_active')
      .eq('user_id', targetUserId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (targetUaErr || !targetUa) {
      return NextResponse.json({ error: 'El usuario no pertenece a esta academia.' }, { status: 400 });
    }

    if ((targetUa as any).role !== 'student') {
      return NextResponse.json({ error: 'Solo se pueden solicitar inactivaciones para alumnos.' }, { status: 400 });
    }

    const { data: academyRow } = await supabaseAdmin
      .from('academies')
      .select('name')
      .eq('id', academyId)
      .maybeSingle();

    const academyName = ((academyRow as any)?.name as string | undefined) ?? academyId;

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', targetUserId)
      .maybeSingle();

    const adminName = ((currentProfile as any)?.full_name as string | undefined) ?? currentUserId;
    const studentName = ((targetProfile as any)?.full_name as string | undefined) ?? targetUserId;

    const cleanReason = typeof reason === 'string' ? reason.trim() : '';

    const { data: insertedReq, error: insReqErr } = await supabaseAdmin
      .from('user_deactivation_requests')
      .insert({
        academy_id: academyId,
        target_user_id: targetUserId,
        requested_by_user_id: currentUserId,
        reason: cleanReason ? cleanReason : null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insReqErr) {
      return NextResponse.json({ error: insReqErr.message ?? 'No se pudo registrar la solicitud.' }, { status: 400 });
    }

    const { data: superAdmins, error: superAdminsErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'super_admin');

    if (superAdminsErr) {
      return NextResponse.json({ error: 'No se pudieron obtener los super_admin.' }, { status: 500 });
    }

    const superAdminIds = Array.from(
      new Set(((superAdmins ?? []) as any[]).map((r) => (r as any).id).filter((id) => typeof id === 'string' && id)),
    ) as string[];

    if (superAdminIds.length === 0) {
      return NextResponse.json({ error: 'No se encontraron super_admin para notificar.' }, { status: 404 });
    }

    const title = 'Solicitud de inactivación de alumno';
    const bodyText = `${adminName} solicitó inactivar a ${studentName} en ${academyName}.`;

    await createInAppNotifications(
      superAdminIds.map((id) => ({
        user_id: id,
        type: 'user_deactivation_request',
        title,
        body: bodyText,
        data: {
          requestId: (insertedReq as any)?.id,
          academyId,
          academyName,
          requestedByUserId: currentUserId,
          requestedByName: adminName,
          targetUserId,
          targetUserName: studentName,
          reason: cleanReason ? cleanReason : null,
        },
      })),
    );

    const pushPayload = {
      title,
      body: bodyText,
      data: {
        url: '/users',
        requestId: (insertedReq as any)?.id,
        academyId,
      },
    };

    const pushStatus = await sendPushToUsers(superAdminIds, pushPayload);

    const emailResults = await Promise.allSettled(
      superAdminIds.map(async (id) => {
        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(id);
        if (userErr) return { status: 'skipped' as const };
        const email = (userData?.user?.email ?? '').trim();
        if (!email) return { status: 'skipped' as const };
        return {
          status: await sendDeactivationRequestEmail({
            to: email,
            academyName,
            adminName,
            studentName,
            reason: cleanReason ? cleanReason : null,
          }),
        };
      }),
    );

    const emailsSent = emailResults.filter((r) => r.status === 'fulfilled' && (r as any).value?.status === 'sent').length;

    return NextResponse.json({
      success: true,
      requestId: (insertedReq as any)?.id,
      notifiedSuperAdmins: superAdminIds.length,
      push: pushStatus,
      emailsSent,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}
