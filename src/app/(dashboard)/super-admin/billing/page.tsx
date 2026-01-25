"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPyg } from "@/lib/formatters";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = {
  id: string;
  name: string;
};

type BillingRate = {
  id: string;
  academy_id: string;
  price_per_active_student: number;
  currency: string;
  valid_from: string;
  valid_to: string | null;
};

type BillingInvoice = {
  id: string;
  academy_id: string;
  period_year: number;
  period_month: number;
  count_cutoff_date: string;
  active_students_count: number;
  price_per_student: number;
  currency: string;
  total_amount: number;
  status: string;
  due_from_day: number;
  due_to_day: number;
  suspension_day: number;
  created_at: string;
};

type BillingPayment = {
  id: string;
  invoice_id: string;
  academy_id: string;
  paid_at: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  note: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

export default function BillingPage() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [role, setRole] = useState<AppRole>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string>("");

  const [currentRate, setCurrentRate] = useState<BillingRate | null>(null);
  const [newRateValue, setNewRateValue] = useState<string>("15000");
  const [newRateFrom, setNewRateFrom] = useState<string>(() => ymd(new Date()));
  const [savingRate, setSavingRate] = useState(false);

  const [invoiceYear, setInvoiceYear] = useState<number>(() => new Date().getFullYear());
  const [invoiceMonth, setInvoiceMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [activeStudentsCount, setActiveStudentsCount] = useState<number | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("transferencia");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [savingPayment, setSavingPayment] = useState(false);

  const isSuperAdmin = role === "super_admin";

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId]
  );

  const paidTotal = useMemo(() => {
    return payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);
  }, [payments]);

  const invoiceTotal = selectedInvoice?.total_amount ?? null;
  const pendingTotal = invoiceTotal != null ? Math.max(0, invoiceTotal - paidTotal) : null;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingUser(true);
      setError(null);
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        if (!active) return;
        setRole(null);
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
        if (!active) return;
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
      setLoading(true);
      setError(null);
      try {
        const { data, error: acadErr } = await supabase
          .from("academies")
          .select("id,name")
          .order("name", { ascending: true });
        if (acadErr) throw acadErr;
        if (!active) return;
        const list = (data ?? []) as Academy[];
        setAcademies(list);
        if (!selectedAcademyId && list.length > 0) {
          setSelectedAcademyId(list[0]?.id ?? "");
        }
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Error cargando academias.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase, selectedAcademyId]);

  useEffect(() => {
    if (role !== "super_admin") return;
    if (!selectedAcademyId) {
      setCurrentRate(null);
      setInvoices([]);
      setPayments([]);
      setSelectedInvoiceId("");
      setActiveStudentsCount(null);
      return;
    }

    let active = true;
    (async () => {
      setError(null);
      try {
        const today = ymd(new Date());

        const [{ data: rateRows, error: rateErr }, { data: invRows, error: invErr }] = await Promise.all([
          supabase
            .from("billing_academy_rates")
            .select("id,academy_id,price_per_active_student,currency,valid_from,valid_to")
            .eq("academy_id", selectedAcademyId)
            .or("valid_to.is.null,valid_to.gt." + today)
            .order("valid_from", { ascending: false })
            .limit(5),
          supabase
            .from("billing_invoices")
            .select(
              "id,academy_id,period_year,period_month,count_cutoff_date,active_students_count,price_per_student,currency,total_amount,status,due_from_day,due_to_day,suspension_day,created_at"
            )
            .eq("academy_id", selectedAcademyId)
            .order("period_year", { ascending: false })
            .order("period_month", { ascending: false })
            .limit(24),
        ]);

        if (rateErr) throw rateErr;
        if (invErr) throw invErr;
        if (!active) return;

        const picked = ((rateRows ?? []) as BillingRate[]).find((r) => r.valid_to == null) ?? null;
        setCurrentRate(picked);

        const inv = (invRows ?? []) as BillingInvoice[];
        setInvoices(inv);

        const selected =
          inv.find((i) => i.period_year === invoiceYear && i.period_month === invoiceMonth)?.id ?? "";
        setSelectedInvoiceId((prev) => (prev ? prev : selected));
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Error cargando facturación.");
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase, selectedAcademyId, invoiceYear, invoiceMonth]);

  useEffect(() => {
    if (role !== "super_admin") return;
    if (!selectedAcademyId) {
      setActiveStudentsCount(null);
      return;
    }
    let active = true;
    (async () => {
      setError(null);
      try {
        const { count, error: cntErr } = await supabase
          .from("user_academies")
          .select("id", { count: "exact", head: true })
          .eq("academy_id", selectedAcademyId)
          .eq("role", "student")
          .eq("is_active", true);
        if (cntErr) throw cntErr;
        if (!active) return;
        setActiveStudentsCount(count ?? 0);
      } catch (err: any) {
        if (!active) return;
        setActiveStudentsCount(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase, selectedAcademyId]);

  useEffect(() => {
    if (role !== "super_admin") return;
    if (!selectedInvoiceId) {
      setPayments([]);
      return;
    }

    let active = true;
    (async () => {
      setError(null);
      try {
        const { data, error: pErr } = await supabase
          .from("billing_payments")
          .select("id,invoice_id,academy_id,paid_at,amount,currency,method,reference,note")
          .eq("invoice_id", selectedInvoiceId)
          .order("paid_at", { ascending: false });
        if (pErr) throw pErr;
        if (!active) return;
        setPayments((data ?? []) as BillingPayment[]);
      } catch (err: any) {
        if (!active) return;
        setPayments([]);
        setError(err?.message ?? "Error cargando pagos.");
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase, selectedInvoiceId]);

  const onSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcademyId) return;

    const raw = newRateValue.replace(/\./g, "").replace(",", ".").trim();
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setError("El precio por alumno debe ser un número válido mayor o igual a 0.");
      return;
    }

    if (!newRateFrom || newRateFrom.length !== 10) {
      setError("Ingresá una fecha válida (YYYY-MM-DD).");
      return;
    }

    setSavingRate(true);
    setError(null);
    try {
      const newFrom = newRateFrom;

      const { data: existingRows, error: selErr } = await supabase
        .from("billing_academy_rates")
        .select("id,valid_from")
        .eq("academy_id", selectedAcademyId)
        .is("valid_to", null)
        .order("valid_from", { ascending: false })
        .limit(1);
      if (selErr) throw selErr;

      const current = (existingRows?.[0] as any) ?? null;
      if (current?.id) {
        const { error: updErr } = await supabase
          .from("billing_academy_rates")
          .update({ valid_to: newFrom })
          .eq("id", current.id);
        if (updErr) throw updErr;
      }

      const { error: insErr } = await supabase.from("billing_academy_rates").insert({
        academy_id: selectedAcademyId,
        price_per_active_student: value,
        currency: "PYG",
        valid_from: newFrom,
        valid_to: null,
      });
      if (insErr) throw insErr;

      setNewRateValue(String(value));

      const today = ymd(new Date());
      const { data: rateRows, error: rateErr } = await supabase
        .from("billing_academy_rates")
        .select("id,academy_id,price_per_active_student,currency,valid_from,valid_to")
        .eq("academy_id", selectedAcademyId)
        .or("valid_to.is.null,valid_to.gt." + today)
        .order("valid_from", { ascending: false })
        .limit(5);
      if (rateErr) throw rateErr;

      const picked = ((rateRows ?? []) as BillingRate[]).find((r) => r.valid_to == null) ?? null;
      setCurrentRate(picked);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar el precio por alumno.");
    } finally {
      setSavingRate(false);
    }
  };

  const onCreateInvoice = async () => {
    if (!selectedAcademyId) return;
    if (!currentRate) {
      setError("Primero configurá el precio por alumno activo para esta academia.");
      return;
    }

    const count = activeStudentsCount ?? 0;
    const total = count * (currentRate.price_per_active_student ?? 0);
    const cutoff = `${invoiceYear}-${pad2(invoiceMonth)}-01`;

    setCreatingInvoice(true);
    setError(null);
    try {
      const { data: existing, error: exErr } = await supabase
        .from("billing_invoices")
        .select("id")
        .eq("academy_id", selectedAcademyId)
        .eq("period_year", invoiceYear)
        .eq("period_month", invoiceMonth)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing?.id) {
        setSelectedInvoiceId(existing.id as string);
        return;
      }

      const { data: created, error: insErr } = await supabase
        .from("billing_invoices")
        .insert({
          academy_id: selectedAcademyId,
          period_year: invoiceYear,
          period_month: invoiceMonth,
          count_cutoff_date: cutoff,
          active_students_count: count,
          price_per_student: currentRate.price_per_active_student,
          currency: "PYG",
          total_amount: total,
          status: "issued",
        })
        .select(
          "id,academy_id,period_year,period_month,count_cutoff_date,active_students_count,price_per_student,currency,total_amount,status,due_from_day,due_to_day,suspension_day,created_at"
        )
        .single();
      if (insErr) throw insErr;

      setInvoices((prev) => [created as BillingInvoice, ...prev]);
      setSelectedInvoiceId((created as any)?.id ?? "");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear la factura.");
    } finally {
      setCreatingInvoice(false);
    }
  };

  const onAddPayment = async () => {
    if (!selectedAcademyId || !selectedInvoiceId) return;

    const raw = paymentAmount.replace(/\./g, "").replace(",", ".").trim();
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El monto del pago debe ser un número válido mayor a 0.");
      return;
    }

    if (!paymentMethod.trim()) {
      setError("Ingresá un método de pago.");
      return;
    }

    setSavingPayment(true);
    setError(null);
    try {
      const { data: created, error: insErr } = await supabase
        .from("billing_payments")
        .insert({
          invoice_id: selectedInvoiceId,
          academy_id: selectedAcademyId,
          amount,
          currency: "PYG",
          method: paymentMethod.trim(),
          reference: paymentReference.trim() ? paymentReference.trim() : null,
          note: paymentNote.trim() ? paymentNote.trim() : null,
        })
        .select("id,invoice_id,academy_id,paid_at,amount,currency,method,reference,note")
        .single();
      if (insErr) throw insErr;

      setPayments((prev) => [created as BillingPayment, ...prev]);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNote("");

      const nextStatus = (() => {
        const nextPaid = paidTotal + amount;
        const total = selectedInvoice?.total_amount ?? 0;
        if (nextPaid >= total && total > 0) return "paid";
        if (nextPaid > 0) return "partially_paid";
        return "issued";
      })();

      if (selectedInvoice?.status !== nextStatus) {
        const { error: updErr } = await supabase
          .from("billing_invoices")
          .update({ status: nextStatus })
          .eq("id", selectedInvoiceId);
        if (!updErr) {
          setInvoices((prev) => prev.map((i) => (i.id === selectedInvoiceId ? { ...i, status: nextStatus } : i)));
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "No se pudo registrar el pago.");
    } finally {
      setSavingPayment(false);
    }
  };

  if (loadingUser) {
    return (
      <section className="mt-4 space-y-4 max-w-5xl mx-auto px-4">
        <p className="text-sm text-gray-600">Cargando tu perfil...</p>
      </section>
    );
  }

  if (!isSuperAdmin) {
    return (
      <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Facturación Agendo</h1>
            <p className="text-sm text-gray-600">Acceso restringido.</p>
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
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-red-400 px-4 py-4 text-sm text-gray-700">
          <p className="font-semibold text-red-600 mb-1">Acceso restringido</p>
          <p>Solo super admin puede acceder a este módulo.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Facturación Agendo</h1>
          <p className="text-sm text-gray-600">Configuración de mensualidades (alumno activo) y control de pagos.</p>
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

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-indigo-500">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#31435d]">Academia</p>
            <p className="text-xs text-gray-600 mt-0.5">Seleccioná la academia para configurar su mensualidad.</p>
          </div>
          <div className="w-72">
            <select
              value={selectedAcademyId}
              onChange={(e) => setSelectedAcademyId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {academies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-4 py-4 text-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded-md bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Alumno activo (conteo actual)</p>
              <p className="text-lg font-semibold text-[#0f172a] tabular-nums">
                {activeStudentsCount == null ? "..." : activeStudentsCount}
              </p>
            </div>
            <div className="border rounded-md bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Precio vigente por alumno</p>
              <p className="text-lg font-semibold text-[#0f172a] tabular-nums">
                {currentRate ? formatPyg(currentRate.price_per_active_student) : "Sin configurar"}
              </p>
            </div>
            <div className="border rounded-md bg-white px-3 py-2">
              <p className="text-xs text-gray-500">Estimación mensual (conteo actual)</p>
              <p className="text-lg font-semibold text-[#0f172a] tabular-nums">
                {currentRate && activeStudentsCount != null
                  ? formatPyg(activeStudentsCount * currentRate.price_per_active_student)
                  : "-"}
              </p>
            </div>
          </div>

          <form onSubmit={onSaveRate} className="border rounded-md bg-gray-50 px-3 py-3 space-y-3">
            <p className="text-sm font-semibold text-[#31435d]">Configurar precio por alumno activo</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Precio (PYG)</label>
                <Input
                  value={newRateValue}
                  onChange={(e) => setNewRateValue(e.target.value)}
                  placeholder="15000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Vigente desde (YYYY-MM-DD)</label>
                <Input
                  value={newRateFrom}
                  onChange={(e) => setNewRateFrom(e.target.value)}
                  placeholder="2026-01-01"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={savingRate || !selectedAcademyId} className="w-full">
                  {savingRate ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              El precio es manual por academia (ej: 12.000 o 15.000). Se mantiene histórico por fechas.
            </p>
          </form>
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#31435d]">Facturas</p>
            <p className="text-xs text-gray-600 mt-0.5">Mes calendario, conteo al día 1. Pago del 5 al 10.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={String(invoiceYear)}
              onChange={(e) => setInvoiceYear(Number(e.target.value || 0))}
              className="w-24"
            />
            <select
              value={String(invoiceMonth)}
              onChange={(e) => setInvoiceMonth(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-2 text-sm bg-white"
            >
              {monthOptions.map((m) => (
                <option key={m} value={String(m)}>
                  {pad2(m)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={creatingInvoice || !selectedAcademyId}
              onClick={onCreateInvoice}
            >
              {creatingInvoice ? "Creando..." : "Crear / Abrir"}
            </Button>
          </div>
        </div>

        <div className="px-4 py-4 text-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">Listado</p>
              <div className="border rounded-md divide-y max-h-72 overflow-auto">
                {invoices.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">Todavía no hay facturas.</div>
                ) : (
                  invoices.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                        inv.id === selectedInvoiceId ? "bg-gray-50" : ""
                      }`}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-[#0f172a]">
                          {inv.period_year}-{pad2(inv.period_month)}
                        </div>
                        <div className="text-xs text-gray-500">{inv.status}</div>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {inv.active_students_count} activos × {formatPyg(inv.price_per_student)} = {formatPyg(inv.total_amount)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">Detalle / Pagos</p>
              {!selectedInvoice ? (
                <div className="border rounded-md px-3 py-2 text-xs text-gray-500">Seleccioná una factura.</div>
              ) : (
                <div className="space-y-3">
                  <div className="border rounded-md bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-base font-semibold text-[#0f172a] tabular-nums">{formatPyg(selectedInvoice.total_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pagado</p>
                        <p className="text-base font-semibold text-[#0f172a] tabular-nums">{formatPyg(paidTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pendiente</p>
                        <p className="text-base font-semibold text-[#0f172a] tabular-nums">
                          {pendingTotal == null ? "-" : formatPyg(pendingTotal)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Ventana de pago: día {selectedInvoice.due_from_day} al {selectedInvoice.due_to_day}. Posible suspensión desde el día {selectedInvoice.suspension_day}.
                    </p>
                  </div>

                  <div className="border rounded-md bg-gray-50 px-3 py-3 space-y-3">
                    <p className="text-sm font-semibold text-[#31435d]">Registrar pago</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Monto (PYG)</label>
                        <Input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Método</label>
                        <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Referencia</label>
                        <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Nota</label>
                        <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" disabled={savingPayment} onClick={onAddPayment}>
                        {savingPayment ? "Guardando..." : "Registrar"}
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-md divide-y max-h-56 overflow-auto bg-white">
                    {payments.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500">Sin pagos registrados.</div>
                    ) : (
                      payments.map((p) => (
                        <div key={p.id} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-[#0f172a] tabular-nums">{formatPyg(p.amount)}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(p.paid_at).toLocaleDateString("es-PY")}
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {p.method}
                            {p.reference ? ` · ${p.reference}` : ""}
                            {p.note ? ` · ${p.note}` : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Nota: el conteo mostrado es el actual. Para el conteo exacto del día 1, lo ideal es generar la factura el día 1.
          </div>
        </div>
      </div>
    </section>
  );
}
