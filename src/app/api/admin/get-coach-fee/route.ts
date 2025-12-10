import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, userId, academyId } = body as {
      currentUserId?: string;
      userId?: string;
      academyId?: string;
    };

    if (!currentUserId || !userId || !academyId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: currentUserId, userId y academyId son obligatorios.' },
        { status: 400 },
      );
    }

    // Verificar rol del usuario actual
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

    // Si es admin, validar que pertenece a la academia indicada como admin
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
          { error: 'No está autorizado para ver datos de esta academia.' },
          { status: 403 },
        );
      }
    }

    const { data: coachRow, error: coachErr } = await supabaseAdmin
      .from('coaches')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (coachErr) {
      return NextResponse.json(
        { error: 'No se pudo obtener el profesor asociado a este usuario.' },
        { status: 500 },
      );
    }

    if (!coachRow) {
      return NextResponse.json({ feePerClass: null }, { status: 200 });
    }

    const coachId = coachRow.id as string;

    // Si es admin, validar que el coach pertenezca a la academia indicada
    if (isAdmin) {
      const { data: uaCoach, error: uaCoachErr } = await supabaseAdmin
        .from('user_academies')
        .select('id, role')
        .eq('user_id', userId)
        .eq('academy_id', academyId);

      if (uaCoachErr) {
        return NextResponse.json(
          { error: 'No se pudo verificar la asignación del profesor a la academia.' },
          { status: 500 },
        );
      }

      const uaCoachRows = (uaCoach ?? []) as { id: string; role: string | null }[];
      const isCoachOfAcademy = uaCoachRows.some((r) => (r.role ?? '').includes('coach'));
      if (!isCoachOfAcademy) {
        return NextResponse.json(
          { error: 'Este profesor no pertenece a la academia seleccionada.' },
          { status: 403 },
        );
      }
    }

    const { data: feeRow, error: feeErr } = await supabaseAdmin
      .from('coach_academy_fees')
      .select('fee_per_class')
      .eq('coach_id', coachId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (feeErr) {
      return NextResponse.json(
        { error: 'No se pudo obtener la tarifa del profesor para esta academia.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ feePerClass: feeRow?.fee_per_class ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado obteniendo tarifa del profesor.' },
      { status: 500 },
    );
  }
}
