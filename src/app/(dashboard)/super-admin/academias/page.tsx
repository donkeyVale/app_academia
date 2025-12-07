"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = {
  id: string;
  name: string;
  slug: string | null;
  created_at: string | null;
};

export default function AcademiesPage() {
  const supabase = createClientBrowser();
  const [role, setRole] = useState<AppRole>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingUser(true);
      setError(null);
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        if (!active) return;
        setLoadingUser(false);
        return;
      }

      try {
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profErr) throw profErr;

        const r = (profile?.role as AppRole) ?? null;
        if (r === "super_admin" || r === "admin" || r === "coach" || r === "student") {
          setRole(r);
        } else {
          setRole(null);
        }
      } catch (err: any) {
        setError(err?.message ?? "Error cargando tu perfil.");
      } finally {
        if (!active) return;
        setLoadingUser(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (role !== "super_admin") return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: acadErr } = await supabase
          .from("academies")
          .select("id, name, slug, created_at")
          .order("created_at", { ascending: false });

        if (acadErr) throw acadErr;
        if (!active) return;
        setAcademies((data ?? []) as Academy[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Error cargando academias.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase]);

  const onCreateAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("academies")
        .insert({ name: name.trim() })
        .select("id, name, slug, created_at")
        .single();

      if (insErr) throw insErr;
      setAcademies((prev) => [data as Academy, ...prev]);
      setName("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear la academia.");
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = role === "super_admin";

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Academias</h1>
          <p className="text-sm text-gray-600">
            Gestioná las academias y sedes disponibles en el sistema.
          </p>
        </div>
        <div className="flex items-center justify-end flex-1">
          <Link href="/" className="flex items-center">
            <div className="h-16 w-32 relative">
              <Image
                src="/icons/logoHome.png"
                alt="Agendo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loadingUser && (
        <p className="text-sm text-gray-600">Cargando tu perfil...</p>
      )}

      {!loadingUser && !isSuperAdmin && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-red-400 px-4 py-4 text-sm text-gray-700">
          <p className="font-semibold text-red-600 mb-1">Acceso restringido</p>
          <p>No tenés permisos para acceder a la configuración de academias.</p>
        </div>
      )}

      {isSuperAdmin && (
        <>
          <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
            <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
              <p className="text-sm font-semibold text-[#31435d]">Nueva academia</p>
            </div>
            <form onSubmit={onCreateAcademy} className="px-4 py-4 space-y-3 text-sm">
              <div className="flex flex-col gap-1">
                <label htmlFor="academy-name" className="text-xs font-medium text-gray-700">
                  Nombre de la academia
                </label>
                <input
                  id="academy-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf]"
                  placeholder="Ej: Academia Central"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Creando..." : "Crear academia"}
                </button>
              </div>
            </form>
          </div>

          <div className="border rounded-lg bg-white shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
              <p className="text-sm font-semibold text-[#31435d]">Listado de academias</p>
            </div>
            <div className="px-4 py-4 text-sm">
              {loading ? (
                <p className="text-gray-600">Cargando academias...</p>
              ) : academies.length === 0 ? (
                <p className="text-gray-600">Todavía no hay academias creadas.</p>
              ) : (
                <div className="space-y-2">
                  {academies.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 border rounded-md px-3 py-2 hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium text-[#31435d]">{a.name}</p>
                        {a.slug && (
                          <p className="text-xs text-gray-500">{a.slug}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// placeholder, will implement after seeing existing patterns
