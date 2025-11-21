"use client";

import { useEffect, useState } from "react";
import { createClientBrowser } from "@/lib/supabase";

interface PaymentReportRow {
  id: string;
  student_id: string;
  student_name: string | null;
  plan_name: string | null;
  amount: number;
  currency: string;
  payment_date: string;
  method: string;
}

export default function ReportsPage() {
  const supabase = createClientBrowser();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentReportRow[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    // Por defecto: mes actual
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
    setFromDate(firstDay);
    setToDate(lastDay);
  }, []);

  const loadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) {
      setError("Selecciona un rango de fechas");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1) Traer pagos simples del rango
      const { data: paymentsData, error: payErr } = await supabase
        .from("payments")
        .select("id, student_id, student_plan_id, amount, currency, payment_date, method, status")
        .eq("status", "pagado")
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate)
        .order("payment_date", { ascending: true });

      if (payErr) throw payErr;

      const payments = (paymentsData ?? []) as {
        id: string;
        student_id: string;
        student_plan_id: string;
        amount: number;
        currency: string;
        payment_date: string;
        method: string;
        status: string;
      }[];

      if (payments.length === 0) {
        setRows([]);
        setTotalAmount(0);
        return;
      }

      // 2) Obtener nombres de alumnos (students + profiles)
      const studentIds = Array.from(new Set(payments.map((p) => p.student_id)));
      const { data: studentsData, error: studentsErr } = await supabase
        .from("students")
        .select("id, user_id");
      if (studentsErr) throw studentsErr;

      const students = (studentsData ?? []) as { id: string; user_id: string | null }[];
      const profileIds = Array.from(
        new Set(students.map((s) => s.user_id).filter((id): id is string => !!id))
      );

      let profilesMap: Record<string, string | null> = {};
      if (profileIds.length > 0) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", profileIds);
        if (profilesErr) throw profilesErr;
        profilesMap = (profilesData ?? []).reduce<Record<string, string | null>>(
          (acc, p: any) => {
            acc[p.id as string] = (p.full_name as string | null) ?? null;
            return acc;
          },
          {}
        );
      }

      const studentNameMap: Record<string, string | null> = {};
      students.forEach((s) => {
        studentNameMap[s.id] = s.user_id ? profilesMap[s.user_id] ?? null : null;
      });

      // 3) Obtener nombres de planes (student_plans + plans)
      const studentPlanIds = Array.from(new Set(payments.map((p) => p.student_plan_id)));
      let planNameMap: Record<string, string | null> = {};
      if (studentPlanIds.length > 0) {
        const { data: spData, error: spErr } = await supabase
          .from("student_plans")
          .select("id, plan_id, plans(name)")
          .in("id", studentPlanIds);
        if (spErr) throw spErr;
        planNameMap = (spData ?? []).reduce<Record<string, string | null>>(
          (acc, row: any) => {
            acc[row.id as string] = (row.plans?.name as string | null) ?? null;
            return acc;
          },
          {}
        );
      }

      const mapped: PaymentReportRow[] = payments.map((p) => ({
        id: p.id,
        student_id: p.student_id,
        student_name: studentNameMap[p.student_id] ?? null,
        plan_name: planNameMap[p.student_plan_id] ?? null,
        amount: p.amount,
        currency: p.currency,
        payment_date: p.payment_date,
        method: p.method,
      }));

      setRows(mapped);
      setTotalAmount(mapped.reduce((acc, r) => acc + (r.amount || 0), 0));
    } catch (err: any) {
      setError(err.message || "Error cargando reporte de ingresos");
      setRows([]);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#31435d]">Reportes / Ingresos</h1>
        <p className="text-sm text-gray-600">
          Consulta los ingresos registrados por pagos en un rango de fechas.
        </p>
      </div>

      <div className="border rounded-lg bg-white shadow-sm">
        <form onSubmit={loadReport} className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Desde</label>
              <input
                type="date"
                className="border rounded p-2 w-full text-base md:text-sm"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Hasta</label>
              <input
                type="date"
                className="border rounded p-2 w-full text-base md:text-sm"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 w-full md:w-auto disabled:opacity-50 text-sm"
                disabled={loading}
              >
                {loading ? "Cargando..." : "Ver ingresos"}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </form>
      </div>

      <div className="border rounded-lg bg-white shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p className="text-sm text-gray-600">Total ingresado en el periodo seleccionado</p>
            <p className="text-2xl font-semibold text-[#31435d]">
              {loading ? "..." : `${totalAmount} PYG`}
            </p>
          </div>
          <div className="text-xs text-gray-500">
            {rows.length > 0
              ? `Mostrando ${rows.length} pagos`
              : "Sin pagos en el rango seleccionado"}
          </div>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <table className="min-w-full text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 border-b">Fecha</th>
                  <th className="px-3 py-2 border-b">Alumno</th>
                  <th className="px-3 py-2 border-b">Plan</th>
                  <th className="px-3 py-2 border-b">Método</th>
                  <th className="px-3 py-2 border-b text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 align-top">
                      {new Date(r.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 align-top">{r.student_name ?? r.student_id}</td>
                    <td className="px-3 py-2 align-top">{r.plan_name ?? "-"}</td>
                    <td className="px-3 py-2 align-top capitalize">{r.method}</td>
                    <td className="px-3 py-2 align-top text-right">
                      {r.amount} {r.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
