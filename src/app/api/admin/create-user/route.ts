import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';
import { createClientServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      nationalId,
      phone,
      email,
      birthDate,
      roles,
    } = body as {
      firstName?: string;
      lastName?: string;
      nationalId?: string;
      phone?: string;
      email?: string;
      birthDate?: string;
      roles?: string[];
    };

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

    // Verificar que quien llama sea admin
    const supabaseServer = createClientServer();
    const { data: authData } = await supabaseServer.auth.getUser();
    const currentUser = authData.user;

    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: 'Error verificando permisos.' },
        { status: 500 }
      );
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo administradores pueden crear usuarios.' },
        { status: 403 }
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
      return NextResponse.json(
        { error: 'Usuario creado, pero falló la creación del perfil.' },
        { status: 500 }
      );
    }

    // Insertar roles en user_roles
    const uniqueRoles = Array.from(new Set(roles));
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado.' },
      { status: 500 }
    );
  }
}
