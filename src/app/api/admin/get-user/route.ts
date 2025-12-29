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

    const { data: uaRows, error: uaErr } = await supabaseAdmin
      .from('user_academies')
      .select('academy_id, is_active')
      .eq('user_id', userId);

    if (uaErr) {
      return NextResponse.json(
        { error: uaErr.message ?? 'No se pudieron obtener las academias del usuario.' },
        { status: 400 },
      );
    }

    const ua = ((uaRows ?? []) as { academy_id: string | null; is_active: boolean | null }[]).filter(
      (r) => !!r.academy_id,
    ) as { academy_id: string; is_active: boolean | null }[];

    const academyIds = Array.from(new Set(ua.map((r) => r.academy_id)));
    let academies: { academy_id: string; academy_name: string; is_active: boolean }[] = [];
    if (academyIds.length > 0) {
      const { data: acadRows, error: acadErr } = await supabaseAdmin
        .from('academies')
        .select('id, name')
        .in('id', academyIds);

      if (acadErr) {
        return NextResponse.json(
          { error: acadErr.message ?? 'No se pudieron obtener los nombres de academias.' },
          { status: 400 },
        );
      }

      const nameMap: Record<string, string> = {};
      (acadRows ?? []).forEach((a: any) => {
        if (!a?.id) return;
        nameMap[a.id as string] = (a.name as string | null) ?? (a.id as string);
      });

      academies = ua.map((r) => ({
        academy_id: r.academy_id,
        academy_name: nameMap[r.academy_id] ?? r.academy_id,
        is_active: (r.is_active ?? true) === true,
      }));
    }

    const response = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      full_name: profile?.full_name ?? null,
      main_role: profile?.role ?? null,
      roles,
      academies,
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
