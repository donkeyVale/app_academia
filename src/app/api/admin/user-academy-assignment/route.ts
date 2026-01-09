import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      currentUserId,
      userId,
      academyId,
      role,
    } = body as {
      currentUserId?: string;
      userId?: string;
      academyId?: string;
      role?: 'admin' | 'coach' | 'student';
    };

    if (!currentUserId) {
      return NextResponse.json({ error: 'currentUserId es requerido.' }, { status: 400 });
    }

    const { data: currentProfile, error: currentProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .maybeSingle();

    if (currentProfileErr) {
      return NextResponse.json({ error: 'No se pudo verificar permisos.' }, { status: 403 });
    }

    if ((currentProfile?.role as string | null) !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    if (!userId || !academyId || !role) {
      return NextResponse.json({ error: 'userId, academyId y role son requeridos.' }, { status: 400 });
    }

    if (!['admin', 'coach', 'student'].includes(role)) {
      return NextResponse.json({ error: 'role inválido.' }, { status: 400 });
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('user_academies')
      .insert({
        user_id: userId,
        academy_id: academyId,
        role,
      })
      .select('id, academy_id, role')
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message ?? 'No se pudo agregar la asignación.' }, { status: 400 });
    }

    // Mantener consistencia de tablas globales que dependen del rol.
    if (role === 'coach') {
      const { error: coachErr } = await supabaseAdmin
        .from('coaches')
        .upsert({ user_id: userId }, { onConflict: 'user_id' });
      if (coachErr) {
        return NextResponse.json({ error: coachErr.message ?? 'No se pudo asegurar el registro de profesor.' }, { status: 400 });
      }
    }

    if (role === 'student') {
      const { error: studentErr } = await supabaseAdmin
        .from('students')
        .upsert({ user_id: userId, level: null, notes: null }, { onConflict: 'user_id' });
      if (studentErr) {
        return NextResponse.json({ error: studentErr.message ?? 'No se pudo asegurar el registro de alumno.' }, { status: 400 });
      }
    }

    return NextResponse.json({ assignment: inserted });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, id } = body as { currentUserId?: string; id?: string };

    if (!currentUserId) {
      return NextResponse.json({ error: 'currentUserId es requerido.' }, { status: 400 });
    }

    const { data: currentProfile, error: currentProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .maybeSingle();

    if (currentProfileErr) {
      return NextResponse.json({ error: 'No se pudo verificar permisos.' }, { status: 403 });
    }

    if ((currentProfile?.role as string | null) !== 'super_admin') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id es requerido.' }, { status: 400 });
    }

    const { error: delErr } = await supabaseAdmin.from('user_academies').delete().eq('id', id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message ?? 'No se pudo eliminar la asignación.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}
