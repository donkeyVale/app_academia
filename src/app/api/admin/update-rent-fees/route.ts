import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

type LocationFeeInput = {
  locationId: string;
  feePerClass: number;
  validFrom: string; // yyyy-mm-dd
};

type CourtFeeInput = {
  courtId: string;
  feePerClass: number;
  validFrom: string; // yyyy-mm-dd
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, academyId, locationFees, courtFees } = body as {
      currentUserId?: string;
      academyId?: string;
      locationFees?: LocationFeeInput[];
      courtFees?: CourtFeeInput[];
    };

    if (!currentUserId || !academyId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: currentUserId y academyId son obligatorios.' },
        { status: 400 },
      );
    }

    const locFees = Array.isArray(locationFees) ? locationFees : [];
    const cFees = Array.isArray(courtFees) ? courtFees : [];

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
        return NextResponse.json(
          { error: 'No está autorizado para editar datos de esta academia.' },
          { status: 403 },
        );
      }
    }

    for (const row of locFees) {
      if (!row?.locationId || typeof row.locationId !== 'string') continue;
      const fee = Number(row.feePerClass);
      if (Number.isNaN(fee) || fee < 0) continue;
      if (!row.validFrom || typeof row.validFrom !== 'string') continue;

      const { data: existingSameDate, error: sameDateErr } = await supabaseAdmin
        .from('location_rent_fees')
        .select('id')
        .eq('academy_id', academyId)
        .eq('location_id', row.locationId)
        .eq('valid_from', row.validFrom)
        .is('valid_to', null)
        .maybeSingle();

      if (sameDateErr) {
        return NextResponse.json({ error: sameDateErr.message }, { status: 500 });
      }

      if (existingSameDate?.id) {
        const { error: updErr } = await supabaseAdmin
          .from('location_rent_fees')
          .update({ fee_per_class: fee, updated_at: new Date().toISOString() })
          .eq('id', existingSameDate.id);

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
        continue;
      }

      const { data: activeRow, error: activeErr } = await supabaseAdmin
        .from('location_rent_fees')
        .select('id, valid_from')
        .eq('academy_id', academyId)
        .eq('location_id', row.locationId)
        .is('valid_to', null)
        .maybeSingle();

      if (activeErr) {
        return NextResponse.json({ error: activeErr.message }, { status: 500 });
      }

      if (activeRow?.id) {
        const { error: closeErr } = await supabaseAdmin
          .from('location_rent_fees')
          .update({ valid_to: row.validFrom, updated_at: new Date().toISOString() })
          .eq('id', activeRow.id);

        if (closeErr) {
          return NextResponse.json({ error: closeErr.message }, { status: 500 });
        }
      }

      const { error: insErr } = await supabaseAdmin.from('location_rent_fees').insert({
        academy_id: academyId,
        location_id: row.locationId,
        fee_per_class: fee,
        valid_from: row.validFrom,
      });

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    for (const row of cFees) {
      if (!row?.courtId || typeof row.courtId !== 'string') continue;
      const fee = Number(row.feePerClass);
      if (Number.isNaN(fee) || fee < 0) continue;
      if (!row.validFrom || typeof row.validFrom !== 'string') continue;

      const { data: existingSameDate, error: sameDateErr } = await supabaseAdmin
        .from('court_rent_fees')
        .select('id')
        .eq('academy_id', academyId)
        .eq('court_id', row.courtId)
        .eq('valid_from', row.validFrom)
        .is('valid_to', null)
        .maybeSingle();

      if (sameDateErr) {
        return NextResponse.json({ error: sameDateErr.message }, { status: 500 });
      }

      if (existingSameDate?.id) {
        const { error: updErr } = await supabaseAdmin
          .from('court_rent_fees')
          .update({ fee_per_class: fee, updated_at: new Date().toISOString() })
          .eq('id', existingSameDate.id);

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
        continue;
      }

      const { data: activeRow, error: activeErr } = await supabaseAdmin
        .from('court_rent_fees')
        .select('id, valid_from')
        .eq('academy_id', academyId)
        .eq('court_id', row.courtId)
        .is('valid_to', null)
        .maybeSingle();

      if (activeErr) {
        return NextResponse.json({ error: activeErr.message }, { status: 500 });
      }

      if (activeRow?.id) {
        const { error: closeErr } = await supabaseAdmin
          .from('court_rent_fees')
          .update({ valid_to: row.validFrom, updated_at: new Date().toISOString() })
          .eq('id', activeRow.id);

        if (closeErr) {
          return NextResponse.json({ error: closeErr.message }, { status: 500 });
        }
      }

      const { error: insErr } = await supabaseAdmin.from('court_rent_fees').insert({
        academy_id: academyId,
        court_id: row.courtId,
        fee_per_class: fee,
        valid_from: row.validFrom,
      });

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error en /api/admin/update-rent-fees', err);
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado actualizando alquileres.' },
      { status: 500 },
    );
  }
}
