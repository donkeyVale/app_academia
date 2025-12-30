import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, academyId, rentMode } = body as {
      currentUserId?: string;
      academyId?: string;
      rentMode?: 'per_student' | 'per_hour' | 'both';
    };

    if (!currentUserId || !academyId || !rentMode) {
      return NextResponse.json(
        { error: 'Faltan parámetros: currentUserId, academyId y rentMode son obligatorios.' },
        { status: 400 },
      );
    }

    if (!['per_student', 'per_hour', 'both'].includes(rentMode)) {
      return NextResponse.json({ error: 'rentMode inválido.' }, { status: 400 });
    }

    const { data: currentProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json(
        { error: 'No se pudo verificar el rol del usuario actual.' },
        { status: 500 },
      );
    }

    const currentRole = (currentProfile?.role as string | null) ?? null;
    const isSuperAdmin = currentRole === 'super_admin';
    const isAdmin = currentRole === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    if (isAdmin) {
      const { data: uaAdmin, error: uaAdminErr } = await supabaseAdmin
        .from('user_academies')
        .select('id, role')
        .eq('user_id', currentUserId)
        .eq('academy_id', academyId);

      if (uaAdminErr) {
        return NextResponse.json(
          { error: 'No se pudo verificar la pertenencia del admin a la academia.' },
          { status: 500 },
        );
      }

      const uaAdminRows = (uaAdmin ?? []) as { id: string; role: string | null }[];
      const isAdminOfAcademy = uaAdminRows.some((r) => (r.role ?? '').includes('admin'));
      if (!isAdminOfAcademy) {
        return NextResponse.json(
          { error: 'No está autorizado para editar datos de esta academia.' },
          { status: 403 },
        );
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from('academies')
      .update({ rent_mode: rentMode })
      .eq('id', academyId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error en /api/admin/update-rent-mode', err);
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado actualizando rent_mode.' },
      { status: 500 },
    );
  }
}
