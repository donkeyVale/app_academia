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

type ProfileUser = {
  id: string;
  full_name: string | null;
  role: AppRole;
};

type Academy = {
  id: string;
  name: string;
};

type UserAcademy = {
  id: string;
  academy_id: string;
  role: Exclude<AppRole, "super_admin" | null>;
};

export default function AssignmentsPage() {
  const supabase = createClientBrowser();
  const [role, setRole] = useState<AppRole>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<UserAcademy[]>([]);

  const [usersSearch, setUsersSearch] = useState("");

  const [newAcademyId, setNewAcademyId] = useState<string>("");
  const [newRole, setNewRole] = useState<"admin" | "coach" | "student">("admin");
  const [academySelectOpen, setAcademySelectOpen] = useState(false);
  const [academySelectQuery, setAcademySelectQuery] = useState("");
  const academySelectSearchRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

      setCurrentUserId(user.id);

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
        const [{ data: usersData, error: usersErr }, { data: acadData, error: acadErr }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, role")
            .order("full_name", { ascending: true }),
          supabase.from("academies").select("id, name").order("name", { ascending: true }),
        ]);

        if (usersErr) throw usersErr;
        if (acadErr) throw acadErr;

        if (!active) return;
        setUsers(
          (usersData ?? []).map((u: any) => ({
            id: u.id as string,
            full_name: (u.full_name as string | null) ?? null,
            role: (u.role as AppRole) ?? null,
          }))
        );
        setAcademies((acadData ?? []) as Academy[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Error cargando datos.");
      } finally {
        if (!active) return;
        setLoadingData(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase]);

  useEffect(() => {
    if (!selectedUserId || role !== "super_admin") {
      setAssignments([]);
      return;
    }
    let active = true;
    (async () => {
      setError(null);
      try {
        const { data, error: uaErr } = await supabase
          .from("user_academies")
          .select("id, academy_id, role")
          .eq("user_id", selectedUserId)
          .order("created_at", { ascending: true });

        if (uaErr) throw uaErr;
        if (!active) return;
        setAssignments((data ?? []) as UserAcademy[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Error cargando asignaciones.");
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedUserId, role, supabase]);

  const availableAcademies = useMemo(() => {
    if (!academies.length) return [] as Academy[];
    if (!assignments.length) return academies;
    // Permitir asignar múltiples roles para una misma academia.
    // Solo bloqueamos si ya existe exactamente la tupla (academy_id, role).
    const assignedPairs = new Set(assignments.map((a) => `${a.academy_id}:${a.role}`));
    return academies.filter((a) => !assignedPairs.has(`${a.id}:${newRole}`));
  }, [academies, assignments, newRole]);

  const onSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setNewAcademyId("");
  };

  const onAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !newAcademyId || !newRole) return;
    setSaving(true);
    setError(null);
    try {
      const alreadyExists = assignments.some(
        (a) => a.academy_id === newAcademyId && a.role === newRole
      );
      if (alreadyExists) {
        setError("Ese usuario ya tiene ese rol en esa academia.");
        return;
      }

      if (!currentUserId) {
        throw new Error('No se pudo identificar al usuario actual.');
      }

      const res = await fetch('/api/admin/user-academy-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          userId: selectedUserId,
          academyId: newAcademyId,
          role: newRole,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'No se pudo agregar la asignación.');
      }

      setAssignments((prev) => [...prev, json.assignment as UserAcademy]);
      setNewAcademyId("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo agregar la asignación.");
    } finally {
      setSaving(false);
    }
  };

  const onRemoveAssignment = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      if (!currentUserId) {
        throw new Error('No se pudo identificar al usuario actual.');
      }

      const res = await fetch('/api/admin/user-academy-assignment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId, id }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'No se pudo eliminar la asignación.');
      }

      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo eliminar la asignación.");
    } finally {
      setRemovingId(null);
    }
  };

  const isSuperAdmin = role === "super_admin";

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const filteredUsers = useMemo(() => {
    const term = usersSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const name = (u.full_name ?? "").toLowerCase();
      const roleText = String(u.role ?? "").toLowerCase();
      const id = u.id.toLowerCase();
      return name.includes(term) || roleText.includes(term) || id.includes(term);
    });
  }, [users, usersSearch]);

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Asignación de academias</h1>
          <p className="text-sm text-gray-600">
            Asigná academias a usuarios con el rol correspondiente.
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
          <p>No tenés permisos para acceder a la asignación de academias.</p>
        </div>
      )}

      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="border rounded-lg bg-white shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
              <p className="text-sm font-semibold text-[#31435d]">Usuarios</p>
            </div>
            <div className="px-4 py-3 text-sm max-h-[420px] overflow-y-auto">
              {loadingData ? (
                <p className="text-gray-600">Cargando usuarios...</p>
              ) : users.length === 0 ? (
                <p className="text-gray-600">No se encontraron usuarios.</p>
              ) : (
                <div className="space-y-3">
                  <div className="max-w-xs">
                    <label className="block text-xs mb-1 text-gray-600">Buscar usuario</label>
                    <Input
                      type="text"
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      placeholder="Nombre o rol"
                      className="h-10 text-base"
                    />
                  </div>
                  <ul className="space-y-1">
                    {filteredUsers.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => onSelectUser(u.id)}
                        className={
                          "w-full text-left px-2 py-1 rounded-md border text-xs flex flex-col gap-0.5 " +
                          (u.id === selectedUserId
                            ? "border-[#3cadaf] bg-emerald-50 text-[#0f172a]"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700")
                        }
                      >
                        <span className="font-medium">{u.full_name || u.id}</span>
                        <span className="text-[11px] text-gray-500">
                          Rol actual: {u.role ?? "sin rol"}
                        </span>
                      </button>
                    </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
                <p className="text-sm font-semibold text-[#31435d]">Asignaciones del usuario</p>
              </div>
              <div className="px-4 py-4 text-sm space-y-3">
                {!selectedUser && (
                  <p className="text-gray-600">Seleccioná un usuario de la lista de la izquierda.</p>
                )}

                {selectedUser && (
                  <>
                    <p className="text-xs text-gray-600 mb-1">
                      Usuario seleccionado: <span className="font-medium">{selectedUser.full_name || selectedUser.id}</span>
                    </p>

                    <form onSubmit={onAddAssignment} className="space-y-2 border-b pb-3 mb-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Academia</label>
                        <Popover open={academySelectOpen} onOpenChange={setAcademySelectOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={saving || availableAcademies.length === 0}
                              className="w-full justify-between text-xs font-normal"
                            >
                              <span className="truncate mr-2">
                                {(() => {
                                  if (!newAcademyId) return 'Seleccionar academia...';
                                  const a = availableAcademies.find((x) => x.id === newAcademyId);
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
                                  const filtered = availableAcademies.filter((a) => {
                                    const t = (academySelectQuery || '').toLowerCase();
                                    if (!t) return true;
                                    return `${a.name || ''} ${a.id || ''}`.toLowerCase().includes(t);
                                  });
                                  const limited = filtered.slice(0, 50);

                                  if (availableAcademies.length === 0) {
                                    return (
                                      <div className="px-2 py-1.5 text-xs text-gray-500">
                                        Este usuario ya tiene todas las academias asignadas.
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
                                            setNewAcademyId(a.id);
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
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Rol en la academia</label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as "admin" | "coach" | "student")}
                          disabled={saving}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf] bg-white"
                        >
                          <option value="admin">Admin</option>
                          <option value="coach">Profesor</option>
                          <option value="student">Alumno</option>
                        </select>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={saving || !newAcademyId}
                          className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {saving ? "Agregando..." : "Agregar asignación"}
                        </button>
                      </div>
                      {availableAcademies.length === 0 && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Este usuario ya tiene todas las academias asignadas.
                        </p>
                      )}
                    </form>

                    <div className="space-y-1">
                      {assignments.length === 0 ? (
                        <p className="text-gray-600">Este usuario no tiene academias asignadas.</p>
                      ) : (
                        assignments.map((a) => {
                          const acad = academies.find((ac) => ac.id === a.academy_id) || null;
                          return (
                            <div
                              key={a.id}
                              className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5 text-xs"
                            >
                              <div>
                                <p className="font-medium text-[#31435d]">
                                  {acad?.name || "Academia desconocida"}
                                </p>
                                <p className="text-[11px] text-gray-500">Rol: {a.role}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onRemoveAssignment(a.id)}
                                disabled={removingId === a.id}
                                className="text-[11px] text-red-600 hover:text-red-700 disabled:opacity-60"
                              >
                                {removingId === a.id ? "Eliminando..." : "Quitar"}
                              </button>
                            </div>
                          );
                        })
                      )}
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

