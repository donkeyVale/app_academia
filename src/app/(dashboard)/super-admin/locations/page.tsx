"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type Location = {
  id: string;
  name: string | null;
};

type Court = {
  id: string;
  name: string | null;
  location_id: string;
};

type Academy = {
  id: string;
  name: string;
};

type AcademyLocation = {
  id: string;
  academy_id: string;
  location_id: string;
};

export default function LocationsAdminPage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const [role, setRole] = useState<AppRole>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [academyLocations, setAcademyLocations] = useState<AcademyLocation[]>([]);

  const [newLocationName, setNewLocationName] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [newCourtName, setNewCourtName] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingCourt, setSavingCourt] = useState(false);
  const [savingAcademyLink, setSavingAcademyLink] = useState(false);
  const [removingAcademyLinkId, setRemovingAcademyLinkId] = useState<string | null>(null);
  const [selectedAcademyIdForLocation, setSelectedAcademyIdForLocation] = useState<string>("");
  const [academySelectOpen, setAcademySelectOpen] = useState(false);
  const [academySelectQuery, setAcademySelectQuery] = useState("");
  const academySelectSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!academySelectOpen) return;
    const t = window.setTimeout(() => academySelectSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [academySelectOpen]);

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
      setLoadingData(true);
      setError(null);
      try {
        const [locRes, courtsRes, acadRes, alRes] = await Promise.all([
          supabase.from("locations").select("id,name").order("name"),
          supabase.from("courts").select("id,name,location_id").order("name"),
          supabase.from("academies").select("id,name").order("name"),
          supabase.from("academy_locations").select("id,academy_id,location_id"),
        ]);

        if (locRes.error) throw locRes.error;
        if (courtsRes.error) throw courtsRes.error;
        if (acadRes.error) throw acadRes.error;
        if (alRes.error) throw alRes.error;

        if (!active) return;
        setLocations((locRes.data ?? []) as Location[]);
        setCourts((courtsRes.data ?? []) as Court[]);
        setAcademies((acadRes.data ?? []) as Academy[]);
        setAcademyLocations((alRes.data ?? []) as AcademyLocation[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Error cargando sedes y canchas.");
      } finally {
        if (!active) return;
        setLoadingData(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase]);

  const isSuperAdmin = role === "super_admin";

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const courtsForSelectedLocation = useMemo(
    () => courts.filter((c) => c.location_id === selectedLocationId),
    [courts, selectedLocationId]
  );

  const academyLinksForSelectedLocation = useMemo(
    () => academyLocations.filter((al) => al.location_id === selectedLocationId),
    [academyLocations, selectedLocationId]
  );

  const availableAcademiesForSelectedLocation = useMemo(() => {
    if (!selectedLocationId) return [] as Academy[];
    const assignedIds = new Set(
      academyLocations.filter((al) => al.location_id === selectedLocationId).map((al) => al.academy_id)
    );
    return academies.filter((a) => !assignedIds.has(a.id));
  }, [academies, academyLocations, selectedLocationId]);

  const onCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    setSavingLocation(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("locations")
        .insert({ name: newLocationName.trim() })
        .select("id,name")
        .single();

      if (insErr) throw insErr;
      setLocations((prev) => [...prev, data as Location]);
      setNewLocationName("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear la sede.");
    } finally {
      setSavingLocation(false);
    }
  };

  const onCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId || !newCourtName.trim()) return;
    setSavingCourt(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("courts")
        .insert({ name: newCourtName.trim(), location_id: selectedLocationId })
        .select("id,name,location_id")
        .single();

      if (insErr) throw insErr;
      setCourts((prev) => [...prev, data as Court]);
      setNewCourtName("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear la cancha.");
    } finally {
      setSavingCourt(false);
    }
  };

  const onAssignAcademyToLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId || !selectedAcademyIdForLocation) return;
    setSavingAcademyLink(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("academy_locations")
        .insert({
          academy_id: selectedAcademyIdForLocation,
          location_id: selectedLocationId,
        })
        .select("id,academy_id,location_id")
        .single();

      if (insErr) throw insErr;
      setAcademyLocations((prev) => [...prev, data as AcademyLocation]);
      setSelectedAcademyIdForLocation("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo asignar la sede a la academia.");
    } finally {
      setSavingAcademyLink(false);
    }
  };

  const onUnassignAcademyLocation = async (id: string) => {
    setRemovingAcademyLinkId(id);
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from("academy_locations")
        .delete()
        .eq("id", id);

      if (delErr) throw delErr;
      setAcademyLocations((prev) => prev.filter((al) => al.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo desvincular la sede de la academia.");
    } finally {
      setRemovingAcademyLinkId(null);
    }
  };

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Sedes y canchas</h1>
          <p className="text-sm text-gray-600">
            Gestioná las sedes (locations), sus canchas y su asignación a academias.
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
          <p>No tenés permisos para acceder a la gestión de sedes y canchas.</p>
        </div>
      )}

      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
                <p className="text-sm font-semibold text-[#31435d]">Nueva sede</p>
              </div>
              <form onSubmit={onCreateLocation} className="px-4 py-4 space-y-3 text-sm">
                <div className="flex flex-col gap-1">
                  <label htmlFor="location-name" className="text-xs font-medium text-gray-700">
                    Nombre de la sede
                  </label>
                  <input
                    id="location-name"
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    disabled={savingLocation}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf]"
                    placeholder="Ej: Sede Central"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingLocation || !newLocationName.trim()}
                    className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingLocation ? "Creando..." : "Crear sede"}
                  </button>
                </div>
              </form>
            </div>

            <div className="border rounded-lg bg-white shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
                <p className="text-sm font-semibold text-[#31435d]">Listado de sedes</p>
              </div>
              <div className="px-4 py-3 text-sm max-h-[420px] overflow-y-auto">
                {loadingData ? (
                  <p className="text-gray-600">Cargando sedes...</p>
                ) : locations.length === 0 ? (
                  <p className="text-gray-600">Todavía no hay sedes creadas.</p>
                ) : (
                  <ul className="space-y-1">
                    {locations.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLocationId(l.id)}
                          className={
                            "w-full text-left px-2 py-1 rounded-md border text-xs flex flex-col gap-0.5 " +
                            (l.id === selectedLocationId
                              ? "border-[#3cadaf] bg-emerald-50 text-[#0f172a]"
                              : "border-gray-200 hover:bg-gray-50 text-gray-700")
                          }
                        >
                          <span className="font-medium">{l.name || l.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
                <p className="text-sm font-semibold text-[#31435d]">Detalle de la sede</p>
              </div>
              <div className="px-4 py-4 text-sm space-y-3">
                {!selectedLocation && (
                  <p className="text-gray-600">Seleccioná una sede de la lista.</p>
                )}

                {selectedLocation && (
                  <>
                    <p className="text-xs text-gray-600 mb-1">
                      Sede seleccionada: <span className="font-medium">{selectedLocation.name || selectedLocation.id}</span>
                    </p>

                    <div className="space-y-2 border-b pb-3 mb-3">
                      <p className="text-xs font-semibold text-[#31435d]">Canchas</p>
                      <form onSubmit={onCreateCourt} className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-700">Nombre de la cancha</label>
                          <input
                            type="text"
                            value={newCourtName}
                            onChange={(e) => setNewCourtName(e.target.value)}
                            disabled={savingCourt}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf]"
                            placeholder="Ej: Cancha 1"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={savingCourt || !newCourtName.trim()}
                            className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e] disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {savingCourt ? "Creando..." : "Agregar cancha"}
                          </button>
                        </div>
                      </form>
                      <div className="space-y-1">
                        {courtsForSelectedLocation.length === 0 ? (
                          <p className="text-gray-600 text-xs">Esta sede aún no tiene canchas.</p>
                        ) : (
                          courtsForSelectedLocation.map((c) => (
                            <div
                              key={c.id}
                              className="border rounded-md px-2 py-1.5 text-xs flex items-center justify-between"
                            >
                              <span className="font-medium text-[#31435d]">{c.name || c.id}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#31435d]">Academias vinculadas</p>
                      <form onSubmit={onAssignAcademyToLocation} className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-700">Agregar academia</label>
                          <Popover open={academySelectOpen} onOpenChange={setAcademySelectOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={savingAcademyLink || availableAcademiesForSelectedLocation.length === 0}
                                className="w-full justify-between text-xs font-normal"
                              >
                                <span className="truncate mr-2">
                                  {(() => {
                                    if (!selectedAcademyIdForLocation) return 'Seleccionar academia...';
                                    const a = availableAcademiesForSelectedLocation.find((x) => x.id === selectedAcademyIdForLocation);
                                    return a?.name ?? 'Seleccionar academia...';
                                  })()}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3" align="start">
                              <div className="space-y-2">
                                <Input
                                  type="text"
                                  placeholder="Buscar academias..."
                                  value={academySelectQuery}
                                  onChange={(e) => setAcademySelectQuery(e.target.value)}
                                  className="h-11 text-base"
                                  ref={academySelectSearchRef}
                                />
                                <div className="max-h-52 overflow-auto border rounded-md divide-y">
                                  {(() => {
                                    const filtered = availableAcademiesForSelectedLocation.filter((a) => {
                                      const t = (academySelectQuery || '').toLowerCase();
                                      if (!t) return true;
                                      return `${a.name || ''} ${a.id || ''}`.toLowerCase().includes(t);
                                    });
                                    const limited = filtered.slice(0, 50);

                                    if (availableAcademiesForSelectedLocation.length === 0) {
                                      return (
                                        <div className="px-2 py-1.5 text-xs text-gray-500">
                                          Esta sede ya está vinculada a todas las academias existentes.
                                        </div>
                                      );
                                    }
                                    if (filtered.length === 0) {
                                      return (
                                        <div className="px-2 py-1.5 text-xs text-gray-500">
                                          No se encontraron academias con ese criterio de búsqueda.
                                        </div>
                                      );
                                    }

                                    return (
                                      <>
                                        {limited.map((a) => (
                                          <button
                                            key={a.id}
                                            type="button"
                                            onClick={() => {
                                              setSelectedAcademyIdForLocation(a.id);
                                              setAcademySelectQuery('');
                                              setAcademySelectOpen(false);
                                            }}
                                            className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                          >
                                            <span className="mr-2 truncate">{a.name}</span>
                                          </button>
                                        ))}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={savingAcademyLink || !selectedAcademyIdForLocation}
                            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {savingAcademyLink ? "Vinculando..." : "Vincular academia"}
                          </button>
                        </div>
                        {availableAcademiesForSelectedLocation.length === 0 && (
                          <p className="text-[11px] text-gray-500 mt-1">
                            Esta sede ya está vinculada a todas las academias existentes.
                          </p>
                        )}
                      </form>

                      <div className="space-y-1">
                        {academyLinksForSelectedLocation.length === 0 ? (
                          <p className="text-gray-600 text-xs">Esta sede aún no está vinculada a ninguna academia.</p>
                        ) : (
                          academyLinksForSelectedLocation.map((al) => {
                            const acad = academies.find((a) => a.id === al.academy_id) || null;
                            return (
                              <div
                                key={al.id}
                                className="border rounded-md px-2 py-1.5 text-xs flex items-center justify-between"
                              >
                                <span className="font-medium text-[#31435d]">{acad?.name || "Academia desconocida"}</span>
                                <button
                                  type="button"
                                  onClick={() => onUnassignAcademyLocation(al.id)}
                                  disabled={removingAcademyLinkId === al.id}
                                  className="text-[11px] text-red-600 hover:text-red-700 disabled:opacity-60"
                                >
                                  {removingAcademyLinkId === al.id ? "Quitando..." : "Quitar"}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

