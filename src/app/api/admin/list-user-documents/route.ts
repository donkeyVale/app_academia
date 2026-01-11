import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, userIds } = body as { currentUserId?: string; userIds?: string[] };

    if (!currentUserId) {
      return NextResponse.json({ error: 'currentUserId es requerido.' }, { status: 400 });
    }

    const ids = (userIds ?? []).filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (ids.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const { data: currentProfile, error: currentProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .maybeSingle();

    if (currentProfileErr) {
      return NextResponse.json(
        { error: currentProfileErr.message ?? 'No se pudo validar el rol del usuario actual.' },
        { status: 400 },
      );
    }

    const role = (currentProfile?.role as string | null) ?? null;
    const isAdminLike = role === 'admin' || role === 'super_admin';
    if (!isAdminLike) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const map: Record<string, string | null> = {};

    let page = 1;
    const perPage = 1000;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return NextResponse.json(
          { error: error.message ?? 'No se pudo obtener los usuarios de Auth.' },
          { status: 500 },
        );
      }

      const batch = (data as any)?.users ?? [];
      if (!batch.length) break;

      for (const u of batch as any[]) {
        const uid = (u?.id as string | undefined) ?? '';
        if (!uid) continue;
        if (!ids.includes(uid)) continue;
        const meta = (u.user_metadata ?? {}) as any;
        map[uid] = (meta.national_id as string | undefined) ?? null;
      }

      const found = Object.keys(map).length;
      if (found >= ids.length) break;

      if (batch.length < perPage) break;
      page += 1;
    }

    const rows = ids.map((userId) => ({ userId, nationalId: map[userId] ?? null }));
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}
