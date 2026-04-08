import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      currentUserId,
      academyId,
      isActive,
    } = body as { currentUserId?: string; academyId?: string; isActive?: boolean };

    if (!currentUserId) {
      return NextResponse.json({ error: "currentUserId es requerido." }, { status: 400 });
    }

    const { data: currentProfile, error: currentProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", currentUserId)
      .maybeSingle();

    if (currentProfileErr) {
      return NextResponse.json({ error: "No se pudo verificar permisos." }, { status: 403 });
    }

    if ((currentProfile?.role as string | null) !== "super_admin") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    if (!academyId || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "academyId e isActive son requeridos." }, { status: 400 });
    }

    const { error: updErr } = await supabaseAdmin
      .from("user_academies")
      .update({ is_active: isActive })
      .eq("academy_id", academyId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message ?? "No se pudo actualizar el estado." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error inesperado." }, { status: 500 });
  }
}
