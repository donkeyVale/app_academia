"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";
import { Bell, BellOff } from "lucide-react";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

export default function SettingsPage() {
  const supabase = createClientBrowser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyClasses, setNotifyClasses] = useState<boolean>(true);
  const [role, setRole] = useState<AppRole>(null);
  const [academyOptions, setAcademyOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("notifications_enabled, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profErr) throw profErr;

        if (profile && typeof profile.notifications_enabled === "boolean") {
          setNotifyClasses(profile.notifications_enabled);
        } else {
          setNotifyClasses(true);
        }

        const r = (profile?.role as AppRole) ?? null;
        if (r === "super_admin" || r === "admin" || r === "coach" || r === "student") {
          setRole(r);
        } else {
          setRole(null);
        }

        // Cargar academias asignadas al usuario (para seleccionar academia actual)
        try {
          const { data: uaRows, error: uaErr } = await supabase
            .from("user_academies")
            .select("academy_id")
            .eq("user_id", user.id);

          if (!uaErr && uaRows) {
            const academyIds = Array.from(
              new Set(
                (uaRows as { academy_id: string | null }[])
                  .map((row) => row.academy_id)
                  .filter((id): id is string => !!id)
              )
            );

            if (academyIds.length > 0) {
              const { data: acadRows, error: acadErr } = await supabase
                .from("academies")
                .select("id,name")
                .in("id", academyIds)
                .order("name");

              if (!acadErr && acadRows) {
                const options = (acadRows as { id: string; name: string | null }[]).map((a) => ({
                  id: a.id,
                  name: a.name ?? a.id,
                }));
                setAcademyOptions(options);

                let stored: string | null = null;
                if (typeof window !== "undefined") {
                  stored = window.localStorage.getItem("selectedAcademyId");
                }
                const validIds = options.map((o) => o.id);
                const initial = stored && validIds.includes(stored) ? stored : validIds[0] ?? null;
                setSelectedAcademyId(initial);
                if (initial && typeof window !== "undefined") {
                  window.localStorage.setItem("selectedAcademyId", initial);
                }
              }
            } else {
              setAcademyOptions([]);
              setSelectedAcademyId(null);
            }
          }
        } catch {
          setAcademyOptions([]);
        }
      } catch (err: any) {
        setError(err?.message ?? "Error cargando configuración.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const onToggleNotify = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setSaving(false);
        return;
      }

      const nextValue = !notifyClasses;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ notifications_enabled: nextValue })
        .eq("id", user.id);

      if (updErr) throw updErr;
      setNotifyClasses(nextValue);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar tu configuración.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2">
            <Bell className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
            <div className="space-y-0.5">
              <h1 className="text-2xl font-semibold text-[#31435d]">Configuración</h1>
              <p className="text-sm text-gray-600">Cargando tu configuración...</p>
            </div>
          </div>
          <div className="flex items-center justify-end flex-1">
            <div className="h-16 w-32 relative opacity-60">
              <Image
                src="/icons/logoHome.png"
                alt="Agendo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Bell className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Configuración</h1>
            <p className="text-sm text-gray-600">Ajustá cómo querés recibir notificaciones.</p>
          </div>
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

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
          <p className="text-sm font-semibold text-[#31435d]">Notificaciones</p>
        </div>
        <div className="px-4 py-4 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[#31435d]">Recordatorios de clases</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Recibí avisos antes de tus clases y cuando una reserva sea cancelada o modificada.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleNotify}
              disabled={loading || saving}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (notifyClasses
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
              }
            >
              {notifyClasses ? (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  Activadas
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  Desactivadas
                </>
              )}
            </button>
          </div>
          {saving && <p className="text-xs text-gray-500">Guardando cambios...</p>}
        </div>
      </div>

      {academyOptions.length > 1 && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-emerald-500">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
            <p className="text-sm font-semibold text-[#31435d]">Academia actual</p>
          </div>
          <div className="px-4 py-4 space-y-3 text-sm">
            <p className="text-xs text-gray-600">
              Seleccioná con qué academia querés trabajar. Esta elección se usará para filtrar los datos cuando tengas varias academias asignadas.
            </p>
            <div className="flex flex-col gap-1 max-w-xs">
              <label className="text-xs font-medium text-gray-700">Academia</label>
              <select
                value={selectedAcademyId ?? ""}
                onChange={async (e) => {
                  const next = e.target.value || null;
                  setSelectedAcademyId(next);
                  if (typeof window !== "undefined" && next) {
                    window.localStorage.setItem("selectedAcademyId", next);
                  }

                  // Guardar academia por defecto a nivel de usuario
                  try {
                    const { data } = await supabase.auth.getUser();
                    const user = data.user;
                    if (!user || !next) return;

                    await supabase
                      .from("profiles")
                      .update({ default_academy_id: next })
                      .eq("id", user.id);
                  } catch (err) {
                    console.error("No se pudo actualizar default_academy_id", err);
                  }
                }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf] bg-white"
              >
                {academyOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {role === "super_admin" && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-indigo-500">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
            <p className="text-sm font-semibold text-[#31435d]">Configuración avanzada (super admin)</p>
          </div>
          <div className="px-4 py-4 space-y-3 text-sm">
            <p className="text-xs text-gray-600">
              Gestioná las academias y las asignaciones de usuarios a academias.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/super-admin/academias"
                className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e]"
              >
                Administrar academias
              </Link>
              <Link
                href="/super-admin/asignaciones"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                Asignar academias a usuarios
              </Link>
              <Link
                href="/super-admin/locations"
                className="inline-flex items-center rounded-md bg-slate-700 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800"
              >
                Sedes y canchas
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
