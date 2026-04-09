import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, academyId, suspended } = body as {
      currentUserId?: string;
      academyId?: string;
      suspended?: boolean;
    };

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

    if (!academyId || typeof suspended !== "boolean") {
      return NextResponse.json({ error: "academyId y suspended son requeridos." }, { status: 400 });
    }

    const { error: updErr } = await supabaseAdmin
      .from("academies")
      .update({ is_suspended: suspended })
      .eq("id", academyId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message ?? "No se pudo actualizar la academia." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error inesperado." }, { status: 500 });
  }
}
