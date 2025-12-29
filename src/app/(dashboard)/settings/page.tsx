"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split("-");
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatYmd(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return "Seleccionar fecha";
  return date.toLocaleDateString("es-PY");
}

function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const selectedDate = parseYmd(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left text-base font-normal flex items-center gap-2 h-10"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <span className={selectedDate ? "" : "text-gray-400"}>{formatDisplay(selectedDate)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatYmd(date));
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function SettingsPage() {
  const supabase = createClientBrowser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyClasses, setNotifyClasses] = useState<boolean>(true);
  const [role, setRole] = useState<AppRole>(null);
  const [academyOptions, setAcademyOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [rentSaving, setRentSaving] = useState(false);
  const [rentError, setRentError] = useState<string | null>(null);
  const [rentLocations, setRentLocations] = useState<{ id: string; name: string | null }[]>([]);
  const [rentCourts, setRentCourts] = useState<{ id: string; name: string | null; location_id: string | null }[]>([]);
  const [rentLocationValues, setRentLocationValues] = useState<
    Record<string, { feePerClass: string; validFrom: string }>
  >({});
  const [rentCourtValues, setRentCourtValues] = useState<
    Record<string, { feePerClass: string; validFrom: string }>
  >({});
  const [rentOpenLocations, setRentOpenLocations] = useState<Record<string, boolean>>({});

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

      setCurrentUserId(user.id);

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

  useEffect(() => {
    (async () => {
      setRentError(null);
      if (!currentUserId) return;
      if (role !== 'admin' && role !== 'super_admin') return;
      if (!selectedAcademyId) {
        setRentLocations([]);
        setRentCourts([]);
        setRentLocationValues({});
        setRentCourtValues({});
        return;
      }

      setRentLoading(true);
      try {
        const { data: alRows, error: alErr } = await supabase
          .from('academy_locations')
          .select('location_id')
          .eq('academy_id', selectedAcademyId);

        if (alErr) throw alErr;

        const locationIds = Array.from(
          new Set(
            (alRows ?? [])
              .map((r: any) => (r?.location_id as string | null) ?? null)
              .filter((id: string | null): id is string => !!id),
          ),
        );

        if (locationIds.length === 0) {
          setRentLocations([]);
          setRentCourts([]);
          setRentLocationValues({});
          setRentCourtValues({});
          return;
        }

        const [locRes, courtsRes] = await Promise.all([
          supabase.from('locations').select('id,name').in('id', locationIds).order('name'),
          supabase.from('courts').select('id,name,location_id').in('location_id', locationIds).order('name'),
        ]);

        if (locRes.error) throw locRes.error;
        if (courtsRes.error) throw courtsRes.error;

        const locs = (locRes.data ?? []) as { id: string; name: string | null }[];
        const courts = (courtsRes.data ?? []) as { id: string; name: string | null; location_id: string | null }[];
        setRentLocations(locs);
        setRentCourts(courts);

        setRentOpenLocations((prev) => {
          const next: Record<string, boolean> = { ...prev };
          for (const l of locs) {
            if (typeof next[l.id] !== 'boolean') {
              next[l.id] = locs.length === 1;
            }
          }
          return next;
        });

        const feesRes = await fetch('/api/admin/get-rent-fees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentUserId, academyId: selectedAcademyId }),
        });

        if (!feesRes.ok) {
          const txt = await feesRes.text().catch(() => '');
          throw new Error(txt || 'No se pudo cargar la configuración de alquiler.');
        }

        const feesJson = (await feesRes.json().catch(() => null)) as any;
        const locationFees = (feesJson?.locationFees ?? []) as any[];
        const courtFees = (feesJson?.courtFees ?? []) as any[];

        const nextLocValues: Record<string, { feePerClass: string; validFrom: string }> = {};
        for (const l of locs) {
          const match = locationFees.find((x) => x.location_id === l.id);
          nextLocValues[l.id] = {
            feePerClass: match?.fee_per_class != null ? String(match.fee_per_class) : '',
            validFrom: match?.valid_from ? String(match.valid_from) : new Date().toISOString().slice(0, 10),
          };
        }

        const nextCourtValues: Record<string, { feePerClass: string; validFrom: string }> = {};
        for (const c of courts) {
          const match = courtFees.find((x) => x.court_id === c.id);
          nextCourtValues[c.id] = {
            feePerClass: match?.fee_per_class != null ? String(match.fee_per_class) : '',
            validFrom: match?.valid_from ? String(match.valid_from) : new Date().toISOString().slice(0, 10),
          };
        }

        setRentLocationValues(nextLocValues);
        setRentCourtValues(nextCourtValues);
      } catch (e: any) {
        setRentError(e?.message ?? 'Error cargando configuración de alquiler.');
      } finally {
        setRentLoading(false);
      }
    })();
  }, [currentUserId, role, selectedAcademyId, supabase]);

  const onSaveRentFees = async () => {
    if (!currentUserId) return;
    if (role !== 'admin' && role !== 'super_admin') return;
    if (!selectedAcademyId) return;

    setRentSaving(true);
    setRentError(null);
    try {
      const locationFeesPayload = Object.entries(rentLocationValues)
        .map(([locationId, v]) => ({
          locationId,
          feePerClass: Number(v.feePerClass),
          validFrom: v.validFrom,
        }))
        .filter((x) => Number.isFinite(x.feePerClass) && x.feePerClass >= 0 && !!x.validFrom);

      const courtFeesPayload = Object.entries(rentCourtValues)
        .map(([courtId, v]) => ({
          courtId,
          feePerClass: Number(v.feePerClass),
          validFrom: v.validFrom,
        }))
        .filter((x) => Number.isFinite(x.feePerClass) && x.feePerClass >= 0 && !!x.validFrom);

      const res = await fetch('/api/admin/update-rent-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          academyId: selectedAcademyId,
          locationFees: locationFeesPayload,
          courtFees: courtFeesPayload,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'No se pudo guardar la configuración de alquiler.');
      }
    } catch (e: any) {
      setRentError(e?.message ?? 'Error guardando configuración de alquiler.');
    } finally {
      setRentSaving(false);
    }
  };

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

      {(role === 'admin' || role === 'super_admin') && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-emerald-500">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#31435d]">Alquiler de canchas (egresos)</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Configurá el costo por clase (60 min) que la academia paga al complejo. Se aplica solo si hubo al menos 1 alumno.
              </p>
            </div>
            <button
              type="button"
              onClick={onSaveRentFees}
              disabled={rentSaving || rentLoading || !selectedAcademyId}
              className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {rentSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          <div className="px-4 py-4 space-y-3 text-sm">
            {rentError && <p className="text-xs text-red-600">{rentError}</p>}

            {!selectedAcademyId ? (
              <p className="text-xs text-gray-600">
                Seleccioná una academia en esta pantalla para configurar el alquiler.
              </p>
            ) : rentLoading ? (
              <p className="text-xs text-gray-600">Cargando sedes y canchas...</p>
            ) : rentLocations.length === 0 ? (
              <p className="text-xs text-gray-600">No hay sedes vinculadas a esta academia.</p>
            ) : (
              <div className="space-y-4">
                {rentLocations.map((loc) => {
                  const locValue = rentLocationValues[loc.id] ?? {
                    feePerClass: '',
                    validFrom: new Date().toISOString().slice(0, 10),
                  };
                  const courtsForLoc = rentCourts.filter((c) => c.location_id === loc.id);
                  const isOpen = !!rentOpenLocations[loc.id];

                  return (
                    <div key={loc.id} className="border rounded-md p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRentOpenLocations((prev) => ({
                            ...prev,
                            [loc.id]: !prev[loc.id],
                          }))
                        }
                        className="w-full flex items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-[#31435d]">{loc.name ?? loc.id}</p>
                            <p className="text-xs text-gray-500">Canchas: {courtsForLoc.length}</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          {locValue.feePerClass ? `Base: ${locValue.feePerClass} PYG` : 'Sin base'}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-sm text-gray-600">Vigente desde (base sede)</label>
                              <DatePickerField
                                value={locValue.validFrom}
                                onChange={(value) =>
                                  setRentLocationValues((prev) => ({
                                    ...prev,
                                    [loc.id]: { ...locValue, validFrom: value },
                                  }))
                                }
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm text-gray-600">Alquiler base por clase</label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={locValue.feePerClass}
                                onChange={(e) =>
                                  setRentLocationValues((prev) => ({
                                    ...prev,
                                    [loc.id]: { ...locValue, feePerClass: e.target.value },
                                  }))
                                }
                                className="h-10 text-base"
                                placeholder="0"
                              />
                            </div>
                          </div>

                          {courtsForLoc.length > 0 && (
                            <div className="mt-1 space-y-2">
                              <p className="text-sm font-semibold text-gray-700">Overrides por cancha (opcional)</p>
                              <div className="space-y-2">
                                {courtsForLoc.map((c) => {
                                  const cValue = rentCourtValues[c.id] ?? {
                                    feePerClass: '',
                                    validFrom: new Date().toISOString().slice(0, 10),
                                  };
                                  return (
                                    <div key={c.id} className="border rounded-md p-2">
                                      <p className="text-sm font-medium text-[#31435d]">{c.name ?? c.id}</p>
                                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                          <label className="text-sm text-gray-600">Vigente desde (override)</label>
                                          <DatePickerField
                                            value={cValue.validFrom}
                                            onChange={(value) =>
                                              setRentCourtValues((prev) => ({
                                                ...prev,
                                                [c.id]: { ...cValue, validFrom: value },
                                              }))
                                            }
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-sm text-gray-600">Alquiler por clase</label>
                                          <Input
                                            type="number"
                                            inputMode="decimal"
                                            value={cValue.feePerClass}
                                            onChange={(e) =>
                                              setRentCourtValues((prev) => ({
                                                ...prev,
                                                [c.id]: { ...cValue, feePerClass: e.target.value },
                                              }))
                                            }
                                            className="h-10 text-base"
                                            placeholder="(usa tarifa base)"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
