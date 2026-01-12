import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';
import nodemailer from 'nodemailer';
// @ts-ignore - web-push no tiene tipos instalados en este proyecto
import webPush from 'web-push';
import { createInAppNotifications } from '@/lib/in-app-notifications';

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

async function sendAdminCreatedUserEmail(params: {
  to: string;
  academyName: string;
  adminName: string;
  newUserName: string;
  newUserEmail: string;
  newUserRoles: string[];
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

  const rolesLine = params.newUserRoles?.length
    ? `<p style="margin:0 0 10px;"><strong>Roles:</strong> ${params.newUserRoles.join(', ')}</p>`
    : '';

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#0f172a; padding:32px 16px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.35);">
        <div style="background:linear-gradient(135deg,#0f172a,#1d3b4f,#3cadaf);padding:24px 24px 20px; text-align:center; color:#e5f6ff;">
          <img src="https://agendo.nativatech.com.py/icons/LogoAgendo1024.png" alt="Agendo" style="height:56px;width:auto;display:block;margin:0 auto 12px;" />
          <h1 style="margin:0;font-size:20px;font-weight:650;letter-spacing:0.02em;color:#ffffff;">Nuevo usuario creado por admin</h1>
        </div>
        <div style="padding:20px 24px 24px; color:#111827; font-size:14px; line-height:1.6;">
          <p style="margin:0 0 12px;">Se creó un usuario desde una academia (acción de admin).</p>
          <p style="margin:0 0 10px;"><strong>Academia:</strong> ${params.academyName}</p>
          <p style="margin:0 0 10px;"><strong>Creado por:</strong> ${params.adminName}</p>
          <p style="margin:0 0 10px;"><strong>Usuario nuevo:</strong> ${params.newUserName}</p>
          <p style="margin:0 0 10px;"><strong>Email:</strong> ${params.newUserEmail}</p>
          ${rolesLine}
          <div style="margin:18px 0 16px; text-align:center;">
            <a href="${process.env.APP_BASE_URL || ''}/users" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#3cadaf;color:#ffffff;font-weight:600;font-size:13px;text-decoration:none;letter-spacing:0.03em;">Abrir Usuarios</a>
          </div>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: params.to,
    subject: 'Alta de usuario (creado por admin de academia)',
    html,
  });

  return 'sent' as const;
}

async function sendWelcomeEmail(to: string, fullName: string) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!user || !pass || !from) {
    // Falta configuración SMTP; no enviamos correo pero tampoco fallamos
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
      academyId,
      firstName,
      lastName,
      nationalId,
      phone,
      email,
      birthDate,
      roles,
    } = body as {
      currentUserId?: string;
      academyId?: string;
      firstName?: string;
      lastName?: string;
      nationalId?: string;
      phone?: string;
      email?: string;
      birthDate?: string;
      roles?: string[];
    };

    if (!currentUserId) {
      return NextResponse.json({ error: 'currentUserId es requerido.' }, { status: 400 });
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
    const isSuperAdmin = currentRole === 'super_admin';
    const isAdmin = currentRole === 'admin';
    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
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

    // Verificar duplicados de documento y teléfono en metadata de usuarios existentes
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;

    // Paginamos por si hay muchos usuarios, aunque lo normal es que la lista sea pequeña
    for (;;) {
      const { data: usersPage, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (usersError) {
        return NextResponse.json(
          { error: 'No se pudo verificar si el documento o teléfono ya están registrados.' },
          { status: 500 }
        );
      }

      const pageUsers = usersPage?.users ?? [];
      if (!pageUsers.length) break;

      allUsers.push(...pageUsers);

      if (pageUsers.length < perPage) break;
      page += 1;
    }

    const normalizedIncomingPhone = phone.replace(/\s+/g, '');

    const phoneTaken = allUsers.some((u) => {
      const metaPhone = (u.user_metadata?.phone as string | undefined) ?? '';
      return metaPhone.replace(/\s+/g, '') === normalizedIncomingPhone;
    });

    if (phoneTaken) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese número de teléfono.' },
        { status: 400 }
      );
    }

    const documentTaken = allUsers.some((u) => {
      const metaDoc = u.user_metadata?.national_id as string | undefined;
      if (!metaDoc) return false;
      return metaDoc === nationalId;
    });

    if (documentTaken) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese número de documento.' },
        { status: 400 }
      );
    }

    // Crear usuario en Auth con contraseña = nro de cédula
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: nationalId,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        national_id: nationalId,
        phone,
        birth_date: birthDate,
      },
    });

    if (createError || !created?.user) {
      return NextResponse.json(
        { error: createError?.message ?? 'No se pudo crear el usuario.' },
        { status: 400 }
      );
    }

    const newUserId = created.user.id;
    const fullName = `${firstName} ${lastName}`.trim();

    // Definir un rol principal para profiles
    let mainRole: 'admin' | 'coach' | 'student' = 'student';
    if (uniqueRoles.includes('admin')) mainRole = 'admin';
    else if (uniqueRoles.includes('coach')) mainRole = 'coach';

    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        full_name: fullName,
        role: mainRole,
      });

    if (profileInsertError) {
      return NextResponse.json(
        { error: 'Usuario creado, pero falló la creación del perfil.' },
        { status: 500 }
      );
    }

    // Insertar roles en user_roles
    const rolesPayload = uniqueRoles.map((role) => ({ user_id: newUserId, role }));

    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .insert(rolesPayload);

    if (rolesError) {
      return NextResponse.json(
        { error: 'Perfil creado, pero falló el guardado de roles.' },
        { status: 500 }
      );
    }

    if (academyId) {
      const { error: uaInsertError } = await supabaseAdmin
        .from('user_academies')
        .upsert(
          {
            user_id: newUserId,
            academy_id: academyId,
            role: mainRole,
            is_active: true,
          },
          { onConflict: 'user_id,academy_id,role' },
        );

      if (uaInsertError) {
        return NextResponse.json(
          { error: uaInsertError.message ?? 'Usuario creado, pero falló la asignación a la academia.' },
          { status: 400 },
        );
      }
    }

    // Si el usuario tiene rol de profesor, asegurar su registro en coaches
    if (uniqueRoles.includes('coach')) {
      const { error: coachUpsertError } = await supabaseAdmin
        .from('coaches')
        .upsert({ user_id: newUserId }, { onConflict: 'user_id' });

      if (coachUpsertError) {
        return NextResponse.json(
          { error: 'Usuario creado, pero falló la creación del registro de profesor.' },
          { status: 500 }
        );
      }
    }

    // Si el usuario tiene rol de alumno, crear también su registro en students
    if (uniqueRoles.includes('student')) {
      const { error: studentInsertError } = await supabaseAdmin
        .from('students')
        .insert({
          user_id: newUserId,
          level: null,
          notes: null,
        });

      if (studentInsertError) {
        return NextResponse.json(
          { error: 'Usuario creado, pero falló la creación del registro de alumno.' },
          { status: 500 }
        );
      }
    }

    try {
      await sendWelcomeEmail(email, fullName);
    } catch (emailError) {
      // El fallo al enviar correo no debe impedir la creación del usuario
    }

    if (isAdmin && academyId) {
      try {
        const { data: academyRow } = await supabaseAdmin
          .from('academies')
          .select('name')
          .eq('id', academyId)
          .maybeSingle();

        const academyName = ((academyRow as any)?.name as string | undefined) ?? academyId;
        const adminName = ((currentProfile as any)?.full_name as string | undefined) ?? currentUserId;

        const { data: superAdmins } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('role', 'super_admin');

        const superAdminIds = Array.from(
          new Set(((superAdmins ?? []) as any[]).map((r) => (r as any).id).filter((id) => typeof id === 'string' && id)),
        ) as string[];

        if (superAdminIds.length > 0) {
          const title = 'Usuario creado por admin de academia';
          const rolesText = uniqueRoles.length ? uniqueRoles.join(', ') : '-';
          const bodyText = `${adminName} creó a ${fullName} (${email}) en ${academyName}. Rol(es): ${rolesText}.`;

          await createInAppNotifications(
            superAdminIds.map((id) => ({
              user_id: id,
              type: 'user_created_by_admin',
              title,
              body: bodyText,
              data: {
                academyId,
                academyName,
                createdByUserId: currentUserId,
                createdByName: adminName,
                newUserId,
                newUserName: fullName,
                newUserEmail: email,
                newUserRoles: uniqueRoles,
              },
            })),
          );

          await sendPushToUsers(superAdminIds, {
            title,
            body: bodyText,
            data: {
              url: '/users',
              academyId,
              newUserId,
            },
          });

          await Promise.allSettled(
            superAdminIds.map(async (id) => {
              const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(id);
              if (userErr) return { status: 'skipped' as const };
              const superAdminEmail = (userData?.user?.email ?? '').trim();
              if (!superAdminEmail) return { status: 'skipped' as const };
              return {
                status: await sendAdminCreatedUserEmail({
                  to: superAdminEmail,
                  academyName,
                  adminName,
                  newUserName: fullName,
                  newUserEmail: email,
                  newUserRoles: uniqueRoles,
                }),
              };
            }),
          );
        }
      } catch {
        // no-op: la creación no depende de las notificaciones
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
