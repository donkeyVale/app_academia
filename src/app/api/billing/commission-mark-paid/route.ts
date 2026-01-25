import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabase-service';

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

async function sendEmail(params: {
  to: string;
  subject: string;
  title: string;
  bodyHtml: string;
  ctaHref?: string;
  ctaText?: string;
}) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!user || !pass || !from) return 'skipped' as const;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { salesAgentId, periodYear, periodMonth, paidAt } = body || {};

    if (!salesAgentId || typeof salesAgentId !== 'string') {
      return NextResponse.json({ error: 'Falta salesAgentId.' }, { status: 400 });
    }

    const y = Number(periodYear);
    const m = Number(periodMonth);
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
      return NextResponse.json({ error: 'Periodo inválido.' }, { status: 400 });
    }

    const paidAtIso = typeof paidAt === 'string' && paidAt ? paidAt : new Date().toISOString();

    const { data: row, error: rowErr } = await supabaseAdmin
      .from('billing_sales_commissions')
      .select('id,sales_agent_id,period_year,period_month,base_paid_amount,commission_rate,commission_amount,status')
      .eq('sales_agent_id', salesAgentId)
      .eq('period_year', y)
      .eq('period_month', m)
      .maybeSingle();

    if (rowErr) throw rowErr;
    if (!row) return NextResponse.json({ error: 'No existe comisión para ese período.' }, { status: 404 });

    const { error: updErr } = await supabaseAdmin
      .from('billing_sales_commissions')
      .update({ status: 'paid', paid_at: paidAtIso })
      .eq('id', (row as any).id);

    if (updErr) throw updErr;

    // email al vendedor (best effort)
    try {
      const { data: agent, error: agErr } = await supabaseAdmin
        .from('billing_sales_agents')
        .select('id,name,email')
        .eq('id', salesAgentId)
        .maybeSingle();
      if (agErr) throw agErr;

      const to = ((agent as any)?.email as string | undefined) ?? null;
      if (to) {
        const periodText = monthLabel(y, m);
        const commAmt = Number((row as any)?.commission_amount ?? 0);
        const baseAmt = Number((row as any)?.base_paid_amount ?? 0);
        const commText = `Gs. ${formatGs(commAmt)}`;
        const baseText = `Gs. ${formatGs(baseAmt)}`;
        const name = ((agent as any)?.name as string | undefined) ?? 'Vendedor';

        const bodyHtml = `
          <p style="margin:0 0 10px;">Hola <strong>${name}</strong>,</p>
          <p style="margin:0 0 10px;">Agendo registró el pago de tu comisión correspondiente al período <strong>${periodText}</strong>.</p>
          <p style="margin:0 0 10px;">Base pagada: <strong>${baseText}</strong></p>
          <p style="margin:0 0 10px;">Comisión pagada: <strong>${commText}</strong></p>
        `;

        await sendEmail({
          to,
          subject: `Agendo · Comisión pagada (${periodText})`,
          title: 'Comisión pagada',
          bodyHtml,
          ctaText: 'Ver facturación',
        });
      }
    } catch (e) {
      console.error('Error enviando email de comisión pagada', e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error commission-mark-paid' }, { status: 500 });
  }
}
