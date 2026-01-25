"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClientBrowser } from "@/lib/supabase";
import { formatPyg } from "@/lib/formatters";
import { BarChart3 } from "lucide-react";

type Role = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = { id: string; name: string | null };

type Row = { academy_id: string; total: number };

export default function SuperAdminAcademyRankingCard() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [role, setRole] = useState<Role>(null);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);

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
        const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        const to = new Date(Date.UTC(year, month, 1, 0, 0, 0));

        const [{ data: acadRows, error: acadErr }, { data: payRows, error: payErr }] = await Promise.all([
          supabase.from("academies").select("id,name").order("name"),
          supabase
            .from("billing_payments")
            .select("academy_id, paid_at, amount")
            .gte("paid_at", from.toISOString())
            .lt("paid_at", to.toISOString()),
        ]);

        if (acadErr) throw acadErr;
        if (payErr) throw payErr;

        const academiesList = ((acadRows ?? []) as Academy[]) ?? [];
        const payments = (payRows ?? []) as { academy_id: string; amount: number | null }[];

        const totals: Record<string, number> = {};
        for (const p of payments) {
          const id = p.academy_id;
          if (!id) continue;
          totals[id] = (totals[id] ?? 0) + (p.amount ?? 0);
        }

        const computed: Row[] = Object.entries(totals)
          .map(([academy_id, total]) => ({ academy_id, total }))
          .sort((a, b) => b.total - a.total);

        setAcademies(academiesList);
        setRows(computed);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando ranking.");
        setRows([]);
        setAcademies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, role, year, month]);

  if (role !== "super_admin") return null;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-PY", {
    month: "long",
    year: "numeric",
  });

  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
  const top = rows.slice(0, 10);

  const academyNameById = (id: string) => academies.find((a) => a.id === id)?.name ?? id;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 10px 25px rgba(15,23,42,0.12)" }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="rounded-2xl p-4 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-sm border border-indigo-100/60 text-left"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100/80 text-indigo-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
            <BarChart3 className="w-3.5 h-3.5 text-[#6366f1]" />
          </span>
          <span>Ranking academias</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={String(month)}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-2 text-xs bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
          <select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-2 text-xs bg-white"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-600">Cargando ranking...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : top.length === 0 ? (
        <p className="text-xs text-gray-600">Sin pagos registrados en {monthLabel}.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">Top 10 · {monthLabel}</p>
          <div className="space-y-2">
            {top.map((r, idx) => {
              const pct = max > 0 ? Math.round((r.total / max) * 100) : 0;
              return (
                <div key={r.academy_id} className="rounded-xl border border-indigo-100 bg-white/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0f172a] truncate">
                        {idx + 1}. {academyNameById(r.academy_id)}
                      </p>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#0f172a] tabular-nums">{formatPyg(r.total)}</p>
                      <p className="text-[10px] text-gray-500">PYG</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
