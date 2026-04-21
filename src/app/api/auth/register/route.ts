import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabase-service';

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
          <p style="margin:0 0 16px;">Ya podés ingresar al sistema con tu correo y contraseña.</p>
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
    const body = await req.json();
    const {
      firstName,
      lastName,
      nationalId,
      phone,
      birthDate,
      email,
      password,
      academyCode,
    } = body as {
      firstName?: string;
      lastName?: string;
      nationalId?: string;
      phone?: string;
      birthDate?: string;
      email?: string;
      password?: string;
      academyCode?: string;
    };

    if (!firstName?.trim() || !lastName?.trim() || !nationalId?.trim() || !phone?.trim() || !birthDate?.trim() || !email?.trim() || !password?.trim() || !academyCode?.trim()) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios.' }, { status: 400 });
    }

    const trimmedAcademyCode = academyCode.trim();
    const normalizedAcademyCode = trimmedAcademyCode.toLowerCase();

    let academyRow: { id: string; name: string | null; is_suspended?: boolean | null } | null = null;

    const { data: academyExact } = await supabaseAdmin
      .from('academies')
      .select('id,name,is_suspended')
      .eq('slug', trimmedAcademyCode)
      .maybeSingle();

    academyRow = (academyExact as { id: string; name: string | null; is_suspended?: boolean | null } | null) ?? null;

    if (!academyRow && normalizedAcademyCode !== trimmedAcademyCode) {
      const { data: academyLower } = await supabaseAdmin
        .from('academies')
        .select('id,name,is_suspended')
        .eq('slug', normalizedAcademyCode)
        .maybeSingle();
      academyRow = (academyLower as { id: string; name: string | null; is_suspended?: boolean | null } | null) ?? null;
    }

    if (!academyRow?.id) {
      return NextResponse.json({ error: 'Código de academia inválido.' }, { status: 400 });
    }

    if (academyRow.is_suspended) {
      return NextResponse.json({ error: 'La academia está suspendida y no admite nuevos registros.' }, { status: 403 });
    }

    const normalizedIncomingPhone = phone.replace(/\s+/g, '');

    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;

    for (;;) {
      const { data: usersPage, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (usersError) {
        return NextResponse.json(
          { error: 'No se pudo verificar si el documento o teléfono ya están registrados.' },
          { status: 500 },
        );
      }

      const pageUsers = usersPage?.users ?? [];
      if (!pageUsers.length) break;
      allUsers.push(...pageUsers);
      if (pageUsers.length < perPage) break;
      page += 1;
    }

    const phoneTaken = allUsers.some((u) => {
      const metaPhone = (u.user_metadata?.phone as string | undefined) ?? '';
      return metaPhone.replace(/\s+/g, '') === normalizedIncomingPhone;
    });

    if (phoneTaken) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese número de teléfono.' }, { status: 400 });
    }

    const documentTaken = allUsers.some((u) => {
      const metaDoc = u.user_metadata?.national_id as string | undefined;
      if (!metaDoc) return false;
      return metaDoc === nationalId;
    });

    if (documentTaken) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese número de documento.' }, { status: 400 });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        national_id: nationalId.trim(),
        phone: phone.trim(),
        birth_date: birthDate.trim(),
        academy_code: normalizedAcademyCode,
        profile_completed_at: new Date().toISOString(),
      },
    });

    if (createError || !created?.user) {
      return NextResponse.json({ error: createError?.message ?? 'No se pudo crear el usuario.' }, { status: 400 });
    }

    const newUserId = created.user.id;
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: fullName,
        role: 'student',
        default_academy_id: academyRow.id,
      });

    if (profileInsertError) {
      return NextResponse.json({ error: profileInsertError.message ?? 'No se pudo crear el perfil.' }, { status: 400 });
    }

    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: newUserId, role: 'student' }, { onConflict: 'user_id,role' });

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message ?? 'No se pudo guardar el rol del usuario.' }, { status: 400 });
    }

    const { error: uaError } = await supabaseAdmin
      .from('user_academies')
      .upsert(
        {
          user_id: newUserId,
          academy_id: academyRow.id,
          role: 'student',
          is_active: true,
        },
        { onConflict: 'user_id,academy_id,role' },
      );

    if (uaError) {
      return NextResponse.json({ error: uaError.message ?? 'No se pudo vincular el usuario a la academia.' }, { status: 400 });
    }

    const { error: studentError } = await supabaseAdmin
      .from('students')
      .upsert({ user_id: newUserId, level: null, notes: null }, { onConflict: 'user_id' });

    if (studentError) {
      return NextResponse.json({ error: studentError.message ?? 'No se pudo crear el registro de jugador.' }, { status: 400 });
    }

    try {
      await sendWelcomeEmail(email.trim(), fullName);
    } catch {
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}
