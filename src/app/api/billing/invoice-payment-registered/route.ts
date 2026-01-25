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

type ActiveSalesAgent = {
  salesAgentId: string;
  salesAgentName: string;
  salesAgentEmail: string | null;
  commissionRate: number;
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

function formatWhen(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Asuncion' });
  } catch {
    return '';
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

async function resolveActiveSalesAgents(academyId: string, day: string): Promise<ActiveSalesAgent[]> {
  const { data: asgRows, error: asgErr } = await supabaseAdmin
    .from('billing_academy_sales_agents')
    .select('sales_agent_id, commission_rate, valid_from, valid_to')
    .eq('academy_id', academyId)
    .lte('valid_from', day)
    .or(`valid_to.is.null,valid_to.gt.${day}`)
    .order('valid_from', { ascending: false });

  if (asgErr) throw asgErr;

  const rows = (asgRows ?? []) as any[];
  const agentIds = Array.from(new Set(rows.map((r) => r.sales_agent_id).filter(Boolean)));
  if (agentIds.length === 0) return [];

  const byId: Record<string, { name: string; email: string | null; is_active: boolean }> = {};
  {
    const { data: agents, error: agErr } = await supabaseAdmin
      .from('billing_sales_agents')
      .select('id,name,email,is_active')
      .in('id', agentIds);
    if (agErr) throw agErr;
    for (const a of agents ?? []) {
      const id = (a as any)?.id as string | undefined;
      if (!id) continue;
      byId[id] = {
        name: ((a as any)?.name as string | undefined) ?? id,
        email: ((a as any)?.email as string | undefined) ?? null,
        is_active: (a as any)?.is_active !== false,
      };
    }
  }

  const out: ActiveSalesAgent[] = [];
  for (const r of rows) {
    const salesAgentId = r?.sales_agent_id as string | undefined;
    if (!salesAgentId) continue;
    const meta = byId[salesAgentId];
    if (!meta || !meta.is_active) continue;
    const commissionRate = Number(r?.commission_rate ?? 0);
    if (!Number.isFinite(commissionRate) || commissionRate <= 0) continue;
    out.push({
      salesAgentId,
      salesAgentName: meta.name,
      salesAgentEmail: meta.email,
      commissionRate,
    });
  }

  // De-duplicate by salesAgentId (si hubiese múltiples filas por algún motivo)
  const dedup: Record<string, ActiveSalesAgent> = {};
  for (const a of out) dedup[a.salesAgentId] = a;
  return Object.values(dedup);
}

async function upsertCommissionForAgent(params: {
  salesAgentId: string;
  periodYear: number;
  periodMonth: number;
  basePaidDelta: number;
  commissionRate: number;
}) {
  const { salesAgentId, periodYear, periodMonth, basePaidDelta, commissionRate } = params;
  const commissionDelta = basePaidDelta * commissionRate;

  const { data: existing, error: selErr } = await supabaseAdmin
    .from('billing_sales_commissions')
    .select('id,status,base_paid_amount,commission_amount')
    .eq('sales_agent_id', salesAgentId)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .maybeSingle();

  if (selErr) throw selErr;

  if (!existing) {
    const { error: insErr } = await supabaseAdmin.from('billing_sales_commissions').insert({
      sales_agent_id: salesAgentId,
      period_year: periodYear,
      period_month: periodMonth,
      base_paid_amount: basePaidDelta,
      commission_rate: commissionRate,
      commission_amount: commissionDelta,
      status: 'pending',
    });
    if (insErr) throw insErr;
    return { nextStatus: 'pending', nextBase: basePaidDelta, nextCommission: commissionDelta };
  }

  const prevBase = Number((existing as any)?.base_paid_amount ?? 0);
  const prevCommission = Number((existing as any)?.commission_amount ?? 0);
  const nextBase = prevBase + basePaidDelta;
  const nextCommission = prevCommission + commissionDelta;
  const prevStatus = String((existing as any)?.status ?? 'pending');
  const nextStatus = prevStatus === 'paid' ? 'pending' : prevStatus;

  const { error: updErr } = await supabaseAdmin
    .from('billing_sales_commissions')
    .update({
      base_paid_amount: nextBase,
      commission_rate: commissionRate,
      commission_amount: nextCommission,
      status: nextStatus,
      paid_at: nextStatus === 'pending' ? null : undefined,
    })
    .eq('id', (existing as any).id);
  if (updErr) throw updErr;

  return { nextStatus, nextBase, nextCommission };
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
    const { academyId, invoiceId, paymentId, periodYear, periodMonth, paidAt, amount, currency = 'PYG' } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (!invoiceId || typeof invoiceId !== 'string') {
      return NextResponse.json({ error: 'Falta invoiceId.' }, { status: 400 });
    }

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'Falta paymentId.' }, { status: 400 });
    }

    const y = Number(periodYear);
    const m = Number(periodMonth);
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
      return NextResponse.json({ error: 'Periodo inválido.' }, { status: 400 });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 });
    }

    const { userIds, emailsByUserId, academyName } = await resolveAdminRecipients(academyId);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no_admins' });
    }

    const periodText = monthLabel(y, m);
    const amountText = currency === 'PYG' ? `Gs. ${formatGs(amt)}` : `${amt} ${currency}`;
    const whenText = paidAt ? formatWhen(String(paidAt)) : '';

    const title = 'Pago de factura registrado';
    const bodyText = `Se registró el pago del período ${periodText} (${amountText})${whenText ? ` · ${whenText}` : ''}.`;

    try {
      await createInAppNotifications(
        userIds.map((userId) => ({
          user_id: userId,
          type: 'billing_payment_registered',
          title,
          body: bodyText,
          data: { url: '/super-admin/billing', academyId, invoiceId, paymentId, periodYear: y, periodMonth: m },
        })),
      );
    } catch (e) {
      console.error('Error creando notificación in-app (billing payment-registered)', e);
    }

    try {
      await sendPushToUsers(userIds, { title, body: bodyText, data: { url: '/super-admin/billing' } });
    } catch (e) {
      console.error('Error enviando push web (billing payment-registered)', e);
    }

    try {
      await sendOneSignalNotification({
        externalUserIds: userIds,
        title,
        body: bodyText,
        launchUrl: 'agendo://super-admin/billing',
        data: { url: '/super-admin/billing', academyId, invoiceId, paymentId },
      });
    } catch (e) {
      console.error('Error enviando OneSignal (billing payment-registered)', e);
    }

    const acadNameSafe = academyName ?? academyId;
    const emailBodyHtml = `
      <p style="margin:0 0 10px;">Se registró el pago de la factura del período <strong>${periodText}</strong>.</p>
      <p style="margin:0 0 10px;">Monto: <strong>${amountText}</strong>${whenText ? ` · <strong>${whenText}</strong>` : ''}.</p>
    `;

    const results: any[] = [];
    for (const userId of userIds) {
      const to = emailsByUserId[userId];
      if (!to) continue;
      try {
        const r = await sendBillingEmail({
          to,
          subject: `Agendo · Pago registrado (${periodText})`,
          title: 'Pago registrado',
          academyName: acadNameSafe,
          bodyHtml: emailBodyHtml,
          ctaText: 'Ver facturación',
        });
        results.push({ userId, to, status: r });
      } catch (e) {
        console.error('Error enviando email billing payment-registered', e);
        results.push({ userId, to, status: 'error' });
      }
    }

    // Comisión vendedor (registro de comisión pendiente + email) - best effort
    try {
      const day = (paidAt ? String(paidAt).slice(0, 10) : new Date().toISOString().slice(0, 10)) || new Date().toISOString().slice(0, 10);
      const activeAgents = await resolveActiveSalesAgents(academyId, day);
      for (const agent of activeAgents) {
        const { nextBase, nextCommission } = await upsertCommissionForAgent({
          salesAgentId: agent.salesAgentId,
          periodYear: y,
          periodMonth: m,
          basePaidDelta: amt,
          commissionRate: agent.commissionRate,
        });

        if (!agent.salesAgentEmail) continue;

        const commissionDelta = amt * agent.commissionRate;
        const commDeltaText = currency === 'PYG' ? `Gs. ${formatGs(commissionDelta)}` : `${commissionDelta} ${currency}`;
        const commTotalText = currency === 'PYG' ? `Gs. ${formatGs(nextCommission)}` : `${nextCommission} ${currency}`;
        const baseTotalText = currency === 'PYG' ? `Gs. ${formatGs(nextBase)}` : `${nextBase} ${currency}`;

        const ratePct = `${Math.round(agent.commissionRate * 10000) / 100}%`;

        const agentBody = `
          <p style="margin:0 0 10px;">Hola <strong>${agent.salesAgentName}</strong>,</p>
          <p style="margin:0 0 10px;">Se registró un pago de la academia <strong>${acadNameSafe}</strong> correspondiente al período <strong>${periodText}</strong>.</p>
          <p style="margin:0 0 10px;">Monto registrado: <strong>${amountText}</strong>${whenText ? ` · <strong>${whenText}</strong>` : ''}.</p>
          <p style="margin:0 0 10px;">Tu comisión (${ratePct}) por este pago: <strong>${commDeltaText}</strong>.</p>
          <p style="margin:0 0 10px;">Acumulado del período: Base <strong>${baseTotalText}</strong> · Comisión pendiente <strong>${commTotalText}</strong>.</p>
        `;

        try {
          await sendBillingEmail({
            to: agent.salesAgentEmail,
            subject: `Agendo · Comisión pendiente (${periodText})`,
            title: 'Registro de comisión (pendiente)',
            academyName: acadNameSafe,
            bodyHtml: agentBody,
            ctaText: 'Abrir facturación',
          });
        } catch (e) {
          console.error('Error enviando email a vendedor (commission pending)', e);
        }
      }
    } catch (e) {
      console.error('Error registrando comisión de vendedor (payment-registered)', e);
    }

    return NextResponse.json({ ok: true, notified: userIds.length, emailed: results.filter((r) => r.status === 'sent').length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error invoice-payment-registered' }, { status: 500 });
  }
}
