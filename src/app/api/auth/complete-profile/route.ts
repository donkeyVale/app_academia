import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase-server';
import nodemailer from 'nodemailer';

async function sendWelcomeEmail(to: string, fullName: string) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!user || !pass || !from) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const safeName = fullName || to;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#0f172a; padding:32px 16px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.35);">
        <div style="background:linear-gradient(135deg,#0f172a,#1d3b4f,#3cadaf);padding:24px 24px 20px; text-align:center; color:#e5f6ff;">
          <img src="https://agendo.nativatech.com.py/icons/LogoAgendo1024.png" alt="Agendo" style="height:56px;width:auto;display:block;margin:0 auto 12px;" />
          <h1 style="margin:0;font-size:22px;font-weight:650;letter-spacing:0.03em;color:#ffffff;">Bienvenido a Agendo</h1>
        </div>
        <div style="padding:20px 24px 24px; color:#111827; font-size:14px; line-height:1.6;">
          <p style="margin:0 0 12px;">Hola <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 10px;">Tu usuario para <strong>Agendo</strong> ya fue creado.</p>
          <p style="margin:0 0 16px;">Ya podés ingresar al sistema con tu correo.</p>
          <div style="margin:18px 0 16px; text-align:center;">
            <a href="${process.env.APP_BASE_URL || ''}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#3cadaf;color:#ffffff;font-weight:600;font-size:13px;text-decoration:none;letter-spacing:0.03em;">Ir al panel de Agendo</a>
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Si no esperabas este correo, podés ignorarlo.</p>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: 'Bienvenido a Agendo',
    html,
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClientServer();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      nationalId,
      phone,
      birthDate,
    } = body as {
      firstName?: string;
      lastName?: string;
      nationalId?: string;
      phone?: string;
      birthDate?: string;
    };

    if (!phone?.trim() || !nationalId?.trim() || !birthDate?.trim()) {
      return NextResponse.json(
        { error: 'Completá teléfono, cédula y fecha de nacimiento.' },
        { status: 400 },
      );
    }

    const uid = userData.user.id;
    const currentMeta = (userData.user.user_metadata ?? {}) as any;
    const hadProfileCompletedAt = !!(currentMeta?.profile_completed_at);

    const nextFirstName = (firstName ?? currentMeta.first_name ?? '').trim();
    const nextLastName = (lastName ?? currentMeta.last_name ?? '').trim();
    const fullName = `${nextFirstName} ${nextLastName}`.trim();

    const { error: updAuthErr } = await supabase.auth.updateUser({
      data: {
        ...currentMeta,
        ...(nextFirstName ? { first_name: nextFirstName } : {}),
        ...(nextLastName ? { last_name: nextLastName } : {}),
        national_id: nationalId,
        phone,
        birth_date: birthDate,
        profile_completed_at: new Date().toISOString(),
      },
    });

    if (updAuthErr) {
      return NextResponse.json({ error: updAuthErr.message ?? 'No se pudo actualizar el usuario.' }, { status: 400 });
    }

    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert({
        id: uid,
        full_name: fullName || null,
        role: 'student',
      });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message ?? 'No se pudo actualizar el perfil.' }, { status: 400 });
    }

    try {
      const email = userData.user.email ?? '';
      if (email && !hadProfileCompletedAt) await sendWelcomeEmail(email, fullName);
    } catch {
      // no bloquear
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}
