"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPyg } from "@/lib/formatters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";

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

type SalesAgent = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

type AcademySalesAgent = {
  id: string;
  academy_id: string;
  sales_agent_id: string;
  commission_rate: number;
  valid_from: string;
  valid_to: string | null;
};

type BillingSalesCommission = {
  id: string;
  sales_agent_id: string;
  period_year: number;
  period_month: number;
  base_paid_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  paid_at: string | null;
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

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split("-");
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatYmd(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return "Seleccionar fecha";
  return date.toLocaleDateString("es-PY");
}

function displayYmd(value: string | null | undefined): string {
  const d = parseYmd(String(value ?? "").slice(0, 10));
  return d ? d.toLocaleDateString("es-PY") : "-";
}

function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const selectedDate = parseYmd(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 h-10"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <span className={selectedDate ? "" : "text-gray-400"}>{formatDisplay(selectedDate)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatYmd(date));
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
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
  const [academyRates, setAcademyRates] = useState<BillingRate[]>([]);
  const [newRateValue, setNewRateValue] = useState<string>("15000");
  const [newRateFrom, setNewRateFrom] = useState<string>(() => ymd(new Date()));
  const [savingRate, setSavingRate] = useState(false);

  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editRateFrom, setEditRateFrom] = useState<string>("");
  const [editRateTo, setEditRateTo] = useState<string>("");
  const [savingRateEdit, setSavingRateEdit] = useState(false);

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
  const [paymentPaidAt, setPaymentPaidAt] = useState<string>(() => ymd(new Date()));
  const [savingPayment, setSavingPayment] = useState(false);

  const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([]);
  const [salesAgentsLoading, setSalesAgentsLoading] = useState(false);
  const [newSalesAgentName, setNewSalesAgentName] = useState('');
  const [newSalesAgentEmail, setNewSalesAgentEmail] = useState('');
  const [creatingSalesAgent, setCreatingSalesAgent] = useState(false);

  const [academySalesAgents, setAcademySalesAgents] = useState<AcademySalesAgent[]>([]);
  const [academySalesAgentsLoading, setAcademySalesAgentsLoading] = useState(false);
  const [newAssignmentAgentId, setNewAssignmentAgentId] = useState('');
  const [newAssignmentRate, setNewAssignmentRate] = useState('0.20');
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [assignmentValidFrom, setAssignmentValidFrom] = useState<string>(() => ymd(new Date()));

  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editAssignmentRate, setEditAssignmentRate] = useState<string>('0.20');
  const [editAssignmentFrom, setEditAssignmentFrom] = useState<string>(() => ymd(new Date()));
  const [editAssignmentTo, setEditAssignmentTo] = useState<string>('');
  const [savingAssignmentEdit, setSavingAssignmentEdit] = useState(false);

  const [commissionMonthPaymentsTotal, setCommissionMonthPaymentsTotal] = useState<number | null>(null);
  const [commissionByAgent, setCommissionByAgent] = useState<Record<string, { basePaid: number; commissionAmount: number }>>({});
  const [commissionByAcademy, setCommissionByAcademy] = useState<
    Record<string, { totalPaid: number; totalCommission: number; byAgent: Record<string, { basePaid: number; commissionAmount: number }> }>
  >({});
  const [commissionLoading, setCommissionLoading] = useState(false);

  const [salesCommissions, setSalesCommissions] = useState<BillingSalesCommission[]>([]);
  const [salesCommissionsLoading, setSalesCommissionsLoading] = useState(false);
  const [markingCommissionAgentId, setMarkingCommissionAgentId] = useState<string | null>(null);
  const [markingCommissionPaidAt, setMarkingCommissionPaidAt] = useState<string>(() => ymd(new Date()));
  const [markingCommissionSaving, setMarkingCommissionSaving] = useState(false);

  const [activePanel, setActivePanel] = useState<'rates' | 'invoices' | 'commissions'>('invoices');

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

  const onDeleteRate = async (row: BillingRate) => {
    const ok = window.confirm(
      `Eliminar esta vigencia de tarifa?\n\n${displayYmd(row.valid_from)} → ${row.valid_to ? displayYmd(row.valid_to) : 'vigente'}\nMonto: ${formatPyg(row.price_per_active_student)}`
    );
    if (!ok) return;

    setError(null);
    try {
      const { error } = await supabase.from('billing_academy_rates').delete().eq('id', row.id);
      if (error) throw error;

      setAcademyRates((prev) => prev.filter((r) => r.id !== row.id));
      setEditingRateId((prev) => (prev === row.id ? null : prev));
      setCurrentRate((prev) => (prev?.id === row.id ? null : prev));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo eliminar la vigencia.');
    }
  };

  const onDeleteAssignment = async (row: AcademySalesAgent) => {
    const agentName = salesAgents.find((a) => a.id === row.sales_agent_id)?.name ?? row.sales_agent_id;
    const ok = window.confirm(
      `Eliminar esta asignación?\n\n${agentName}\n${displayYmd(row.valid_from)} → ${row.valid_to ? displayYmd(row.valid_to) : 'vigente'}\n%: ${(row.commission_rate ?? 0).toFixed(2)}`
    );
    if (!ok) return;

    setError(null);
    try {
      const { error } = await supabase.from('billing_academy_sales_agents').delete().eq('id', row.id);
      if (error) throw error;

      setAcademySalesAgents((prev) => prev.filter((r) => r.id !== row.id));
      setEditingAssignmentId((prev) => (prev === row.id ? null : prev));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo eliminar la asignación.');
    }
  };

  const onStartEditAssignment = (row: AcademySalesAgent) => {
    setError(null);
    setEditingAssignmentId(row.id);
    setEditAssignmentRate(String(row.commission_rate ?? 0));
    setEditAssignmentFrom(String(row.valid_from ?? '').slice(0, 10));
    setEditAssignmentTo(row.valid_to ? String(row.valid_to).slice(0, 10) : '');
  };

  const onCancelEditAssignment = () => {
    setEditingAssignmentId(null);
    setEditAssignmentTo('');
  };

  const onSaveAssignmentEdit = async () => {
    if (!editingAssignmentId) return;
    const rawRate = editAssignmentRate.replace(',', '.').trim();
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
      setError('El porcentaje debe ser un número entre 0 y 1 (ej: 0.20).');
      return;
    }
    const from = editAssignmentFrom.trim();
    const to = editAssignmentTo.trim();
    if (!from || from.length !== 10) {
      setError('Ingresá una fecha válida (YYYY-MM-DD).');
      return;
    }
    if (to && (to.length !== 10 || to <= from)) {
      setError('La fecha hasta debe ser posterior a la fecha desde.');
      return;
    }

    setSavingAssignmentEdit(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('billing_academy_sales_agents')
        .update({
          commission_rate: rate,
          valid_from: from,
          valid_to: to ? to : null,
        })
        .eq('id', editingAssignmentId)
        .select('id,academy_id,sales_agent_id,commission_rate,valid_from,valid_to')
        .single();
      if (error) throw error;

      setAcademySalesAgents((prev) => prev.map((r) => (r.id === editingAssignmentId ? (data as AcademySalesAgent) : r)));
      setEditingAssignmentId(null);
      setEditAssignmentTo('');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo editar la asignación.');
    } finally {
      setSavingAssignmentEdit(false);
    }
  };

  const onCloseAssignment = (row: AcademySalesAgent) => {
    onStartEditAssignment(row);
    const today = ymd(new Date());
    setEditAssignmentTo(today);
  };

  const onCreateSalesAgent = async () => {
    const name = newSalesAgentName.trim();
    const email = newSalesAgentEmail.trim();
    if (!name) {
      setError('Ingresá el nombre del vendedor.');
      return;
    }

    setCreatingSalesAgent(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('billing_sales_agents')
        .insert({ name, email: email || null, is_active: true })
        .select('id,name,email,phone,is_active')
        .single();
      if (error) throw error;

      setSalesAgents((prev) => {
        const next = [data as SalesAgent, ...prev];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setNewSalesAgentName('');
      setNewSalesAgentEmail('');
      if (!newAssignmentAgentId) {
        setNewAssignmentAgentId((data as any)?.id ?? '');
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo crear el vendedor.');
    } finally {
      setCreatingSalesAgent(false);
    }
  };

  const onAssignSalesAgent = async () => {
    if (!selectedAcademyId) return;
    if (!newAssignmentAgentId) {
      setError('Seleccioná un vendedor para asignar.');
      return;
    }

    const rawRate = newAssignmentRate.replace(',', '.').trim();
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
      setError('El porcentaje debe ser un número entre 0 y 1 (ej: 0.20).');
      return;
    }

    if (!assignmentValidFrom || assignmentValidFrom.length !== 10) {
      setError('Ingresá una fecha válida (YYYY-MM-DD).');
      return;
    }

    setAssigningAgent(true);
    setError(null);
    try {
      const newFrom = assignmentValidFrom;

      const { data: existingRows, error: exErr } = await supabase
        .from('billing_academy_sales_agents')
        .select('id,academy_id,sales_agent_id,commission_rate,valid_from,valid_to')
        .eq('academy_id', selectedAcademyId)
        .eq('sales_agent_id', newAssignmentAgentId)
        .order('valid_from', { ascending: true });
      if (exErr) throw exErr;

      const rows = (existingRows ?? []) as AcademySalesAgent[];
      if (rows.some((r) => String(r.valid_from).slice(0, 10) === newFrom)) {
        throw new Error('Ya existe una asignación para este vendedor con esa fecha de inicio.');
      }

      const overlappingCurrent = rows
        .filter((r) => String(r.valid_from).slice(0, 10) < newFrom)
        .filter((r) => !r.valid_to || String(r.valid_to).slice(0, 10) > newFrom)
        .sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from)))[0];

      const nextFuture = rows
        .filter((r) => String(r.valid_from).slice(0, 10) > newFrom)
        .sort((a, b) => String(a.valid_from).localeCompare(String(b.valid_from)))[0];

      if (overlappingCurrent?.id) {
        const currentFrom = String(overlappingCurrent.valid_from ?? '').slice(0, 10);
        if (newFrom <= currentFrom) {
          throw new Error('La fecha de inicio debe ser posterior al inicio de la asignación vigente.');
        }
        const { error: closeErr } = await supabase
          .from('billing_academy_sales_agents')
          .update({ valid_to: newFrom })
          .eq('id', overlappingCurrent.id);
        if (closeErr) throw closeErr;

        setAcademySalesAgents((prev) =>
          prev.map((r) => (r.id === overlappingCurrent.id ? ({ ...r, valid_to: newFrom } as AcademySalesAgent) : r))
        );
      }

      const { data, error } = await supabase
        .from('billing_academy_sales_agents')
        .insert({
          academy_id: selectedAcademyId,
          sales_agent_id: newAssignmentAgentId,
          commission_rate: rate,
          valid_from: newFrom,
          valid_to: nextFuture?.valid_from ? String(nextFuture.valid_from).slice(0, 10) : null,
        })
        .select('id,academy_id,sales_agent_id,commission_rate,valid_from,valid_to')
        .single();
      if (error) throw error;
      setAcademySalesAgents((prev) => [data as AcademySalesAgent, ...prev]);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo asignar el vendedor.');
    } finally {
      setAssigningAgent(false);
    }
  };

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
    if (role !== 'super_admin') return;
    let active = true;
    (async () => {
      setSalesAgentsLoading(true);
      try {
        const { data, error } = await supabase
          .from('billing_sales_agents')
          .select('id,name,email,phone,is_active')
          .order('name', { ascending: true });
        if (error) throw error;
        if (!active) return;
        setSalesAgents((data ?? []) as SalesAgent[]);
        if (!newAssignmentAgentId) {
          const first = (data ?? [])[0] as any;
          if (first?.id) setNewAssignmentAgentId(first.id as string);
        }
      } catch {
        if (!active) return;
        setSalesAgents([]);
      } finally {
        if (!active) return;
        setSalesAgentsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [role, supabase, newAssignmentAgentId]);

  useEffect(() => {
    if (role !== 'super_admin') return;
    if (!selectedAcademyId) {
      setAcademySalesAgents([]);
      return;
    }
    let active = true;
    (async () => {
      setAcademySalesAgentsLoading(true);
      try {
        const { data, error } = await supabase
          .from('billing_academy_sales_agents')
          .select('id,academy_id,sales_agent_id,commission_rate,valid_from,valid_to')
          .eq('academy_id', selectedAcademyId)
          .order('valid_from', { ascending: false });
        if (error) throw error;
        if (!active) return;
        setAcademySalesAgents((data ?? []) as AcademySalesAgent[]);
      } catch {
        if (!active) return;
        setAcademySalesAgents([]);
      } finally {
        if (!active) return;
        setAcademySalesAgentsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [role, supabase, selectedAcademyId]);

  useEffect(() => {
    if (role !== 'super_admin') return;
    let active = true;
    (async () => {
      setCommissionLoading(true);
      try {
        const y = invoiceYear;
        const m = invoiceMonth;
        if (!y || !m) {
          setCommissionMonthPaymentsTotal(null);
          setCommissionByAgent({});
          return;
        }

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
        if (!active) return;

        const payments = (payRows ?? []) as { academy_id: string; paid_at: string; amount: number | null }[];
        const assignments = (asgRows ?? []) as {
          academy_id: string;
          sales_agent_id: string;
          commission_rate: number | null;
          valid_from: string;
          valid_to: string | null;
        }[];

        const totalPaid = payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);
        setCommissionMonthPaymentsTotal(totalPaid);

        const byAgent: Record<string, { basePaid: number; commissionAmount: number }> = {};
        const byAcademy: Record<
          string,
          { totalPaid: number; totalCommission: number; byAgent: Record<string, { basePaid: number; commissionAmount: number }> }
        > = {};

        const findAssignmentsForPayment = (academyId: string, paidAtIso: string) => {
          const day = String(paidAtIso).slice(0, 10);
          return assignments
            .filter((a) => a.academy_id === academyId)
            .filter((a) => a.valid_from <= day)
            .filter((a) => !a.valid_to || day < a.valid_to);
        };

        for (const p of payments) {
          const academyId = p.academy_id;
          const amt = p.amount ?? 0;
          if (!academyId || amt <= 0) continue;

          const acadBucket = (byAcademy[academyId] ||= { totalPaid: 0, totalCommission: 0, byAgent: {} });
          acadBucket.totalPaid += amt;

          const activeAsg = findAssignmentsForPayment(academyId, p.paid_at);
          for (const a of activeAsg) {
            const agentId = a.sales_agent_id;
            const rate = Number(a.commission_rate ?? 0);
            if (!agentId) continue;
            if (!Number.isFinite(rate) || rate <= 0) continue;
            const bucket = (byAgent[agentId] ||= { basePaid: 0, commissionAmount: 0 });
            bucket.basePaid += amt;
            const comm = amt * rate;
            bucket.commissionAmount += comm;

            const ab = (acadBucket.byAgent[agentId] ||= { basePaid: 0, commissionAmount: 0 });
            ab.basePaid += amt;
            ab.commissionAmount += comm;
            acadBucket.totalCommission += comm;
          }
        }

        setCommissionByAgent(byAgent);
        setCommissionByAcademy(byAcademy);
      } catch {
        if (!active) return;
        setCommissionMonthPaymentsTotal(null);
        setCommissionByAgent({});
        setCommissionByAcademy({});
      } finally {
        if (!active) return;
        setCommissionLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [role, supabase, invoiceYear, invoiceMonth]);

  useEffect(() => {
    if (role !== 'super_admin') return;
    let active = true;
    (async () => {
      setSalesCommissionsLoading(true);
      try {
        const y = invoiceYear;
        const m = invoiceMonth;
        const { data, error } = await supabase
          .from('billing_sales_commissions')
          .select('id,sales_agent_id,period_year,period_month,base_paid_amount,commission_rate,commission_amount,status,paid_at')
          .eq('period_year', y)
          .eq('period_month', m)
          .order('commission_amount', { ascending: false });
        if (error) throw error;
        if (!active) return;
        setSalesCommissions((data ?? []) as BillingSalesCommission[]);
      } catch {
        if (!active) return;
        setSalesCommissions([]);
      } finally {
        if (!active) return;
        setSalesCommissionsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [role, supabase, invoiceYear, invoiceMonth]);

  const onMarkCommissionPaid = async (agentId: string) => {
    if (!agentId) return;
    const paidAtDay = (markingCommissionPaidAt || '').trim();
    if (!paidAtDay || paidAtDay.length !== 10) {
      setError('Ingresá una fecha de pago válida (YYYY-MM-DD).');
      return;
    }

    setMarkingCommissionSaving(true);
    setError(null);
    try {
      await fetch('/api/billing/commission-mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesAgentId: agentId,
          periodYear: invoiceYear,
          periodMonth: invoiceMonth,
          paidAt: `${paidAtDay}T12:00:00.000Z`,
        }),
      });

      const { data, error } = await supabase
        .from('billing_sales_commissions')
        .select('id,sales_agent_id,period_year,period_month,base_paid_amount,commission_rate,commission_amount,status,paid_at')
        .eq('period_year', invoiceYear)
        .eq('period_month', invoiceMonth)
        .order('commission_amount', { ascending: false });
      if (error) throw error;
      setSalesCommissions((data ?? []) as BillingSalesCommission[]);

      setMarkingCommissionAgentId(null);
      setMarkingCommissionPaidAt(ymd(new Date()));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo marcar la comisión como pagada.');
    } finally {
      setMarkingCommissionSaving(false);
    }
  };

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

        const rateList = (rateRows ?? []) as BillingRate[];
        setAcademyRates(rateList);
        const picked = rateList.find((r) => r.valid_to == null) ?? null;
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
        const currentFrom = String(current.valid_from ?? "").slice(0, 10);
        if (!currentFrom || newFrom <= currentFrom) {
          throw new Error(
            "La fecha 'vigente desde' debe ser posterior a la fecha vigente actual para evitar rangos inválidos."
          );
        }
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

  const onStartEditRate = (row: BillingRate) => {
    setError(null);
    setEditingRateId(row.id);
    setEditRateFrom(String(row.valid_from ?? '').slice(0, 10));
    setEditRateTo(row.valid_to ? String(row.valid_to).slice(0, 10) : '');
  };

  const onCancelEditRate = () => {
    setEditingRateId(null);
    setEditRateTo('');
  };

  const onSaveRateEdit = async () => {
    if (!editingRateId) return;
    const from = editRateFrom.trim();
    const to = editRateTo.trim();
    if (!from || from.length !== 10) {
      setError('Ingresá una fecha válida (YYYY-MM-DD).');
      return;
    }
    if (to && (to.length !== 10 || to <= from)) {
      setError('La fecha hasta debe ser posterior a la fecha desde.');
      return;
    }

    setSavingRateEdit(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('billing_academy_rates')
        .update({ valid_from: from, valid_to: to ? to : null })
        .eq('id', editingRateId)
        .select('id,academy_id,price_per_active_student,currency,valid_from,valid_to')
        .single();
      if (error) throw error;

      setAcademyRates((prev) => prev.map((r) => (r.id === editingRateId ? (data as BillingRate) : r)));
      setCurrentRate((prev) => (prev?.id === editingRateId ? (data as BillingRate) : prev));
      setEditingRateId(null);
      setEditRateTo('');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo editar la vigencia del precio.');
    } finally {
      setSavingRateEdit(false);
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

      // Notificar a admins (push + email) - best effort
      try {
        await fetch('/api/billing/invoice-issued', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academyId: selectedAcademyId,
            invoiceId: (created as any)?.id,
            periodYear: invoiceYear,
            periodMonth: invoiceMonth,
            totalAmount: total,
            currency: 'PYG',
            dueFromDay: (created as any)?.due_from_day ?? 5,
            dueToDay: (created as any)?.due_to_day ?? 10,
          }),
        });
      } catch {
        // ignore
      }
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

    const paidAtDay = (paymentPaidAt || '').trim();
    if (!paidAtDay || paidAtDay.length !== 10) {
      setError('Ingresá una fecha de pago válida (YYYY-MM-DD).');
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
          paid_at: `${paidAtDay}T12:00:00.000Z`,
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
      setPaymentPaidAt(ymd(new Date()));

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

      // Notificar a admins (push + email) - best effort
      try {
        await fetch('/api/billing/invoice-payment-registered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academyId: selectedAcademyId,
            invoiceId: selectedInvoiceId,
            paymentId: (created as any)?.id,
            periodYear: selectedInvoice?.period_year,
            periodMonth: selectedInvoice?.period_month,
            paidAt: (created as any)?.paid_at,
            amount,
            currency: 'PYG',
          }),
        });
      } catch {
        // ignore
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
    <section className="mt-4 space-y-4 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Facturación Agendo</h1>
          <p className="text-sm text-gray-600">Mensualidades, facturas, pagos y comisiones.</p>
        </div>
        <div className="flex items-center justify-end flex-1">
          <Link href="/" className="flex items-center">
            <div className="h-16 w-32 relative">
              <Image src="/icons/logoHome.png" alt="Agendo" fill className="object-contain" priority />
            </div>
          </Link>
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-b shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Academia</p>
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

            <div className="flex items-end gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Año</p>
                <Input
                  value={String(invoiceYear)}
                  onChange={(e) => setInvoiceYear(Number(e.target.value || 0))}
                  className="w-24"
                />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Mes</p>
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
              </div>
              <Button
                type="button"
                disabled={creatingInvoice || !selectedAcademyId}
                onClick={onCreateInvoice}
                className="h-10"
              >
                {creatingInvoice ? 'Creando...' : 'Crear / Abrir'}
              </Button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Button
              type="button"
              variant={activePanel === 'rates' ? 'default' : 'outline'}
              onClick={() => setActivePanel('rates')}
            >
              Tarifas
            </Button>
            <Button
              type="button"
              variant={activePanel === 'invoices' ? 'default' : 'outline'}
              onClick={() => setActivePanel('invoices')}
            >
              Facturas
            </Button>
            <Button
              type="button"
              variant={activePanel === 'commissions' ? 'default' : 'outline'}
              onClick={() => setActivePanel('commissions')}
            >
              Comisiones
            </Button>
            <div className="flex-1" />
            <div className="text-xs text-gray-500">
              {commissionLoading
                ? 'Calculando comisiones...'
                : commissionMonthPaymentsTotal == null
                  ? ''
                  : `Pagado mes: ${formatPyg(commissionMonthPaymentsTotal)}`}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Mobile: accordions */}
      <div className="sm:hidden space-y-3">
        <details className="border rounded-lg bg-white shadow-sm border-t-4 border-indigo-500" open>
          <summary className="px-4 py-3 border-b bg-gray-50 rounded-t-lg cursor-pointer">
            <p className="text-sm font-semibold text-[#31435d]">Tarifas</p>
            <p className="text-xs text-gray-600 mt-0.5">Precio por alumno activo (histórico por vigencias).</p>
          </summary>
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border rounded-md bg-white px-3 py-2">
                <p className="text-xs text-gray-500">Alumno activo (conteo actual)</p>
                <p className="text-lg font-semibold text-[#0f172a] tabular-nums">
                  {activeStudentsCount == null ? '...' : activeStudentsCount}
                </p>
              </div>
              <div className="border rounded-md bg-white px-3 py-2">
                <p className="text-xs text-gray-500">Precio vigente por alumno</p>
                <p className="text-lg font-semibold text-[#0f172a] tabular-nums">
                  {currentRate ? formatPyg(currentRate.price_per_active_student) : 'Sin configurar'}
                </p>
              </div>
              <div className="border rounded-md bg-white px-3 py-2">
                <p className="text-xs text-gray-500">Estimación mensual (conteo actual)</p>
                <p className="text-lg font-semibold text-[#0f172a] tabular-nums">
                  {currentRate && activeStudentsCount != null
                    ? formatPyg(activeStudentsCount * currentRate.price_per_active_student)
                    : '-'}
                </p>
              </div>
            </div>

            <form onSubmit={onSaveRate} className="mt-3 border rounded-md bg-gray-50 px-3 py-3 space-y-3">
              <p className="text-sm font-semibold text-[#31435d]">Configurar precio por alumno activo</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Precio (PYG)</label>
                  <Input value={newRateValue} onChange={(e) => setNewRateValue(e.target.value)} placeholder="15000" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Vigente desde (YYYY-MM-DD)</label>
                  <DatePickerField value={newRateFrom} onChange={setNewRateFrom} />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={savingRate || !selectedAcademyId} className="w-full">
                    {savingRate ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                El precio es manual por academia (ej: 12.000 o 15.000). Se mantiene histórico por fechas.
              </p>
            </form>

            <div className="mt-3 border rounded-md bg-white">
              <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#31435d]">Historial de tarifas</p>
                <span className="text-[11px] text-gray-500">{academyRates.length}</span>
              </div>
              <div className="divide-y">
                {academyRates.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">Sin tarifas cargadas.</div>
                ) : (
                  academyRates.map((r) => (
                    <div key={r.id} className="px-3 py-2">
                      {editingRateId === r.id ? (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-700">Desde</label>
                            <DatePickerField value={editRateFrom} onChange={setEditRateFrom} />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-700">Hasta (vacío = vigente)</label>
                            <DatePickerField value={editRateTo} onChange={setEditRateTo} />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" disabled={savingRateEdit} onClick={onSaveRateEdit}>
                              {savingRateEdit ? 'Guardando...' : 'Guardar'}
                            </Button>
                            <Button type="button" variant="outline" onClick={onCancelEditRate}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-[#0f172a] tabular-nums">{formatPyg(r.price_per_active_student)}</div>
                            <div className="text-[11px] text-gray-600">
                              {displayYmd(r.valid_from)}
                              {r.valid_to ? ` → ${displayYmd(r.valid_to)}` : ' → vigente'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => onStartEditRate(r)}>
                              Editar vigencia
                            </Button>
                            <Button type="button" variant="outline" onClick={() => onDeleteRate(r)}>
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </details>

        <details className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
          <summary className="px-4 py-3 border-b bg-gray-50 rounded-t-lg cursor-pointer">
            <p className="text-sm font-semibold text-[#31435d]">Facturas</p>
            <p className="text-xs text-gray-600 mt-0.5">Mes calendario, conteo al día 1. Pago del 5 al 10.</p>
          </summary>
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
                          inv.id === selectedInvoiceId ? 'bg-gray-50' : ''
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
                            {pendingTotal == null ? '-' : formatPyg(pendingTotal)}
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
                          <label className="text-xs font-medium text-gray-700">Fecha de pago efectivo</label>
                          <DatePickerField value={paymentPaidAt} onChange={setPaymentPaidAt} />
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
                          {savingPayment ? 'Guardando...' : 'Registrar'}
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
                              <div className="text-xs text-gray-500">{new Date(p.paid_at).toLocaleDateString('es-PY')}</div>
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {p.method}
                              {p.reference ? ` · ${p.reference}` : ''}
                              {p.note ? ` · ${p.note}` : ''}
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
        </details>

        <details className="border rounded-lg bg-white shadow-sm border-t-4 border-amber-500">
          <summary className="px-4 py-3 border-b bg-gray-50 rounded-t-lg cursor-pointer">
            <p className="text-sm font-semibold text-[#31435d]">Vendedores y comisiones</p>
            <p className="text-xs text-gray-600 mt-0.5">Basado en pagos reales del mes seleccionado.</p>
          </summary>
          <div className="px-4 py-4">
            <div className="text-xs text-gray-500 mb-3">Usá el periodo de arriba</div>

            <div className="text-sm space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded-md bg-white">
                  <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#31435d]">Vendedores</p>
                    <span className="text-[11px] text-gray-500">{salesAgentsLoading ? 'Cargando...' : `${salesAgents.length}`}</span>
                  </div>
                  <div className="px-3 py-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-1">
                        <label className="text-xs font-medium text-gray-700">Nombre</label>
                        <Input value={newSalesAgentName} onChange={(e) => setNewSalesAgentName(e.target.value)} />
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-xs font-medium text-gray-700">Email</label>
                        <Input value={newSalesAgentEmail} onChange={(e) => setNewSalesAgentEmail(e.target.value)} />
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <Button
                          type="button"
                          disabled={creatingSalesAgent}
                          onClick={onCreateSalesAgent}
                          className="w-full"
                        >
                          {creatingSalesAgent ? 'Creando...' : 'Crear'}
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-md divide-y max-h-56 overflow-auto">
                      {salesAgents.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-500">No hay vendedores.</div>
                      ) : (
                        salesAgents.map((a) => (
                          <div key={a.id} className="px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-[#0f172a]">{a.name}</div>
                              <div className="text-[11px] text-gray-500">{a.is_active ? 'Activo' : 'Inactivo'}</div>
                            </div>
                            <div className="text-[11px] text-gray-600 truncate">{a.email ?? '-'}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="border rounded-md bg-white">
                  <div className="px-3 py-2 border-b bg-gray-50">
                    <p className="text-sm font-semibold text-[#31435d]">Asignaciones por academia</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Podés asignar múltiples vendedores a una academia con distintos porcentajes.
                    </p>
                  </div>
                  <div className="px-3 py-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-700">Vendedor</label>
                        <select
                          value={newAssignmentAgentId}
                          onChange={(e) => setNewAssignmentAgentId(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">Seleccionar...</option>
                          {salesAgents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">% (0-1)</label>
                        <Input value={newAssignmentRate} onChange={(e) => setNewAssignmentRate(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">Desde</label>
                        <DatePickerField value={assignmentValidFrom} onChange={setAssignmentValidFrom} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" disabled={assigningAgent || !selectedAcademyId} onClick={onAssignSalesAgent}>
                        {assigningAgent ? 'Asignando...' : 'Asignar'}
                      </Button>
                    </div>

                    <div className="border rounded-md divide-y max-h-56 overflow-auto">
                      {academySalesAgentsLoading ? (
                        <div className="px-3 py-2 text-xs text-gray-500">Cargando asignaciones...</div>
                      ) : academySalesAgents.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-500">Sin asignaciones para esta academia.</div>
                      ) : (
                        academySalesAgents.map((row) => (
                          <div key={row.id} className="px-3 py-2">
                            {editingAssignmentId === row.id ? (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-[#0f172a]">
                                  {salesAgents.find((a) => a.id === row.sales_agent_id)?.name ?? row.sales_agent_id}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                  <div>
                                    <label className="text-xs font-medium text-gray-700">% (0-1)</label>
                                    <Input
                                      value={editAssignmentRate}
                                      onChange={(e) => setEditAssignmentRate(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-700">Desde</label>
                                    <DatePickerField value={editAssignmentFrom} onChange={setEditAssignmentFrom} />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-700">Hasta (vacío = vigente)</label>
                                    <DatePickerField value={editAssignmentTo} onChange={setEditAssignmentTo} />
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <Button type="button" disabled={savingAssignmentEdit} onClick={onSaveAssignmentEdit}>
                                      {savingAssignmentEdit ? 'Guardando...' : 'Guardar'}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={onCancelEditAssignment}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-[#0f172a]">
                                    {salesAgents.find((a) => a.id === row.sales_agent_id)?.name ?? row.sales_agent_id}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    {displayYmd(row.valid_from)}
                                    {row.valid_to ? ` → ${displayYmd(row.valid_to)}` : ' → vigente'}
                                    {` · ${(row.commission_rate ?? 0).toFixed(2)}`}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button type="button" variant="outline" onClick={() => onStartEditAssignment(row)}>
                                    Editar
                                  </Button>
                                  <Button type="button" variant="outline" onClick={() => onCloseAssignment(row)}>
                                    Cerrar
                                  </Button>
                                  <Button type="button" variant="outline" onClick={() => onDeleteAssignment(row)}>
                                    Eliminar
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-md bg-white">
                <div className="px-3 py-2 border-b bg-gray-50">
                  <p className="text-sm font-semibold text-[#31435d]">Comisiones del mes</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Calculadas como suma(pagos) × % por vendedor (según asignaciones vigentes).
                  </p>
                </div>
                <div className="px-3 py-3">
                  {commissionLoading ? (
                    <p className="text-xs text-gray-500">Calculando comisiones...</p>
                  ) : Object.keys(commissionByAgent).length === 0 ? (
                    <p className="text-xs text-gray-500">No hay comisiones calculadas para este mes.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-2 pr-3">Vendedor</th>
                            <th className="py-2 pr-3">Base pagada</th>
                            <th className="py-2 pr-3">Comisión</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(commissionByAgent)
                            .sort((a, b) => b[1].commissionAmount - a[1].commissionAmount)
                            .map(([agentId, row]) => (
                              <tr key={agentId} className="border-t">
                                <td className="py-2 pr-3 font-medium text-[#0f172a]">
                                  {salesAgents.find((a) => a.id === agentId)?.name ?? agentId}
                                </td>
                                <td className="py-2 pr-3 tabular-nums">{formatPyg(row.basePaid)}</td>
                                <td className="py-2 pr-3 tabular-nums">{formatPyg(row.commissionAmount)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-md bg-white">
                <div className="px-3 py-2 border-b bg-gray-50">
                  <p className="text-sm font-semibold text-[#31435d]">Pagos a vendedores (Agendo)</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Registro oficial del pago de comisiones (pending/paid) del mes seleccionado.
                  </p>
                </div>
                <div className="px-3 py-3">
                  {salesCommissionsLoading ? (
                    <p className="text-xs text-gray-500">Cargando comisiones...</p>
                  ) : salesCommissions.length === 0 ? (
                    <p className="text-xs text-gray-500">No hay comisiones registradas para este mes.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-2 pr-3">Vendedor</th>
                            <th className="py-2 pr-3">Base</th>
                            <th className="py-2 pr-3">Comisión</th>
                            <th className="py-2 pr-3">Estado</th>
                            <th className="py-2 pr-3">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesCommissions.map((c) => {
                            const agentName = salesAgents.find((a) => a.id === c.sales_agent_id)?.name ?? c.sales_agent_id;
                            const isPaid = c.status === 'paid';
                            const isEditing = markingCommissionAgentId === c.sales_agent_id;
                            return (
                              <tr key={c.id} className="border-t align-top">
                                <td className="py-2 pr-3 font-medium text-[#0f172a]">{agentName}</td>
                                <td className="py-2 pr-3 tabular-nums">{formatPyg(c.base_paid_amount)}</td>
                                <td className="py-2 pr-3 tabular-nums">{formatPyg(c.commission_amount)}</td>
                                <td className="py-2 pr-3">
                                  <span
                                    className={
                                      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                                      (isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')
                                    }
                                  >
                                    {isPaid
                                      ? `Pagada${c.paid_at ? ` · ${new Date(c.paid_at).toLocaleDateString('es-PY')}` : ''}`
                                      : 'Pendiente'}
                                  </span>
                                </td>
                                <td className="py-2 pr-3">
                                  {isPaid ? (
                                    <span className="text-[11px] text-gray-500">-</span>
                                  ) : isEditing ? (
                                    <div className="flex flex-col gap-2 min-w-[220px]">
                                      <div>
                                        <div className="text-[11px] text-gray-600 mb-1">Fecha de pago</div>
                                        <DatePickerField value={markingCommissionPaidAt} onChange={setMarkingCommissionPaidAt} />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          disabled={markingCommissionSaving}
                                          onClick={() => onMarkCommissionPaid(c.sales_agent_id)}
                                        >
                                          {markingCommissionSaving ? 'Guardando...' : 'Marcar pagada'}
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            setMarkingCommissionAgentId(null);
                                            setMarkingCommissionPaidAt(ymd(new Date()));
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setMarkingCommissionAgentId(c.sales_agent_id);
                                        setMarkingCommissionPaidAt(ymd(new Date()));
                                      }}
                                    >
                                      Marcar pagada
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-md bg-white">
                <div className="px-3 py-2 border-b bg-gray-50">
                  <p className="text-sm font-semibold text-[#31435d]">Comisión por academia</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Resumen del mes por academia (pagado y comisión total), con detalle por vendedor.
                  </p>
                </div>
                <div className="px-3 py-3">
                  {commissionLoading ? (
                    <p className="text-xs text-gray-500">Calculando...</p>
                  ) : Object.keys(commissionByAcademy).length === 0 ? (
                    <p className="text-xs text-gray-500">Sin datos por academia para este mes.</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(commissionByAcademy)
                        .sort((a, b) => b[1].totalCommission - a[1].totalCommission)
                        .map(([academyId, row]) => (
                          <div key={academyId} className="border rounded-md">
                            <div className="px-3 py-2 bg-gray-50 flex items-center justify-between gap-2">
                              <div className="font-medium text-[#0f172a]">
                                {academies.find((a) => a.id === academyId)?.name ?? academyId}
                              </div>
                              <div className="text-[11px] text-gray-600 tabular-nums">
                                Pagado: {formatPyg(row.totalPaid)} · Comisión: {formatPyg(row.totalCommission)}
                              </div>
                            </div>
                            <div className="px-3 py-2 overflow-x-auto">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-left text-gray-500">
                                    <th className="py-1 pr-3">Vendedor</th>
                                    <th className="py-1 pr-3">Base</th>
                                    <th className="py-1 pr-3">Comisión</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(row.byAgent)
                                    .sort((x, y) => y[1].commissionAmount - x[1].commissionAmount)
                                    .map(([agentId, r]) => (
                                      <tr key={agentId} className="border-t">
                                        <td className="py-1 pr-3 font-medium text-[#0f172a]">
                                          {salesAgents.find((a) => a.id === agentId)?.name ?? agentId}
                                        </td>
                                        <td className="py-1 pr-3 tabular-nums">{formatPyg(r.basePaid)}</td>
                                        <td className="py-1 pr-3 tabular-nums">{formatPyg(r.commissionAmount)}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Desktop: tabs */}
      <div className="hidden sm:block space-y-6">
        {activePanel === 'rates' && (
          <div className="border rounded-lg bg-white shadow-sm border-t-4 border-indigo-500">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#31435d]">Academia</p>
            <p className="text-xs text-gray-600 mt-0.5">Seleccioná la academia para configurar su mensualidad.</p>
          </div>
          <div className="text-xs text-gray-500">Usá el selector de arriba</div>
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
                <DatePickerField value={newRateFrom} onChange={setNewRateFrom} />
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

          <div className="border rounded-md bg-white">
            <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#31435d]">Historial de tarifas</p>
              <span className="text-[11px] text-gray-500">{academyRates.length}</span>
            </div>
            <div className="divide-y">
              {academyRates.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">Sin tarifas cargadas.</div>
              ) : (
                academyRates.map((r) => (
                  <div key={r.id} className="px-3 py-2">
                    {editingRateId === r.id ? (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-gray-700">Desde</label>
                          <DatePickerField value={editRateFrom} onChange={setEditRateFrom} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-gray-700">Hasta (vacío = vigente)</label>
                          <DatePickerField value={editRateTo} onChange={setEditRateTo} />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" disabled={savingRateEdit} onClick={onSaveRateEdit}>
                            {savingRateEdit ? 'Guardando...' : 'Guardar'}
                          </Button>
                          <Button type="button" variant="outline" onClick={onCancelEditRate}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-[#0f172a] tabular-nums">{formatPyg(r.price_per_active_student)}</div>
                          <div className="text-[11px] text-gray-600">
                            {displayYmd(r.valid_from)}
                            {r.valid_to ? ` → ${displayYmd(r.valid_to)}` : ' → vigente'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => onStartEditRate(r)}>
                            Editar vigencia
                          </Button>
                          <Button type="button" variant="outline" onClick={() => onDeleteRate(r)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
        )}

        {activePanel === 'invoices' && (
          <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#31435d]">Facturas</p>
            <p className="text-xs text-gray-600 mt-0.5">Mes calendario, conteo al día 1. Pago del 5 al 10.</p>
          </div>
          <div className="text-xs text-gray-500">Usá el periodo de arriba</div>
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
                        <label className="text-xs font-medium text-gray-700">Fecha de pago efectivo</label>
                        <DatePickerField value={paymentPaidAt} onChange={setPaymentPaidAt} />
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
        )}

        {activePanel === 'commissions' && (
          <div className="border rounded-lg bg-white shadow-sm border-t-4 border-amber-500">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#31435d]">Vendedores y comisiones</p>
            <p className="text-xs text-gray-600 mt-0.5">Comisión basada en pagos reales (billing_payments) del mes seleccionado.</p>
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap">Usá el periodo de arriba</div>
        </div>

        <div className="px-4 py-4 text-sm space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border rounded-md bg-white">
              <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#31435d]">Vendedores</p>
                <span className="text-[11px] text-gray-500">{salesAgentsLoading ? 'Cargando...' : `${salesAgents.length}`}</span>
              </div>
              <div className="px-3 py-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="md:col-span-1">
                    <label className="text-xs font-medium text-gray-700">Nombre</label>
                    <Input value={newSalesAgentName} onChange={(e) => setNewSalesAgentName(e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-medium text-gray-700">Email</label>
                    <Input value={newSalesAgentEmail} onChange={(e) => setNewSalesAgentEmail(e.target.value)} />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <Button type="button" disabled={creatingSalesAgent} onClick={onCreateSalesAgent} className="w-full">
                      {creatingSalesAgent ? 'Creando...' : 'Crear'}
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md divide-y max-h-56 overflow-auto">
                  {salesAgents.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">No hay vendedores.</div>
                  ) : (
                    salesAgents.map((a) => (
                      <div key={a.id} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-[#0f172a]">{a.name}</div>
                          <div className="text-[11px] text-gray-500">{a.is_active ? 'Activo' : 'Inactivo'}</div>
                        </div>
                        <div className="text-[11px] text-gray-600 truncate">{a.email ?? '-'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border rounded-md bg-white">
              <div className="px-3 py-2 border-b bg-gray-50">
                <p className="text-sm font-semibold text-[#31435d]">Asignaciones por academia</p>
                <p className="text-[11px] text-gray-600 mt-0.5">Podés asignar múltiples vendedores a una academia con distintos porcentajes.</p>
              </div>
              <div className="px-3 py-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-700">Vendedor</label>
                    <select
                      value={newAssignmentAgentId}
                      onChange={(e) => setNewAssignmentAgentId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Seleccionar...</option>
                      {salesAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">% (0-1)</label>
                    <Input value={newAssignmentRate} onChange={(e) => setNewAssignmentRate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Desde</label>
                    <DatePickerField value={assignmentValidFrom} onChange={setAssignmentValidFrom} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={assigningAgent || !selectedAcademyId} onClick={onAssignSalesAgent}>
                    {assigningAgent ? 'Asignando...' : 'Asignar'}
                  </Button>
                </div>

                <div className="border rounded-md divide-y max-h-56 overflow-auto">
                  {academySalesAgentsLoading ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Cargando asignaciones...</div>
                  ) : academySalesAgents.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Sin asignaciones para esta academia.</div>
                  ) : (
                    academySalesAgents.map((row) => (
                      <div key={row.id} className="px-3 py-2">
                        {editingAssignmentId === row.id ? (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-[#0f172a]">
                              {salesAgents.find((a) => a.id === row.sales_agent_id)?.name ?? row.sales_agent_id}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <div>
                                <label className="text-xs font-medium text-gray-700">% (0-1)</label>
                                <Input value={editAssignmentRate} onChange={(e) => setEditAssignmentRate(e.target.value)} />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-700">Desde</label>
                                <DatePickerField value={editAssignmentFrom} onChange={setEditAssignmentFrom} />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-700">Hasta (vacío = vigente)</label>
                                <DatePickerField value={editAssignmentTo} onChange={setEditAssignmentTo} />
                              </div>
                              <div className="flex items-end gap-2">
                                <Button type="button" disabled={savingAssignmentEdit} onClick={onSaveAssignmentEdit}>
                                  {savingAssignmentEdit ? 'Guardando...' : 'Guardar'}
                                </Button>
                                <Button type="button" variant="outline" onClick={onCancelEditAssignment}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-[#0f172a]">
                                {salesAgents.find((a) => a.id === row.sales_agent_id)?.name ?? row.sales_agent_id}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {displayYmd(row.valid_from)}
                                {row.valid_to ? ` → ${displayYmd(row.valid_to)}` : ' → vigente'}
                                {` · ${(row.commission_rate ?? 0).toFixed(2)}`}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => onStartEditAssignment(row)}>
                                Editar
                              </Button>
                              <Button type="button" variant="outline" onClick={() => onCloseAssignment(row)}>
                                Cerrar
                              </Button>
                              <Button type="button" variant="outline" onClick={() => onDeleteAssignment(row)}>
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-md bg-white">
            <div className="px-3 py-2 border-b bg-gray-50">
              <p className="text-sm font-semibold text-[#31435d]">Comisiones del mes</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Calculadas como suma(pagos) × % por vendedor (según asignaciones vigentes).</p>
            </div>
            <div className="px-3 py-3">
              {commissionLoading ? (
                <p className="text-xs text-gray-500">Calculando comisiones...</p>
              ) : Object.keys(commissionByAgent).length === 0 ? (
                <p className="text-xs text-gray-500">No hay comisiones calculadas para este mes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-3">Vendedor</th>
                        <th className="py-2 pr-3">Base pagada</th>
                        <th className="py-2 pr-3">Comisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(commissionByAgent)
                        .sort((a, b) => b[1].commissionAmount - a[1].commissionAmount)
                        .map(([agentId, row]) => (
                          <tr key={agentId} className="border-t">
                            <td className="py-2 pr-3 font-medium text-[#0f172a]">
                              {salesAgents.find((a) => a.id === agentId)?.name ?? agentId}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{formatPyg(row.basePaid)}</td>
                            <td className="py-2 pr-3 tabular-nums">{formatPyg(row.commissionAmount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-md bg-white">
            <div className="px-3 py-2 border-b bg-gray-50">
              <p className="text-sm font-semibold text-[#31435d]">Comisión por academia</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Resumen del mes por academia (pagado y comisión total), con detalle por vendedor.</p>
            </div>
            <div className="px-3 py-3">
              {commissionLoading ? (
                <p className="text-xs text-gray-500">Calculando...</p>
              ) : Object.keys(commissionByAcademy).length === 0 ? (
                <p className="text-xs text-gray-500">Sin datos por academia para este mes.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(commissionByAcademy)
                    .sort((a, b) => b[1].totalCommission - a[1].totalCommission)
                    .map(([academyId, row]) => (
                      <div key={academyId} className="border rounded-md">
                        <div className="px-3 py-2 bg-gray-50 flex items-center justify-between gap-2">
                          <div className="font-medium text-[#0f172a]">
                            {academies.find((a) => a.id === academyId)?.name ?? academyId}
                          </div>
                          <div className="text-[11px] text-gray-600 tabular-nums">
                            Pagado: {formatPyg(row.totalPaid)} · Comisión: {formatPyg(row.totalCommission)}
                          </div>
                        </div>
                        <div className="px-3 py-2 overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-1 pr-3">Vendedor</th>
                                <th className="py-1 pr-3">Base</th>
                                <th className="py-1 pr-3">Comisión</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(row.byAgent)
                                .sort((x, y) => y[1].commissionAmount - x[1].commissionAmount)
                                .map(([agentId, r]) => (
                                  <tr key={agentId} className="border-t">
                                    <td className="py-1 pr-3 font-medium text-[#0f172a]">
                                      {salesAgents.find((a) => a.id === agentId)?.name ?? agentId}
                                    </td>
                                    <td className="py-1 pr-3 tabular-nums">{formatPyg(r.basePaid)}</td>
                                    <td className="py-1 pr-3 tabular-nums">{formatPyg(r.commissionAmount)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
        )}
      </div>
    </section>
  );
}
