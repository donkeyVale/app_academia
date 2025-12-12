"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClientBrowser } from "@/lib/supabase";
import { formatPyg } from "@/lib/formatters";
import { Banknote, TrendingUp, TrendingDown } from "lucide-react";

type Role = "super_admin" | "admin" | "coach" | "student" | null;

export default function AdminHomeIncomeExpensesCard() {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incomeLast30, setIncomeLast30] = useState(0);
  const [expensesLast30, setExpensesLast30] = useState(0);
  const [fromDateLabel, setFromDateLabel] = useState<string>("");
  const [toDateLabel, setToDateLabel] = useState<string>("");

  // Sincronizar selectedAcademyId con localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const readFromStorage = () => {
      const stored = window.localStorage.getItem("selectedAcademyId");
      const value = stored && stored.trim() ? stored : null;
      setSelectedAcademyId((prev) => (prev === value ? prev : value));
    };

    readFromStorage();
    const id = window.setInterval(readFromStorage, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      setError(null);

      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setRole(null);
        return;
      }

      // Resolver rol desde profiles
      let roleFromProfile: Role = null;
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profErr) {
        const r = (profile?.role as Role) ?? null;
        roleFromProfile =
          r === "super_admin" || r === "admin" || r === "coach" || r === "student" ? r : null;
      }

      setRole(roleFromProfile);
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      if (role !== "admin" && role !== "super_admin") return;
      if (!selectedAcademyId) {
        setIncomeLast30(0);
        setExpensesLast30(0);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Rango últimos 30 días
        const today = new Date();
        const toDateIso = today.toISOString().slice(0, 10);
        const from = new Date(today);
        from.setDate(from.getDate() - 29);
        const fromDateIso = from.toISOString().slice(0, 10);

        setFromDateLabel(new Date(fromDateIso + "T00:00:00").toLocaleDateString());
        setToDateLabel(new Date(toDateIso + "T00:00:00").toLocaleDateString());

        // 1) Ingresos: payments asociados a student_plans de esta academia
        const { data: spData, error: spErr } = await supabase
          .from("student_plans")
          .select("id,academy_id")
          .eq("academy_id", selectedAcademyId);
        if (spErr) throw spErr;

        const planIds = ((spData ?? []) as { id: string }[]).map((p) => p.id);

        let totalIncome = 0;
        if (planIds.length > 0) {
          const { data: payData, error: payErr } = await supabase
            .from("payments")
            .select("amount,payment_date,status,student_plan_id")
            .in("student_plan_id", planIds)
            .eq("status", "pagado")
            .gte("payment_date", fromDateIso)
            .lte("payment_date", toDateIso);
          if (payErr) throw payErr;

          totalIncome = ((payData ?? []) as { amount: number | null }[]).reduce(
            (acc, p) => acc + (p.amount ?? 0),
            0,
          );
        }

        // 2) Egresos: clases en sedes de la academia * tarifa por clase del profesor
        let totalExpenses = 0;

        const { data: alData, error: alErr } = await supabase
          .from("academy_locations")
          .select("location_id")
          .eq("academy_id", selectedAcademyId);
        if (alErr) throw alErr;

        const locationIds = Array.from(
          new Set(
            ((alData ?? []) as { location_id: string | null }[])
              .map((r) => r.location_id)
              .filter((id): id is string => !!id),
          ),
        );

        if (locationIds.length > 0) {
          const { data: courtsData, error: courtsErr } = await supabase
            .from("courts")
            .select("id,location_id")
            .in("location_id", locationIds);
          if (courtsErr) throw courtsErr;

          const courts = (courtsData ?? []) as { id: string; location_id: string | null }[];
          const courtIds = courts.map((c) => c.id);

          if (courtIds.length > 0) {
            const { data: classesData, error: clsErr } = await supabase
              .from("class_sessions")
              .select("id,date,coach_id,court_id")
              .in("court_id", courtIds)
              .not("coach_id", "is", null)
              .gte("date", fromDateIso)
              .lte("date", toDateIso);
            if (clsErr) throw clsErr;

            const classes = (classesData ?? []) as {
              id: string;
              date: string;
              coach_id: string | null;
              court_id: string | null;
            }[];

            if (classes.length > 0) {
              const coachIds = Array.from(
                new Set(classes.map((c) => c.coach_id).filter((id): id is string => !!id)),
              );

              if (coachIds.length > 0) {
                const { data: feesData, error: feesErr } = await supabase
                  .from("coach_academy_fees")
                  .select("coach_id,fee_per_class")
                  .eq("academy_id", selectedAcademyId)
                  .in("coach_id", coachIds);
                if (feesErr) throw feesErr;

                const feeMap: Record<string, number | null> = {};
                (feesData ?? []).forEach((row: any) => {
                  feeMap[row.coach_id as string] = (row.fee_per_class as number | null) ?? null;
                });

                totalExpenses = classes.reduce((acc, cls) => {
                  const coachId = cls.coach_id as string | null;
                  if (!coachId) return acc;
                  const fee = feeMap[coachId] ?? 0;
                  return acc + (fee || 0);
                }, 0);
              }
            }
          }
        }

        setIncomeLast30(totalIncome);
        setExpensesLast30(totalExpenses);
      } catch (err: any) {
        setError(err?.message ?? "Error calculando ingresos y egresos.");
        setIncomeLast30(0);
        setExpensesLast30(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, role, selectedAcademyId]);

  if (role !== "admin" && role !== "super_admin") {
    return null;
  }

  const net = incomeLast30 - expensesLast30;
  const margin = incomeLast30 > 0 ? (net / incomeLast30) * 100 : null;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 10px 25px rgba(15,23,42,0.12)" }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm border border-emerald-100/60 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/60 focus:ring-offset-1"
      role="button"
      tabIndex={0}
      onClick={() => {
        router.push("/reports?preset=last30&section=income");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push("/reports?preset=last30&section=income");
        }
      }}
   >
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 text-emerald-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
            <Banknote className="w-3.5 h-3.5 text-[#3cadaf]" />
          </span>
          <span>Ingresos vs egresos</span>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-600">Calculando ingresos y egresos...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : !selectedAcademyId ? (
        <p className="text-xs text-gray-600">
          No hay academia seleccionada. Ve a Configuración &gt; Academias para elegir una.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Ganancia neta (30 días)</p>
            <p className="text-[11px] text-gray-500">
              {fromDateLabel && toDateLabel
                ? `Del ${fromDateLabel} al ${toDateLabel}`
                : "Rango últimos 30 días"}
            </p>
            <p
              className={`text-[clamp(1.75rem,3.5vw,2.25rem)] font-bold tracking-tight leading-tight ${
                net >= 0 ? "text-emerald-700" : "text-red-600"
              } whitespace-nowrap tabular-nums`}
            >
              <span>{formatPyg(net)}</span> <span className="text-base md:text-lg font-semibold">PYG</span>
            </p>
            <p className="mt-1 text-[10px] sm:text-[11px] flex flex-nowrap items-center gap-1 text-gray-600 whitespace-nowrap">
              {net >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              {margin !== null ? (
                <span className={net >= 0 ? "text-emerald-700" : "text-red-600"}>
                  Margen {margin.toFixed(1)}%
                </span>
              ) : (
                <span>Sin ingresos</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs md:text-sm">
            <div className="rounded-xl bg-white/70 border border-emerald-100 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Ingresos</p>
              <p className="text-[clamp(0.85rem,2.2vw,1.125rem)] font-semibold text-[#0f172a] leading-tight text-right whitespace-nowrap tabular-nums">
                {formatPyg(incomeLast30)} <span className="text-xs sm:text-sm font-semibold">PYG</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/70 border border-emerald-100 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Egresos</p>
              <p className="text-[clamp(0.85rem,2.2vw,1.125rem)] font-semibold text-[#0f172a] leading-tight text-right whitespace-nowrap tabular-nums">
                {formatPyg(expensesLast30)} <span className="text-xs sm:text-sm font-semibold">PYG</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
