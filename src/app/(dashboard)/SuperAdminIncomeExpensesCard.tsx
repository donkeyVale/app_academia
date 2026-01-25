"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClientBrowser } from "@/lib/supabase";
import { formatPyg } from "@/lib/formatters";
import { Banknote, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type Role = "super_admin" | "admin" | "coach" | "student" | null;

function monthBounds(year: number, month: number): { fromYmd: string; toYmd: string } {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const toExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const fromYmd = from.toISOString().slice(0, 10);
  const toYmd = new Date(toExclusive.getTime() - 1).toISOString().slice(0, 10);
  return { fromYmd, toYmd };
}

export default function SuperAdminIncomeExpensesCard() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);

  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);

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
        const y = year;
        const m = month;
        const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const to = new Date(Date.UTC(y, m, 1, 0, 0, 0));

        const [{ data: payRows, error: payErr }, { data: asgRows, error: asgErr }] = await Promise.all([
          supabase
            .from('billing_payments')
            .select('academy_id, paid_at, amount')
            .gte('paid_at', from.toISOString())
            .lt('paid_at', to.toISOString()),
          supabase
            .from('billing_academy_sales_agents')
            .select('academy_id,sales_agent_id,commission_rate,valid_from,valid_to'),
        ]);
        if (payErr) throw payErr;
        if (asgErr) throw asgErr;

        const payments = (payRows ?? []) as { academy_id: string; paid_at: string; amount: number | null }[];
        const assignments = (asgRows ?? []) as {
          academy_id: string;
          sales_agent_id: string;
          commission_rate: number | null;
          valid_from: string;
          valid_to: string | null;
        }[];

        const totalIncome = payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);

        const findAssignmentsForPayment = (academyId: string, paidAtIso: string) => {
          const day = String(paidAtIso).slice(0, 10);
          return assignments
            .filter((a) => a.academy_id === academyId)
            .filter((a) => a.valid_from <= day)
            .filter((a) => !a.valid_to || day < a.valid_to);
        };

        let totalCommissions = 0;
        for (const p of payments) {
          const academyId = p.academy_id;
          const amt = p.amount ?? 0;
          if (!academyId || amt <= 0) continue;
          const activeAsg = findAssignmentsForPayment(academyId, p.paid_at);
          for (const a of activeAsg) {
            const rate = Number(a.commission_rate ?? 0);
            if (!Number.isFinite(rate) || rate <= 0) continue;
            totalCommissions += amt * rate;
          }
        }

        setIncome(totalIncome);
        setExpenses(totalCommissions);
      } catch (err: any) {
        setError(err?.message ?? "Error calculando ingresos y egresos.");
        setIncome(0);
        setExpenses(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, role, year, month]);

  if (role !== "super_admin") return null;

  const net = income - expenses;
  const margin = income > 0 ? (net / income) * 100 : null;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-PY", {
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 10px 25px rgba(15,23,42,0.12)" }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm border border-emerald-100/60 text-left"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 text-emerald-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
            <Banknote className="w-3.5 h-3.5 text-[#3cadaf]" />
          </span>
          <span>Ingresos vs egresos</span>
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
        <p className="text-xs text-gray-600">Calculando...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Resultado neto ({monthLabel})</p>
            <div className="flex flex-col">
              <p
                className={`text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold tracking-tight leading-tight ${
                  net >= 0 ? "text-emerald-700" : "text-red-600"
                } tabular-nums`}
              >
                {formatPyg(net)}
              </p>
              <p className="text-[11px] text-gray-500 leading-none">PYG</p>
            </div>
            <p className="mt-1 text-[10px] sm:text-[11px] flex flex-nowrap items-center gap-1 text-gray-600 whitespace-nowrap">
              {net >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              {margin !== null ? (
                <span className={net >= 0 ? "text-emerald-700" : "text-red-600"}>Margen {margin.toFixed(1)}%</span>
              ) : (
                <span>Sin ingresos</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-white/70 border border-emerald-100 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Ingresos (academias)</p>
              <div className="flex flex-col items-end">
                <p className="text-[clamp(0.85rem,2.2vw,1.125rem)] font-semibold text-[#0f172a] leading-tight tabular-nums">
                  {formatPyg(income)}
                </p>
                <p className="text-[11px] text-gray-500 leading-none">PYG</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/70 border border-emerald-100 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Egresos (comisiones)</p>
              <div className="flex flex-col items-end">
                <p className="text-[clamp(0.85rem,2.2vw,1.125rem)] font-semibold text-[#0f172a] leading-tight tabular-nums">
                  {formatPyg(expenses)}
                </p>
                <p className="text-[11px] text-gray-500 leading-none">PYG</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => router.push(`/super-admin/billing`)}
            >
              Ver facturación
            </Button>
            <Button
              type="button"
              className="text-xs"
              onClick={() => router.push(`/super-admin/billing`)}
            >
              Gestionar comisiones
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
