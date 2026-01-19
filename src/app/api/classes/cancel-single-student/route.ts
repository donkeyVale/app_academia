import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, studentId } = body || {};

    if (!classId || !studentId) {
      return NextResponse.json({ error: 'Faltan classId o studentId.' }, { status: 400 });
    }

    // Marcar uso de plan como devuelto (refund) para este alumno y clase (si existe)
    const { error: refundUsageErr } = await supabaseAdmin
      .from('plan_usages')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .in('status', ['pending', 'confirmed']);
    if (refundUsageErr) {
      console.error('Error marcando plan_usages como refunded en cancel-single-student', refundUsageErr.message);
      return NextResponse.json({ error: refundUsageErr.message }, { status: 500 });
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

    // Borrar asistencia del alumno para esta clase (si existe)
    const { error: delAttendanceErr } = await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);
    if (delAttendanceErr) {
      console.error('Error borrando attendance en cancel-single-student', delAttendanceErr.message);
      return NextResponse.json({ error: delAttendanceErr.message }, { status: 500 });
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

    let cancelledClass = false;

    if (!remainingCount || remainingCount === 0) {
      const { error: updClassErr } = await supabaseAdmin
        .from('class_sessions')
        .update({ status: 'cancelled' })
        .eq('id', classId);
      if (updClassErr) {
        console.error('Error marcando class_session como cancelled en cancel-single-student', updClassErr.message);
        return NextResponse.json({ error: updClassErr.message }, { status: 500 });
      }

      // Si la clase queda cancelada, limpiamos cualquier registro de asistencia residual
      const { error: delAttendanceClassErr } = await supabaseAdmin
        .from('attendance')
        .delete()
        .eq('class_id', classId);
      if (delAttendanceClassErr) {
        console.error('Error borrando attendance residual en cancel-single-student', delAttendanceClassErr.message);
        return NextResponse.json({ error: delAttendanceClassErr.message }, { status: 500 });
      }

      cancelledClass = true;
    }

    return NextResponse.json({ ok: true, cancelledClass, remainingCount: remainingCount ?? 0 });
  } catch (e: any) {
    console.error('Error en /api/classes/cancel-single-student', e);
    return NextResponse.json(
      { error: e?.message ?? 'Error cancelando la reserva desde el alumno' },
      { status: 500 },
    );
  }
}
