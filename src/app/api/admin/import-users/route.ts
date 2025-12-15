import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';
import nodemailer from 'nodemailer';

async function sendWelcomeEmail(to: string, fullName: string): Promise<'sent' | 'skipped'> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!user || !pass || !from) {
    return 'skipped';
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

  return 'sent';
}

// Tipo de una fila proveniente del CSV (ya parseada en el frontend)
type IncomingRow = {
  nombre?: string;
  apellido?: string;
  numero_de_documento?: string;
  telefono?: string;
  correo?: string;
  fecha_de_nacimiento?: string; // DD/MM/YYYY (se almacena como string, igual que en create-user)
  role?: string; // 'admin' | 'coach' | 'student'
  academias?: string; // UUIDs separados por ';'
};

type RowResult = {
  index: number; // índice de la fila en el array recibido
  status: 'ok' | 'error';
  message: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = (body?.rows as IncomingRow[] | undefined) ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No se recibieron filas para importar.' },
        { status: 400 },
      );
    }

    // 1) Cargar todos los usuarios existentes una sola vez para validar duplicados
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;

    for (;;) {
      const { data: usersPage, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (usersError) {
        return NextResponse.json(
          { error: 'No se pudo verificar si el documento, teléfono o correo ya están registrados.' },
          { status: 500 },
        );
      }

      const pageUsers = usersPage?.users ?? [];
      if (!pageUsers.length) break;

      allUsers.push(...pageUsers);

      if (pageUsers.length < perPage) break;
      page += 1;
    }

    // Índices rápidos por email, documento y teléfono ya existentes
    const existingEmails = new Set<string>();
    const existingDocs = new Set<string>();
    const existingPhones = new Set<string>();

    for (const u of allUsers) {
      const email = (u.email as string | undefined)?.toLowerCase();
      if (email) existingEmails.add(email);

      const metaDoc = u.user_metadata?.national_id as string | undefined;
      if (metaDoc) existingDocs.add(metaDoc);

      const metaPhone = (u.user_metadata?.phone as string | undefined) ?? '';
      if (metaPhone) existingPhones.add(metaPhone.replace(/\s+/g, ''));
    }

    // Para evitar duplicados dentro del mismo batch
    const batchEmails = new Set<string>();
    const batchDocs = new Set<string>();
    const batchPhones = new Set<string>();

    // 2) Cargar academias existentes para validar IDs
    const { data: academiesData, error: academiesError } = await supabaseAdmin
      .from('academies')
      .select('id');

    if (academiesError) {
      return NextResponse.json(
        { error: 'No se pudieron cargar las academias para validar el archivo.' },
        { status: 500 },
      );
    }

    const validAcademyIds = new Set(
      ((academiesData as { id: string }[] | null) ?? []).map((a) => a.id),
    );

    const results: RowResult[] = [];

    // 3) Procesar fila por fila
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const nombre = (row.nombre ?? '').trim();
      const apellido = (row.apellido ?? '').trim();
      const numeroDeDocumento = (row.numero_de_documento ?? '').trim();
      const telefonoRaw = (row.telefono ?? '').trim();
      const correoRaw = (row.correo ?? '').trim();
      const fechaNacimiento = (row.fecha_de_nacimiento ?? '').trim();
      const role = (row.role ?? '').trim().toLowerCase();
      const academiasField = (row.academias ?? '').trim();

      // Validaciones básicas de campos obligatorios
      if (!nombre || !apellido || !numeroDeDocumento || !telefonoRaw || !correoRaw || !fechaNacimiento) {
        results.push({
          index: i,
          status: 'error',
          message:
            'Faltan campos obligatorios (nombre, apellido, número de documento, teléfono, correo o fecha de nacimiento).',
        });
        continue;
      }

      if (!['admin', 'coach', 'student'].includes(role)) {
        results.push({
          index: i,
          status: 'error',
          message: 'El valor de "role" debe ser admin, coach o student.',
        });
        continue;
      }

      // Academias: puede ser vacío, pero si viene algo lo validamos
      let academyIdsForUser: string[] = [];
      if (academiasField) {
        academyIdsForUser = academiasField
          .split(';')
          .map((id) => id.trim())
          .filter((id) => !!id);

        const invalidAcademies = academyIdsForUser.filter((id) => !validAcademyIds.has(id));
        if (invalidAcademies.length > 0) {
          results.push({
            index: i,
            status: 'error',
            message: `Las siguientes academias no existen o son inválidas: ${invalidAcademies.join(', ')}.`,
          });
          continue;
        }
      }

      const email = correoRaw.toLowerCase();
      const normalizedPhone = telefonoRaw.replace(/\s+/g, '');

      // Duplicados contra base existente
      if (existingDocs.has(numeroDeDocumento) || batchDocs.has(numeroDeDocumento)) {
        results.push({
          index: i,
          status: 'error',
          message: 'Ya existe un usuario con ese número de documento.',
        });
        continue;
      }

      if (existingPhones.has(normalizedPhone) || batchPhones.has(normalizedPhone)) {
        results.push({
          index: i,
          status: 'error',
          message: 'Ya existe un usuario con ese número de teléfono.',
        });
        continue;
      }

      if (existingEmails.has(email) || batchEmails.has(email)) {
        results.push({
          index: i,
          status: 'error',
          message: 'Ya existe un usuario con ese correo electrónico.',
        });
        continue;
      }

      // Si pasamos todas las validaciones, intentamos crear el usuario
      const roles = [role];

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: numeroDeDocumento,
        email_confirm: true,
        user_metadata: {
          first_name: nombre,
          last_name: apellido,
          national_id: numeroDeDocumento,
          phone: telefonoRaw,
          birth_date: fechaNacimiento,
        },
      });

      if (createError || !created?.user) {
        results.push({
          index: i,
          status: 'error',
          message: createError?.message ?? 'No se pudo crear el usuario en Auth.',
        });
        continue;
      }

      const newUserId = created.user.id as string;
      const fullName = `${nombre} ${apellido}`.trim();

      // Rol principal para profiles
      let mainRole: 'admin' | 'coach' | 'student' = 'student';
      if (roles.includes('admin')) mainRole = 'admin';
      else if (roles.includes('coach')) mainRole = 'coach';

      const { error: profileInsertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUserId,
          full_name: fullName,
          role: mainRole,
        });

      if (profileInsertError) {
        results.push({
          index: i,
          status: 'error',
          message: 'Usuario creado en Auth, pero falló la creación del perfil.',
        });
        continue;
      }

      // Insertar roles en user_roles (único rol por ahora)
      const uniqueRoles = Array.from(new Set(roles));
      const rolesPayload = uniqueRoles.map((r) => ({ user_id: newUserId, role: r }));

      const { error: rolesError } = await supabaseAdmin.from('user_roles').insert(rolesPayload);

      if (rolesError) {
        results.push({
          index: i,
          status: 'error',
          message: 'Perfil creado, pero falló el guardado de roles.',
        });
        continue;
      }

      // Si el usuario tiene rol de alumno, crear también su registro en students (igual que create-user)
      if (uniqueRoles.includes('student')) {
        const { error: studentInsertError } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: newUserId,
            level: null,
            notes: null,
          });

        if (studentInsertError) {
          results.push({
            index: i,
            status: 'error',
            message: 'Usuario creado, pero falló la creación del registro de alumno.',
          });
          continue;
        }
      }

      // Asignar academias en user_academies
      if (academyIdsForUser.length > 0) {
        const uaPayload = academyIdsForUser.map((academyId) => ({
          user_id: newUserId,
          academy_id: academyId,
          role: mainRole,
        }));

        const { error: uaError } = await supabaseAdmin.from('user_academies').insert(uaPayload);

        if (uaError) {
          results.push({
            index: i,
            status: 'error',
            message: 'Usuario creado, pero falló la asignación de academias.',
          });
          continue;
        }
      }

      // Enviar correo de bienvenida (si falla, no rompe la importación)
      try {
        const emailStatus = await sendWelcomeEmail(email, fullName);
        if (emailStatus === 'skipped') {
          console.warn('SMTP no configurado; se omitió el envío de correo en import-users', { email });
        }
      } catch (emailError) {
        console.error('Error enviando correo de bienvenida en import-users', { email, error: String((emailError as any)?.message ?? emailError) });
      }

      // Marcar como éxito y actualizar índices de duplicados para esta sesión
      batchDocs.add(numeroDeDocumento);
      batchPhones.add(normalizedPhone);
      batchEmails.add(email);

      results.push({
        index: i,
        status: 'ok',
        message: 'Usuario importado correctamente.',
      });
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado procesando la importación.' },
      { status: 500 },
    );
  }
}
