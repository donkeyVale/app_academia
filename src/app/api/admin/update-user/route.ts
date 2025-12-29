import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
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

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 });
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
    if (roles.includes('admin')) mainRole = 'admin';
    else if (roles.includes('coach')) mainRole = 'coach';

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

    const uniqueRoles = Array.from(new Set(roles));
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

    if (academyId && typeof academyIsActive === 'boolean') {
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado.' },
      { status: 500 }
    );
  }
}
