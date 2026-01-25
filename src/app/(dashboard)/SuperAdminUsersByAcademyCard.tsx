"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClientBrowser } from "@/lib/supabase";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";

type Role = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = { id: string; name: string | null };

type UserAcademyRow = {
  academy_id: string | null;
  user_id: string | null;
  role: string | null;
  is_active: boolean | null;
};

type StatRow = {
  academyId: string;
  academyName: string;
  totalUsersCount: number;
  adminsCount: number;
  coachesCount: number;
  studentsCount: number;
};

export default function SuperAdminUsersByAcademyCard() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [rows, setRows] = useState<StatRow[]>([]);

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
        const [{ count: total, error: totalErr }, { data: acadRows, error: acadErr }, { data: uaRows, error: uaErr }] =
          await Promise.all([
            supabase.from("profiles").select("id", { count: "exact", head: true }),
            supabase.from("academies").select("id,name").order("name"),
            supabase.from("user_academies").select("academy_id,user_id,role,is_active"),
          ]);

        if (totalErr) throw totalErr;
        if (acadErr) throw acadErr;
        if (uaErr) throw uaErr;

        setTotalUsers(total ?? 0);

        const academies = ((acadRows ?? []) as Academy[]) ?? [];
        const academyNameById: Record<string, string> = {};
        academies.forEach((a) => {
          academyNameById[a.id] = a.name ?? a.id;
        });

        const usersByAcademy: Record<string, Set<string>> = {};
        const adminsByAcademy: Record<string, Set<string>> = {};
        const coachesByAcademy: Record<string, Set<string>> = {};
        const studentsByAcademy: Record<string, Set<string>> = {};

        for (const r of (uaRows ?? []) as UserAcademyRow[]) {
          const academyId = r.academy_id;
          const userId = r.user_id;
          if (!academyId || !userId) continue;
          const active = r.is_active ?? true;
          if (!active) continue;

          (usersByAcademy[academyId] ||= new Set()).add(userId);
          if (r.role === "admin") (adminsByAcademy[academyId] ||= new Set()).add(userId);
          if (r.role === "coach") (coachesByAcademy[academyId] ||= new Set()).add(userId);
          if (r.role === "student") (studentsByAcademy[academyId] ||= new Set()).add(userId);
        }

        const stats: StatRow[] = Object.keys(usersByAcademy)
          .map((academyId) => {
            const totalUsersCount = usersByAcademy[academyId]?.size ?? 0;
            const adminsCount = adminsByAcademy[academyId]?.size ?? 0;
            const coachesCount = coachesByAcademy[academyId]?.size ?? 0;
            const studentsCount = studentsByAcademy[academyId]?.size ?? 0;
            return {
              academyId,
              academyName: academyNameById[academyId] ?? academyId,
              totalUsersCount,
              adminsCount,
              coachesCount,
              studentsCount,
            };
          })
          .sort((a, b) => b.totalUsersCount - a.totalUsersCount);

        setRows(stats);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando métricas.");
        setTotalUsers(null);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, role]);

  if (role !== "super_admin") return null;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 10px 25px rgba(15,23,42,0.12)" }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="rounded-2xl p-4 bg-gradient-to-br from-slate-50 via-white to-emerald-50 shadow-sm border border-slate-100/60 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/60 focus:ring-offset-2"
      role="button"
      tabIndex={0}
      onClick={() => router.push('/users')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push('/users');
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100/80 text-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
            <Users className="w-3.5 h-3.5 text-[#3cadaf]" />
          </span>
          <span>Usuarios</span>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-gray-500">Usuarios totales</p>
          <p className="text-sm font-semibold text-[#0f172a] tabular-nums">{totalUsers == null ? "..." : totalUsers}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-600">Cargando...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-600">Sin datos por academia.</p>
      ) : (
        <div className="border rounded-xl bg-white/70 border-slate-100 overflow-hidden">
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 px-3">Academia</th>
                  <th className="py-2 px-3 text-center">Admins</th>
                  <th className="py-2 px-3 text-center">Profes</th>
                  <th className="py-2 px-3 text-center">Alumnos</th>
                  <th className="py-2 px-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.academyId} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-medium text-[#0f172a]">{r.academyName}</td>
                    <td className="py-2 px-3 tabular-nums text-center">{r.adminsCount}</td>
                    <td className="py-2 px-3 tabular-nums text-center">{r.coachesCount}</td>
                    <td className="py-2 px-3 tabular-nums text-center">{r.studentsCount}</td>
                    <td className="py-2 px-3 tabular-nums text-center">{r.totalUsersCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
