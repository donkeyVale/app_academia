import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body as { userId?: string };

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 });
    }

    // Borrar roles adicionales
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (rolesError) {
      return NextResponse.json(
        { error: rolesError.message ?? 'No se pudieron borrar los roles.' },
        { status: 400 }
      );
    }

    // Borrar registro de alumno (si existe)
    const { error: studentError } = await supabaseAdmin
      .from('students')
      .delete()
      .eq('user_id', userId);

    if (studentError) {
      return NextResponse.json(
        { error: studentError.message ?? 'No se pudo borrar el registro de alumno.' },
        { status: 400 }
      );
    }

    // Borrar perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message ?? 'No se pudo borrar el perfil.' },
        { status: 400 }
      );
    }

    // Borrar usuario de Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      return NextResponse.json(
        { error: deleteAuthError.message ?? 'No se pudo borrar el usuario de Auth.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Error inesperado.' },
      { status: 500 }
    );
  }
}
