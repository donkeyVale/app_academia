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

type LocationFeePerStudentInput = {
  locationId: string;
  feePerStudent: number;
  validFrom: string; // yyyy-mm-dd
  timeFrom: string; // HH:mm
  timeTo: string; // HH:mm
};

type CourtFeePerStudentInput = {
  courtId: string;
  feePerStudent: number;
  validFrom: string; // yyyy-mm-dd
  timeFrom: string; // HH:mm
  timeTo: string; // HH:mm
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, academyId, locationFees, courtFees, locationFeesPerStudent, courtFeesPerStudent } = body as {
      currentUserId?: string;
      academyId?: string;
      locationFees?: LocationFeeInput[];
      courtFees?: CourtFeeInput[];
      locationFeesPerStudent?: LocationFeePerStudentInput[];
      courtFeesPerStudent?: CourtFeePerStudentInput[];
    };

    if (!currentUserId || !academyId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: currentUserId y academyId son obligatorios.' },
        { status: 400 },
      );
    }

    const locFees = Array.isArray(locationFees) ? locationFees : [];
    const cFees = Array.isArray(courtFees) ? courtFees : [];
    const locFeesPerStudent = Array.isArray(locationFeesPerStudent) ? locationFeesPerStudent : [];
    const cFeesPerStudent = Array.isArray(courtFeesPerStudent) ? courtFeesPerStudent : [];

    // Persistir eliminaciones: si una banda activa (valid_to IS NULL) ya no viene en el payload,
    // la cerramos seteando valid_to = hoy.
    const todayYmd = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // 1) Location bands per_student
    {
      const wanted = new Set(
        locFeesPerStudent
          .filter((r) => !!r?.locationId && !!r?.timeFrom && !!r?.timeTo)
          .map((r) => `${r.locationId}__${r.timeFrom}__${r.timeTo}`),
      );

      const { data: activeRows, error: actErr } = await supabaseAdmin
        .from('location_rent_fees_per_student')
        .select('id, location_id, time_from, time_to, valid_from')
        .eq('academy_id', academyId)
        .is('valid_to', null);

      if (actErr) {
        return NextResponse.json({ error: actErr.message }, { status: 500 });
      }

      for (const r of (activeRows ?? []) as any[]) {
        const lid = r.location_id as string | undefined;
        const tf = String(r.time_from ?? '').slice(0, 5);
        const tt = String(r.time_to ?? '').slice(0, 5);
        const id = r.id as string | undefined;
        const vf = r.valid_from as string | undefined;
        if (!id || !lid || !tf || !tt) continue;
        const key = `${lid}__${tf}__${tt}`;
        if (!wanted.has(key)) {
          if (vf && vf >= todayYmd) {
            const { error: delErr } = await supabaseAdmin
              .from('location_rent_fees_per_student')
              .delete()
              .eq('id', id);
            if (delErr) {
              return NextResponse.json({ error: delErr.message }, { status: 500 });
            }
          } else {
            const { error: closeErr } = await supabaseAdmin
              .from('location_rent_fees_per_student')
              .update({ valid_to: todayYmd, updated_at: nowIso })
              .eq('id', id);
            if (closeErr) {
              return NextResponse.json({ error: closeErr.message }, { status: 500 });
            }
          }
        }
      }
    }

    // 2) Court bands per_student
    {
      const wanted = new Set(
        cFeesPerStudent
          .filter((r) => !!r?.courtId && !!r?.timeFrom && !!r?.timeTo)
          .map((r) => `${r.courtId}__${r.timeFrom}__${r.timeTo}`),
      );

      const { data: activeRows, error: actErr } = await supabaseAdmin
        .from('court_rent_fees_per_student')
        .select('id, court_id, time_from, time_to, valid_from')
        .eq('academy_id', academyId)
        .is('valid_to', null);

      if (actErr) {
        return NextResponse.json({ error: actErr.message }, { status: 500 });
      }

      for (const r of (activeRows ?? []) as any[]) {
        const cid = r.court_id as string | undefined;
        const tf = String(r.time_from ?? '').slice(0, 5);
        const tt = String(r.time_to ?? '').slice(0, 5);
        const id = r.id as string | undefined;
        const vf = r.valid_from as string | undefined;
        if (!id || !cid || !tf || !tt) continue;
        const key = `${cid}__${tf}__${tt}`;
        if (!wanted.has(key)) {
          if (vf && vf >= todayYmd) {
            const { error: delErr } = await supabaseAdmin
              .from('court_rent_fees_per_student')
              .delete()
              .eq('id', id);
            if (delErr) {
              return NextResponse.json({ error: delErr.message }, { status: 500 });
            }
          } else {
            const { error: closeErr } = await supabaseAdmin
              .from('court_rent_fees_per_student')
              .update({ valid_to: todayYmd, updated_at: nowIso })
              .eq('id', id);
            if (closeErr) {
              return NextResponse.json({ error: closeErr.message }, { status: 500 });
            }
          }
        }
      }
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

    for (const row of locFeesPerStudent) {
      if (!row?.locationId || typeof row.locationId !== 'string') continue;
      const fee = Number(row.feePerStudent);
      if (Number.isNaN(fee) || fee < 0) continue;
      if (!row.validFrom || typeof row.validFrom !== 'string') continue;
      if (!row.timeFrom || typeof row.timeFrom !== 'string') continue;
      if (!row.timeTo || typeof row.timeTo !== 'string') continue;

      const { data: existingSameDate, error: sameDateErr } = await supabaseAdmin
        .from('location_rent_fees_per_student')
        .select('id')
        .eq('academy_id', academyId)
        .eq('location_id', row.locationId)
        .eq('valid_from', row.validFrom)
        .eq('time_from', row.timeFrom)
        .eq('time_to', row.timeTo)
        .is('valid_to', null)
        .maybeSingle();

      if (sameDateErr) {
        return NextResponse.json({ error: sameDateErr.message }, { status: 500 });
      }

      if (existingSameDate?.id) {
        const { error: updErr } = await supabaseAdmin
          .from('location_rent_fees_per_student')
          .update({ fee_per_student: fee, updated_at: new Date().toISOString() })
          .eq('id', existingSameDate.id);

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
        continue;
      }

      const { data: activeRow, error: activeErr } = await supabaseAdmin
        .from('location_rent_fees_per_student')
        .select('id')
        .eq('academy_id', academyId)
        .eq('location_id', row.locationId)
        .eq('time_from', row.timeFrom)
        .eq('time_to', row.timeTo)
        .is('valid_to', null)
        .maybeSingle();

      if (activeErr) {
        return NextResponse.json({ error: activeErr.message }, { status: 500 });
      }

      if (activeRow?.id) {
        const { error: closeErr } = await supabaseAdmin
          .from('location_rent_fees_per_student')
          .update({ valid_to: row.validFrom, updated_at: new Date().toISOString() })
          .eq('id', activeRow.id);

        if (closeErr) {
          return NextResponse.json({ error: closeErr.message }, { status: 500 });
        }
      }

      const { error: insErr } = await supabaseAdmin.from('location_rent_fees_per_student').insert({
        academy_id: academyId,
        location_id: row.locationId,
        fee_per_student: fee,
        valid_from: row.validFrom,
        time_from: row.timeFrom,
        time_to: row.timeTo,
      });

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    for (const row of cFeesPerStudent) {
      if (!row?.courtId || typeof row.courtId !== 'string') continue;
      const fee = Number(row.feePerStudent);
      if (Number.isNaN(fee) || fee < 0) continue;
      if (!row.validFrom || typeof row.validFrom !== 'string') continue;
      if (!row.timeFrom || typeof row.timeFrom !== 'string') continue;
      if (!row.timeTo || typeof row.timeTo !== 'string') continue;

      const { data: existingSameDate, error: sameDateErr } = await supabaseAdmin
        .from('court_rent_fees_per_student')
        .select('id')
        .eq('academy_id', academyId)
        .eq('court_id', row.courtId)
        .eq('valid_from', row.validFrom)
        .eq('time_from', row.timeFrom)
        .eq('time_to', row.timeTo)
        .is('valid_to', null)
        .maybeSingle();

      if (sameDateErr) {
        return NextResponse.json({ error: sameDateErr.message }, { status: 500 });
      }

      if (existingSameDate?.id) {
        const { error: updErr } = await supabaseAdmin
          .from('court_rent_fees_per_student')
          .update({ fee_per_student: fee, updated_at: new Date().toISOString() })
          .eq('id', existingSameDate.id);

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
        continue;
      }

      const { data: activeRow, error: activeErr } = await supabaseAdmin
        .from('court_rent_fees_per_student')
        .select('id')
        .eq('academy_id', academyId)
        .eq('court_id', row.courtId)
        .eq('time_from', row.timeFrom)
        .eq('time_to', row.timeTo)
        .is('valid_to', null)
        .maybeSingle();

      if (activeErr) {
        return NextResponse.json({ error: activeErr.message }, { status: 500 });
      }

      if (activeRow?.id) {
        const { error: closeErr } = await supabaseAdmin
          .from('court_rent_fees_per_student')
          .update({ valid_to: row.validFrom, updated_at: new Date().toISOString() })
          .eq('id', activeRow.id);

        if (closeErr) {
          return NextResponse.json({ error: closeErr.message }, { status: 500 });
        }
      }

      const { error: insErr } = await supabaseAdmin.from('court_rent_fees_per_student').insert({
        academy_id: academyId,
        court_id: row.courtId,
        fee_per_student: fee,
        valid_from: row.validFrom,
        time_from: row.timeFrom,
        time_to: row.timeTo,
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
