import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { academyId, studentId, amount, currency = 'PYG', paymentDate } = body || {};

    if (!academyId || typeof academyId !== 'string') {
      return NextResponse.json({ error: 'Falta academyId.' }, { status: 400 });
    }

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json({ error: 'Falta studentId.' }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'Claves VAPID no configuradas.' }, { status: 500 });
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);

    // Destinatarios: admins asignados a esta academia
    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('user_id, role')
      .eq('academy_id', academyId);

    if (uaErr) {
      return NextResponse.json({ error: uaErr.message }, { status: 500 });
    }

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

    // Respetar preferencia de notificaciones en profiles.notifications_enabled
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, notifications_enabled')
      .in('id', adminUserIds);

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const allowedUserIds = new Set<string>();
    for (const row of profiles ?? []) {
      const enabled = (row as any).notifications_enabled;
      if (enabled === false) continue;
      allowedUserIds.add((row as any).id as string);
    }

    if (allowedUserIds.size === 0) {
      return NextResponse.json({ error: 'Ningún admin tiene activadas las notificaciones.' }, { status: 404 });
    }

    // Enriquecer con nombre del alumno si es posible
    let studentName: string | null = null;
    try {
      const { data: studentRow, error: stErr } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('id', studentId)
        .maybeSingle();
      if (!stErr && studentRow?.user_id) {
        const { data: prof, error: pErr } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', studentRow.user_id)
          .maybeSingle();
        if (!pErr) studentName = (prof as any)?.full_name ?? null;
      }
    } catch {
      // ignorar
    }

    let when = '';
    try {
      if (paymentDate) {
        const d = new Date(String(paymentDate) + 'T00:00:00');
        when = d.toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' });
      }
    } catch {
      // ignorar
    }

    const bodyText = `${studentName ? studentName + ': ' : ''}${amountNum} ${currency}${when ? ` (${when})` : ''}`;

    const payload = JSON.stringify({
      title: 'Pago registrado',
      body: bodyText,
      data: { url: '/finance' },
    });

    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(allowedUserIds));

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'No hay suscripciones registradas para los admins objetivo.' }, { status: 404 });
    }

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
    console.error('Error en /api/push/payment-registered', e);
    return NextResponse.json({ error: e?.message ?? 'Error enviando notificación de pago registrado' }, { status: 500 });
  }
}
