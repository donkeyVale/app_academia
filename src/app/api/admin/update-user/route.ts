import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';
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
          <p style="margin:0 0 10px;">Ya podés ingresar al sistema con tu correo y la contraseña inicial que te indicó tu academia (normalmente tu n.º de cédula).</p>
          <p style="margin:0 0 16px;">Una vez dentro, te recomendamos cambiar tu contraseña desde tu perfil para mayor seguridad.</p>
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
      currentUserId,
      userId,
      firstName,
      lastName,
      nationalId,
      phone,
      email,
      birthDate,
      roles,
      academyId,
      academyIsActive,
    } = body as {
      currentUserId?: string;
      userId?: string;
      firstName?: string;
      lastName?: string;
      nationalId?: string;
      phone?: string;
      email?: string;
      birthDate?: string;
      roles?: string[];
      academyId?: string;
      academyIsActive?: boolean;
    };

    if (!currentUserId) {
      return NextResponse.json({ error: 'currentUserId es requerido.' }, { status: 400 });
    }

    const { data: currentProfile, error: currentProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .maybeSingle();

    if (currentProfileErr) {
      return NextResponse.json({ error: 'No se pudo verificar permisos.' }, { status: 403 });
    }

    const currentRole = (currentProfile?.role as string | null) ?? null;
    const isSuperAdmin = currentRole === 'super_admin';
    const isAdmin = currentRole === 'admin';
    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 });
    }

    if (isAdmin) {
      if (!academyId) {
        return NextResponse.json({ error: 'academyId es requerido.' }, { status: 400 });
      }

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

      const { data: targetUa, error: targetUaErr } = await supabaseAdmin
        .from('user_academies')
        .select('id')
        .eq('user_id', userId)
        .eq('academy_id', academyId)
        .maybeSingle();
      if (targetUaErr || !targetUa) {
        return NextResponse.json({ error: 'No autorizado para editar este usuario.' }, { status: 403 });
      }
    }

    if (!firstName || !lastName || !nationalId || !phone || !email || !birthDate) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un rol.' },
        { status: 400 }
      );
    }

    const uniqueRoles = Array.from(new Set(roles));
    const allowedRoles = new Set(['admin', 'coach', 'student']);
    if (!uniqueRoles.every((r) => allowedRoles.has(r))) {
      return NextResponse.json({ error: 'Roles inválidos.' }, { status: 400 });
    }

    const { data: authBefore, error: authBeforeErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authBeforeErr) {
      return NextResponse.json(
        { error: authBeforeErr.message ?? 'No se pudo leer el usuario actual.' },
        { status: 400 },
      );
    }

    const previousEmail = (authBefore?.user?.email ?? '').trim().toLowerCase();
    const nextEmail = email.trim().toLowerCase();
    const emailChanged = !!nextEmail && previousEmail !== nextEmail;

    // Actualizar usuario en Auth
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        national_id: nationalId,
        phone,
        birth_date: birthDate,
      },
    });

    if (updateAuthError) {
      return NextResponse.json(
        { error: updateAuthError.message ?? 'No se pudo actualizar el usuario.' },
        { status: 400 }
      );
    }

    const fullName = `${firstName} ${lastName}`.trim();

    // Rol principal
    let mainRole: 'admin' | 'coach' | 'student' = 'student';
    if (uniqueRoles.includes('admin')) mainRole = 'admin';
    else if (uniqueRoles.includes('coach')) mainRole = 'coach';

    // Actualizar profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name: fullName, role: mainRole })
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message ?? 'No se pudo actualizar el perfil.' },
        { status: 400 }
      );
    }

    // Actualizar roles en user_roles (borrar y volver a insertar)
    const { error: deleteRolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteRolesError) {
      return NextResponse.json(
        { error: deleteRolesError.message ?? 'No se pudieron actualizar los roles.' },
        { status: 400 }
      );
    }

    const rolesPayload = uniqueRoles.map((role) => ({ user_id: userId, role }));

    const { error: insertRolesError } = await supabaseAdmin
      .from('user_roles')
      .insert(rolesPayload);

    if (insertRolesError) {
      return NextResponse.json(
        { error: insertRolesError.message ?? 'No se pudieron guardar los roles.' },
        { status: 400 }
      );
    }

    // Si el usuario tiene rol de profesor, asegurar su registro en coaches
    if (uniqueRoles.includes('coach')) {
      const { error: coachUpsertError } = await supabaseAdmin
        .from('coaches')
        .upsert({ user_id: userId }, { onConflict: 'user_id' });

      if (coachUpsertError) {
        return NextResponse.json(
          { error: coachUpsertError.message ?? 'No se pudo actualizar el registro de profesor.' },
          { status: 400 }
        );
      }
    }

    if (isSuperAdmin && academyId && typeof academyIsActive === 'boolean') {
      const { error: uaUpdateErr } = await supabaseAdmin
        .from('user_academies')
        .update({ is_active: academyIsActive })
        .eq('user_id', userId)
        .eq('academy_id', academyId);

      if (uaUpdateErr) {
        return NextResponse.json(
          { error: uaUpdateErr.message ?? 'No se pudo actualizar el estado del usuario en la academia.' },
          { status: 400 },
        );
      }
    }

    if (emailChanged && uniqueRoles.includes('student')) {
      try {
        await sendWelcomeEmail(email, fullName);
      } catch {
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado.' },
      { status: 500 }
    );
  }
}
