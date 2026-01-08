import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, academyId } = body as {
      currentUserId?: string;
      academyId?: string;
    };

    if (!currentUserId || !academyId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: currentUserId y academyId son obligatorios.' },
        { status: 400 },
      );
    }

    const { data: currentProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: 'No se pudo verificar el rol del usuario actual.' }, { status: 500 });
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
        return NextResponse.json({ error: 'No está autorizado para ver datos de esta academia.' }, { status: 403 });
      }
    }

    const { data: locationFees, error: locErr } = await supabaseAdmin
      .from('location_rent_fees')
      .select('id, academy_id, location_id, fee_per_class, currency, valid_from, valid_to')
      .eq('academy_id', academyId)
      .is('valid_to', null);

    if (locErr) {
      return NextResponse.json({ error: locErr.message }, { status: 500 });
    }

    const { data: courtFees, error: courtErr } = await supabaseAdmin
      .from('court_rent_fees')
      .select('id, academy_id, court_id, fee_per_class, currency, valid_from, valid_to')
      .eq('academy_id', academyId)
      .is('valid_to', null);

    if (courtErr) {
      return NextResponse.json({ error: courtErr.message }, { status: 500 });
    }

    const { data: locationFeesPerStudent, error: locPsErr } = await supabaseAdmin
      .from('location_rent_fees_per_student')
      .select(
        'id, academy_id, location_id, fee_per_student, fee_per_student_one, fee_per_student_two_plus, currency, valid_from, valid_to, time_from, time_to',
      )
      .eq('academy_id', academyId)
      .is('valid_to', null);

    if (locPsErr) {
      return NextResponse.json({ error: locPsErr.message }, { status: 500 });
    }

    const { data: courtFeesPerStudent, error: courtPsErr } = await supabaseAdmin
      .from('court_rent_fees_per_student')
      .select(
        'id, academy_id, court_id, fee_per_student, fee_per_student_one, fee_per_student_two_plus, currency, valid_from, valid_to, time_from, time_to',
      )
      .eq('academy_id', academyId)
      .is('valid_to', null);

    if (courtPsErr) {
      return NextResponse.json({ error: courtPsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      locationFees: locationFees ?? [],
      courtFees: courtFees ?? [],
      locationFeesPerStudent: locationFeesPerStudent ?? [],
      courtFeesPerStudent: courtFeesPerStudent ?? [],
    });
  } catch (err: any) {
    console.error('Error en /api/admin/get-rent-fees', err);
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado obteniendo alquileres.' },
      { status: 500 },
    );
  }
}
