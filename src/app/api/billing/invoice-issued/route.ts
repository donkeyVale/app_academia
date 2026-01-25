import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createInAppNotifications } from '@/lib/in-app-notifications';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function monthLabel(year: number, month: number): string {
  const d = new Date(Date.UTC(year, Math.max(0, month - 1), 1, 0, 0, 0));
  return d.toLocaleDateString('es-PY', { month: 'long', year: 'numeric', timeZone: 'America/Asuncion' });
}

function formatGs(amount: number) {
  try {
    return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(Math.round(amount));
  }
}

function getNotificationCcEmails(): string[] {
  const raw = (process.env.NOTIFICATION_CC_EMAILS || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => !!s);
}

async function sendBillingEmail(params: {
  to: string;
  subject: string;
  title: string;
  academyName: string;
  bodyHtml: string;
  ctaHref?: string;
  ctaText?: string;
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

  const appBase = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const ctaHref = params.ctaHref || (appBase ? `${appBase}/super-admin/billing` : '');
  const ctaText = params.ctaText || 'Abrir Facturación';

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#0f172a; padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.35);">
        <div style="background:linear-gradient(135deg,#0f172a,#1d3b4f,#3cadaf);padding:24px 24px 20px; text-align:center; color:#e5f6ff;">
          <img src="https://agendo.nativatech.com.py/icons/LogoAgendo1024.png" alt="Agendo" style="height:56px;width:auto;display:block;margin:0 auto 12px;" />
          <h1 style="margin:0;font-size:20px;font-weight:650;letter-spacing:0.02em;color:#ffffff;">${params.title}</h1>
        </div>
        <div style="padding:20px 24px 24px; color:#111827; font-size:14px; line-height:1.6;">
          <p style="margin:0 0 10px;"><strong>Academia:</strong> ${params.academyName}</p>
          ${params.bodyHtml}
          ${ctaHref ? `<div style="margin:18px 0 16px; text-align:center;">
            <a href="${ctaHref}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#3cadaf;color:#ffffff;font-weight:600;font-size:13px;text-decoration:none;letter-spacing:0.03em;">${ctaText}</a>
          </div>` : ''}
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: params.to,
    cc: getNotificationCcEmails(),
    subject: params.subject,
    html,
  });

  return 'sent' as const;
}

async function resolveAdminRecipients(academyId: string): Promise<{ userIds: string[]; emailsByUserId: Record<string, string>; academyName: string | null }> {
  const { data: academyRow } = await supabaseAdmin.from('academies').select('name').eq('id', academyId).maybeSingle();
  const academyName = ((academyRow as any)?.name as string | undefined) ?? null;

  const { data: uaRows, error: uaErr } = await supabaseAdmin
    .from('user_academies')
    .select('user_id, role, is_active')
    .eq('academy_id', academyId)
    .eq('is_active', true)
    .eq('role', 'admin');

  if (uaErr) throw uaErr;

  const userIds = Array.from(new Set((uaRows ?? []).map((r: any) => r.user_id).filter(Boolean)));

  const emailsByUserId: Record<string, string> = {};

  // Try profiles.email first (if exists), fallback to auth user email.
  if (userIds.length > 0) {
    try {
      const { data: profRows, error: profErr } = await supabaseAdmin.from('profiles').select('id,email').in('id', userIds);
      if (!profErr) {
        for (const r of profRows ?? []) {
          const id = (r as any)?.id as string | undefined;
          const email = (r as any)?.email as string | undefined;
          if (id && email) emailsByUserId[id] = email;
        }
      }
    } catch {
    }

    for (const userId of userIds) {
      if (emailsByUserId[userId]) continue;
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        const email = (data as any)?.user?.email as string | undefined;
        if (email) emailsByUserId[userId] = email;
      } catch {
      }
    }
  }

  return { userIds, emailsByUserId, academyName };
}

async function resolveActiveSalesAgent(academyId: string, day: string): Promise<{
  salesAgentId: string;
  salesAgentName: string;
  salesAgentEmail: string | null;
  commissionRate: number;
} | null> {
  const { data: asgRows, error: asgErr } = await supabaseAdmin
    .from('billing_academy_sales_agents')
    .select('sales_agent_id, commission_rate, valid_from, valid_to')
    .eq('academy_id', academyId)
    .lte('valid_from', day)
    .or(`valid_to.is.null,valid_to.gt.${day}`)
    .order('valid_from', { ascending: false })
    .limit(1);

  if (asgErr) throw asgErr;
  const asg = (asgRows ?? [])[0] as any;
  const salesAgentId = asg?.sales_agent_id as string | undefined;
  if (!salesAgentId) return null;

  const commissionRate = Number(asg?.commission_rate ?? 0);
  if (!Number.isFinite(commissionRate) || commissionRate <= 0) return null;

  const { data: agentRow, error: agentErr } = await supabaseAdmin
    .from('billing_sales_agents')
    .select('id,name,email,is_active')
    .eq('id', salesAgentId)
    .maybeSingle();

  if (agentErr) throw agentErr;
  const isActive = (agentRow as any)?.is_active;
  if (isActive === false) return null;

  return {
    salesAgentId,
    salesAgentName: ((agentRow as any)?.name as string | undefined) ?? salesAgentId,
    salesAgentEmail: ((agentRow as any)?.email as string | undefined) ?? null,
    commissionRate,
  };
}

async function sendPushToUsers(userIds: string[], payload: any) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) return { ok: 0, total: 0, skipped: true as const };

  webPush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subsAll, error: subsErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('user_id,endpoint,p256dh,auth')
    .in('user_id', userIds);

  if (subsErr) return { ok: 0, total: 0, skipped: true as const };

  const subs = (subsAll ?? []) as SubscriptionRow[];
  if (subs.length === 0) return { ok: 0, total: 0, skipped: true as const };

  const message = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
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

  return { ok: results.filter((r) => r.status === 'fulfilled').length, total: subs.length, skipped: false as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { academyId, invoiceId, periodYear, periodMonth, totalAmount, currency = 'PYG', dueFromDay = 5, dueToDay = 10 } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (!invoiceId || typeof invoiceId !== 'string') {
      return NextResponse.json({ error: 'Falta invoiceId.' }, { status: 400 });
    }

    const y = Number(periodYear);
    const m = Number(periodMonth);
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
      return NextResponse.json({ error: 'Periodo inválido.' }, { status: 400 });
    }

    const amt = Number(totalAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 });
    }

    const { userIds, emailsByUserId, academyName } = await resolveAdminRecipients(academyId);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no_admins' });
    }

    const periodText = monthLabel(y, m);
    const amountText = currency === 'PYG' ? `Gs. ${formatGs(amt)}` : `${amt} ${currency}`;

    const title = 'Factura generada';
    const bodyText = `Se generó la factura del período ${periodText} (${amountText}). Tenés tiempo de abonar entre el ${dueFromDay} y el ${dueToDay} del mes.`;

    try {
      await createInAppNotifications(
        userIds.map((userId) => ({
          user_id: userId,
          type: 'billing_invoice_issued',
          title,
          body: bodyText,
          data: { url: '/super-admin/billing', academyId, invoiceId, periodYear: y, periodMonth: m },
        })),
      );
    } catch (e) {
      console.error('Error creando notificación in-app (billing invoice-issued)', e);
    }

    // Push web (best effort)
    try {
      await sendPushToUsers(userIds, { title, body: bodyText, data: { url: '/super-admin/billing' } });
    } catch (e) {
      console.error('Error enviando push web (billing invoice-issued)', e);
    }

    // OneSignal mobile (best effort)
    try {
      await sendOneSignalNotification({
        externalUserIds: userIds,
        title,
        body: bodyText,
        launchUrl: 'agendo://super-admin/billing',
        data: { url: '/super-admin/billing', academyId, invoiceId },
      });
    } catch (e) {
      console.error('Error enviando OneSignal (billing invoice-issued)', e);
    }

    // Email (best effort)
    const acadNameSafe = academyName ?? academyId;
    const emailBodyHtml = `
      <p style="margin:0 0 10px;">Se ha generado la factura del período <strong>${periodText}</strong>.</p>
      <p style="margin:0 0 10px;">Monto: <strong>${amountText}</strong>.</p>
      <p style="margin:0 0 10px;">Recordá que tenés tiempo de abonar entre el <strong>${dueFromDay}</strong> y el <strong>${dueToDay}</strong> de este mes.</p>
    `;

    const results: any[] = [];
    for (const userId of userIds) {
      const to = emailsByUserId[userId];
      if (!to) continue;
      try {
        const r = await sendBillingEmail({
          to,
          subject: `Agendo · Factura generada (${periodText})`,
          title: 'Factura generada',
          academyName: acadNameSafe,
          bodyHtml: emailBodyHtml,
          ctaText: 'Ver facturación',
        });
        results.push({ userId, to, status: r });
      } catch (e) {
        console.error('Error enviando email billing invoice-issued', e);
        results.push({ userId, to, status: 'error' });
      }
    }

    // Email al vendedor/asesor asignado (best effort)
    try {
      const day = new Date().toISOString().slice(0, 10);
      const agent = await resolveActiveSalesAgent(academyId, day);
      if (agent?.salesAgentEmail) {
        const commissionAmount = amt * agent.commissionRate;
        const commText = currency === 'PYG' ? `Gs. ${formatGs(commissionAmount)}` : `${commissionAmount} ${currency}`;
        const ratePct = `${Math.round(agent.commissionRate * 10000) / 100}%`;
        const agentBody = `
          <p style="margin:0 0 10px;">Se generó una factura del período <strong>${periodText}</strong> para la academia.</p>
          <p style="margin:0 0 10px;">Monto factura: <strong>${amountText}</strong>.</p>
          <p style="margin:0 0 10px;">Tu comisión (${ratePct}): <strong>${commText}</strong>.</p>
        `;

        await sendBillingEmail({
          to: agent.salesAgentEmail,
          subject: `Agendo · Comisión por factura (${periodText})`,
          title: 'Comisión por factura generada',
          academyName: acadNameSafe,
          bodyHtml: agentBody,
          ctaText: 'Abrir facturación',
        });
      }
    } catch (e) {
      console.error('Error enviando email a vendedor (billing invoice-issued)', e);
    }

    return NextResponse.json({ ok: true, notified: userIds.length, emailed: results.filter((r) => r.status === 'sent').length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error invoice-issued' }, { status: 500 });
  }
}
