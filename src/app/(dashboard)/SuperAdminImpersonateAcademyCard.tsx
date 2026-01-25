"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClientBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Building2, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Role = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = { id: string; name: string | null };

const LS_KEY = "impersonateAcademyId";
const LS_PREV_KEY = "selectedAcademyIdBeforeImpersonation";
const LS_NAME_KEY = "impersonateAcademyName";
const EVT = "impersonateAcademyIdChanged";

export default function SuperAdminImpersonateAcademyCard() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      const v = window.localStorage.getItem(LS_KEY);
      setImpersonateId(v && v.trim() ? v : null);
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setRole(null);
        return;
      }

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr) {
        setRole(null);
        return;
      }

      const r = (profile?.role as Role) ?? null;
      setRole(r === "super_admin" || r === "admin" || r === "coach" || r === "student" ? r : null);
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      if (role !== "super_admin") return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.from("academies").select("id,name").order("name");
        if (error) throw error;
        const list = ((data ?? []) as Academy[]) ?? [];
        setAcademies(list);
        setSelectedId((prev) => prev || (list[0]?.id ?? ""));
      } catch (e: any) {
        setError(e?.message ?? "No se pudieron cargar academias.");
        setAcademies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, role]);

  if (role !== "super_admin") return null;

  const onImpersonate = () => {
    if (typeof window === "undefined") return;
    if (!selectedId) return;

    const currentSelected = window.localStorage.getItem("selectedAcademyId");
    if (currentSelected && currentSelected !== selectedId) {
      window.localStorage.setItem(LS_PREV_KEY, currentSelected);
    }

    const selectedName = academies.find((a) => a.id === selectedId)?.name ?? null;
    window.localStorage.setItem(LS_KEY, selectedId);
    if (selectedName && selectedName.trim()) {
      window.localStorage.setItem(LS_NAME_KEY, selectedName);
    } else {
      window.localStorage.removeItem(LS_NAME_KEY);
    }
    window.dispatchEvent(new CustomEvent(EVT, { detail: { academyId: selectedId } }));
    window.localStorage.setItem("selectedAcademyId", selectedId);
    window.dispatchEvent(new CustomEvent("selectedAcademyIdChanged", { detail: { academyId: selectedId } }));

    // Ir al home para que se vea como admin (mismo comportamiento que reloguear)
    router.push("/");
  };

  const onExit = () => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(LS_KEY);
    window.localStorage.removeItem(LS_NAME_KEY);
    window.dispatchEvent(new CustomEvent(EVT, { detail: { academyId: null } }));

    const prev = window.localStorage.getItem(LS_PREV_KEY);
    if (prev && prev.trim()) {
      window.localStorage.setItem("selectedAcademyId", prev);
      window.dispatchEvent(new CustomEvent("selectedAcademyIdChanged", { detail: { academyId: prev } }));
    }

    window.localStorage.removeItem(LS_PREV_KEY);
  };

  const currentName = impersonateId
    ? academies.find((a) => a.id === impersonateId)?.name ?? impersonateId
    : null;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 10px 25px rgba(15,23,42,0.12)" }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="rounded-2xl p-4 bg-gradient-to-br from-amber-50 via-white to-rose-50 shadow-sm border border-amber-100/60 text-left"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 text-amber-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
          </span>
          <span>Ver como admin</span>
        </div>

        {impersonateId ? (
          <div className="text-[11px] text-gray-600 truncate">Activo: {currentName}</div>
        ) : (
          <div className="text-[11px] text-gray-500">Modo global</div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-600">Cargando academias...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Academia</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  {academies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name ?? a.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={onImpersonate} disabled={!selectedId}>
                  <Building2 className="w-4 h-4 mr-2" />
                  Entrar
                </Button>
                {impersonateId && (
                  <Button type="button" variant="outline" onClick={onExit}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Salir
                  </Button>
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-600">
            Al entrar, la app se comporta como <span className="font-semibold">admin</span> de esa academia (menús y filtros).
          </p>
        </div>
      )}
    </motion.div>
  );
}
