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
      const { data, error: qErr } = await supabase
        .from("payments")
        .select(
          `id, amount, currency, payment_date, method, status,
           student_id,
           student_plans!inner(plan_id, plans(name)),
           students!inner(id, user_id),
           profiles!inner(id, full_name)`
        )
        .eq("status", "pagado")
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate)
        .order("payment_date", { ascending: true });

      if (qErr) throw qErr;

      const mapped: PaymentReportRow[] = (data as any[]).map((row) => ({
        id: row.id as string,
        student_id: row.student_id as string,
        student_name: row.profiles?.full_name ?? null,
        plan_name: row.student_plans?.plans?.name ?? null,
        amount: row.amount as number,
        currency: row.currency as string,
        payment_date: row.payment_date as string,
        method: row.method as string,
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
