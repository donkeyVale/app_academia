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

interface StudentSummaryRow {
  student_id: string;
  student_name: string | null;
  total_amount: number;
  payments_count: number;
}

interface PlanSummaryRow {
  plan_name: string | null;
  total_amount: number;
  payments_count: number;
}

export default function ReportsPage() {
  const supabase = createClientBrowser();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentReportRow[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [studentSummary, setStudentSummary] = useState<StudentSummaryRow[]>([]);
  const [planSummary, setPlanSummary] = useState<PlanSummaryRow[]>([]);
  const [showStudentSummary, setShowStudentSummary] = useState(true);
  const [showPlanSummary, setShowPlanSummary] = useState(false);
  const [studentDetailModalOpen, setStudentDetailModalOpen] = useState(false);
  const [studentDetailName, setStudentDetailName] = useState<string | null>(null);
  const [studentDetailRows, setStudentDetailRows] = useState<PaymentReportRow[]>([]);
  const [planDetailModalOpen, setPlanDetailModalOpen] = useState(false);
  const [planDetailName, setPlanDetailName] = useState<string | null>(null);
  const [planDetailRows, setPlanDetailRows] = useState<PaymentReportRow[]>([]);

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

      // 4) Resumen por alumno
      const studentAgg: Record<string, StudentSummaryRow> = {};
      mapped.forEach((r) => {
        const key = r.student_id;
        if (!studentAgg[key]) {
          studentAgg[key] = {
            student_id: r.student_id,
            student_name: r.student_name,
            total_amount: 0,
            payments_count: 0,
          };
        }
        studentAgg[key].total_amount += r.amount || 0;
        studentAgg[key].payments_count += 1;
      });
      const studentSummaryRows = Object.values(studentAgg).sort(
        (a, b) => b.total_amount - a.total_amount
      );
      setStudentSummary(studentSummaryRows);

      // 5) Resumen por plan
      const planAgg: Record<string, PlanSummaryRow> = {};
      mapped.forEach((r) => {
        const key = r.plan_name ?? 'Sin nombre';
        if (!planAgg[key]) {
          planAgg[key] = {
            plan_name: r.plan_name,
            total_amount: 0,
            payments_count: 0,
          };
        }
        planAgg[key].total_amount += r.amount || 0;
        planAgg[key].payments_count += 1;
      });
      const planSummaryRows = Object.values(planAgg).sort(
        (a, b) => b.total_amount - a.total_amount
      );
      setPlanSummary(planSummaryRows);
    } catch (err: any) {
      setError(err.message || "Error cargando reporte de ingresos");
      setRows([]);
      setTotalAmount(0);
      setStudentSummary([]);
      setPlanSummary([]);
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

      <div className="border rounded-lg bg-white shadow-sm p-4 space-y-4">
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
          <>
            {/* Vista mobile: tarjetas apiladas */}
            <div className="mt-3 space-y-2 md:hidden">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-lg px-3 py-2 text-xs bg-white flex flex-col gap-1"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-[#31435d]">
                      {r.student_name ?? r.student_id}
                    </span>
                    <span className="text-gray-500">
                      {new Date(r.payment_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    <span className="font-semibold">Plan:</span>{" "}
                    {r.plan_name ?? "-"}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="capitalize text-gray-600">{r.method}</span>
                    <span className="font-semibold text-[#31435d]">
                      {r.amount} {r.currency}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista desktop: tabla clásica */}
            <div className="overflow-x-auto mt-3 hidden md:block">
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
          </>
        )}
      </div>

      {/* Resumen por alumno */}
      {studentSummary.length > 0 && (
        <div className="border rounded-lg bg-white shadow-sm">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
            onClick={() => setShowStudentSummary((v) => !v)}
          >
            <span>Resumen por alumno</span>
            <span className="text-xs text-gray-500">{showStudentSummary ? '▼' : '▲'}</span>
          </button>
          {showStudentSummary && (
            <div className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <p className="text-xs text-gray-500">
                  Ordenado por monto total pagado (de mayor a menor).
                </p>
              </div>

              {/* Mobile: tarjetas */}
              <div className="mt-2 space-y-2 md:hidden">
                {studentSummary.map((s) => (
                  <button
                    key={s.student_id}
                    type="button"
                    className="border rounded-lg px-3 py-2 text-xs bg-white flex flex-col gap-1 text-left w-full"
                    onClick={() => {
                      const detail = rows.filter((r) => r.student_id === s.student_id);
                      setStudentDetailRows(detail);
                      setStudentDetailName(s.student_name ?? s.student_id);
                      setStudentDetailModalOpen(true);
                    }}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-[#31435d]">
                        {s.student_name ?? s.student_id}
                      </span>
                      <span className="text-gray-500">
                        {s.payments_count} pago{s.payments_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-semibold">Total:</span>{' '}
                      {s.total_amount} PYG
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop: tabla */}
              <div className="overflow-x-auto mt-2 hidden md:block">
                <table className="min-w-full text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 border-b">Alumno</th>
                      <th className="px-3 py-2 border-b text-right">Total pagado</th>
                      <th className="px-3 py-2 border-b text-right">Pagos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentSummary.map((s) => (
                      <tr
                        key={s.student_id}
                        className="border-b last:border-b-0 cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          const detail = rows.filter((r) => r.student_id === s.student_id);
                          setStudentDetailRows(detail);
                          setStudentDetailName(s.student_name ?? s.student_id);
                          setStudentDetailModalOpen(true);
                        }}
                      >
                        <td className="px-3 py-2 align-top">
                          {s.student_name ?? s.student_id}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {s.total_amount} PYG
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {s.payments_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resumen por plan */}
      {planSummary.length > 0 && (
        <div className="border rounded-lg bg-white shadow-sm">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
            onClick={() => setShowPlanSummary((v) => !v)}
          >
            <span>Resumen por plan</span>
            <span className="text-xs text-gray-500">{showPlanSummary ? '▼' : '▲'}</span>
          </button>
          {showPlanSummary && (
            <div className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <p className="text-xs text-gray-500">
                  Ordenado por monto total ingresado (de mayor a menor).
                </p>
              </div>

              {/* Mobile: tarjetas */}
              <div className="mt-2 space-y-2 md:hidden">
                {planSummary.map((p, idx) => (
                  <button
                    key={`${p.plan_name ?? 'sin-plan'}-${idx}`}
                    type="button"
                    className="border rounded-lg px-3 py-2 text-xs bg-white flex flex-col gap-1 text-left w-full"
                    onClick={() => {
                      const detail = rows.filter((r) => (r.plan_name ?? 'Sin nombre') === (p.plan_name ?? 'Sin nombre'));
                      setPlanDetailRows(detail);
                      setPlanDetailName(p.plan_name ?? 'Sin nombre');
                      setPlanDetailModalOpen(true);
                    }}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-[#31435d]">
                        {p.plan_name ?? 'Sin nombre'}
                      </span>
                      <span className="text-gray-500">
                        {p.payments_count} pago{p.payments_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-semibold">Total:</span>{' '}
                      {p.total_amount} PYG
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop: tabla */}
              <div className="overflow-x-auto mt-2 hidden md:block">
                <table className="min-w-full text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 border-b">Plan</th>
                      <th className="px-3 py-2 border-b text-right">Total ingresado</th>
                      <th className="px-3 py-2 border-b text-right">Pagos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planSummary.map((p, idx) => (
                      <tr
                        key={`${p.plan_name ?? 'sin-plan'}-${idx}`}
                        className="border-b last:border-b-0 cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          const detail = rows.filter((r) => (r.plan_name ?? 'Sin nombre') === (p.plan_name ?? 'Sin nombre'));
                          setPlanDetailRows(detail);
                          setPlanDetailName(p.plan_name ?? 'Sin nombre');
                          setPlanDetailModalOpen(true);
                        }}
                      >
                        <td className="px-3 py-2 align-top">
                          {p.plan_name ?? 'Sin nombre'}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {p.total_amount} PYG
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {p.payments_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {studentDetailModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <h2 className="text-lg font-semibold text-[#31435d]">Pagos del alumno</h2>
            </div>
            <div className="px-4 pt-2 pb-3 text-sm text-[#31435d] font-semibold border-b">
              {studentDetailName}
            </div>
            <div className="px-4 py-3 overflow-y-auto text-sm space-y-2">
              {studentDetailRows.length === 0 ? (
                <p className="text-xs text-gray-600">No hay pagos registrados en este periodo.</p>
              ) : (
                <ul className="text-xs space-y-2">
                  {studentDetailRows.map((r) => (
                    <li
                      key={r.id}
                      className="border rounded-lg px-3 py-2 bg-white flex flex-col gap-1"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[#31435d]">
                          {new Date(r.payment_date).toLocaleDateString()}
                        </span>
                        <span className="font-semibold text-[#31435d]">
                          {r.amount} {r.currency}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Plan:</span>{' '}
                        {r.plan_name ?? '-'}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Método:</span>{' '}
                        <span className="capitalize">{r.method}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t bg-white text-xs">
              <button
                type="button"
                className="px-3 py-2 border rounded"
                onClick={() => setStudentDetailModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {planDetailModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <h2 className="text-lg font-semibold text-[#31435d]">Pagos del plan</h2>
            </div>
            <div className="px-4 pt-2 pb-3 text-sm text-[#31435d] font-semibold border-b">
              {planDetailName}
            </div>
            <div className="px-4 py-3 overflow-y-auto text-sm space-y-2">
              {planDetailRows.length === 0 ? (
                <p className="text-xs text-gray-600">No hay pagos registrados en este periodo.</p>
              ) : (
                <ul className="text-xs space-y-2">
                  {planDetailRows.map((r) => (
                    <li
                      key={r.id}
                      className="border rounded-lg px-3 py-2 bg-white flex flex-col gap-1"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[#31435d]">
                          {new Date(r.payment_date).toLocaleDateString()}
                        </span>
                        <span className="font-semibold text-[#31435d]">
                          {r.amount} {r.currency}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Alumno:</span>{' '}
                        {r.student_name ?? r.student_id}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Método:</span>{' '}
                        <span className="capitalize">{r.method}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t bg-white text-xs">
              <button
                type="button"
                className="px-3 py-2 border rounded"
                onClick={() => setPlanDetailModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
