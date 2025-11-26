import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, studentId } = body || {};

    if (!classId || !studentId) {
      return NextResponse.json({ error: 'Faltan classId o studentId.' }, { status: 400 });
    }

    // Borrar uso de plan para este alumno y clase (si existe)
    const { error: delUsageErr } = await supabaseAdmin
      .from('plan_usages')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);
    if (delUsageErr) {
      console.error('Error borrando plan_usages en cancel-single-student', delUsageErr.message);
      return NextResponse.json({ error: delUsageErr.message }, { status: 500 });
    }

    // Borrar booking del alumno para esta clase (si existe)
    const { error: delBookingErr } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);
    if (delBookingErr) {
      console.error('Error borrando booking en cancel-single-student', delBookingErr.message);
      return NextResponse.json({ error: delBookingErr.message }, { status: 500 });
    }

    // Verificar si quedan más alumnos reservados en la clase
    const { count: remainingCount, error: countErr } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId);
    if (countErr) {
      console.error('Error contando bookings en cancel-single-student', countErr.message);
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    let deletedClass = false;

    if (!remainingCount || remainingCount === 0) {
      const { error: delClassErr } = await supabaseAdmin
        .from('class_sessions')
        .delete()
        .eq('id', classId);
      if (delClassErr) {
        console.error('Error borrando class_session en cancel-single-student', delClassErr.message);
        return NextResponse.json({ error: delClassErr.message }, { status: 500 });
      }
      deletedClass = true;
    }

    return NextResponse.json({ ok: true, deletedClass, remainingCount: remainingCount ?? 0 });
  } catch (e: any) {
    console.error('Error en /api/classes/cancel-single-student', e);
    return NextResponse.json(
      { error: e?.message ?? 'Error cancelando la reserva desde el alumno' },
      { status: 500 },
    );
  }
}
