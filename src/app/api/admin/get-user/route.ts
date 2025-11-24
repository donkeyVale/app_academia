import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body as { userId?: string };

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 });
    }

    // Obtener usuario desde Auth (incluye email y user_metadata)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'No se pudo obtener el usuario.' },
        { status: 400 }
      );
    }

    const user = authData.user;
    const meta = (user.user_metadata ?? {}) as any;

    // Obtener perfil principal
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message ?? 'No se pudo obtener el perfil.' },
        { status: 400 }
      );
    }

    // Obtener roles asignados
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (rolesError) {
      return NextResponse.json(
        { error: rolesError.message ?? 'No se pudieron obtener los roles.' },
        { status: 400 }
      );
    }

    const roles = (rolesData ?? []).map((r: any) => r.role as string);

    const response = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      full_name: profile?.full_name ?? null,
      main_role: profile?.role ?? null,
      roles,
      firstName: (meta.first_name as string | undefined) ?? null,
      lastName: (meta.last_name as string | undefined) ?? null,
      nationalId: (meta.national_id as string | undefined) ?? null,
      metaPhone: (meta.phone as string | undefined) ?? null,
      birthDate: (meta.birth_date as string | undefined) ?? null,
    };

    return NextResponse.json({ user: response });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado.' },
      { status: 500 }
    );
  }
}
