"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  HandCoins,
  Receipt,
  RefreshCcw,
  TrendingUpDown,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { formatPyg } from "@/lib/formatters";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = {
  id: string;
  name: string;
};

type UserAcademyRow = {
  academy_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

function getLocalHmFromIso(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "00:00";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(d);
}

function getLocalYmdFromIso(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "1970-01-01";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

const TZ = "America/Asuncion";

type AcademyStudentsRow = {
  academyId: string;
  academyName: string;
  activeStudentsCount: number;
  studentUserIds: string[];
};

type RentMode = "per_student" | "per_hour" | "both";

type IncomeExpenseRow = {
  academyId: string;
  academyName: string;
  income: number;
  expenses: number;
};

type IncomeExpenseTotals = {
  income: number;
  expenses: number;
  net: number;
  margin: number | null;
};

type AgingRow = {
  academyId: string;
  academyName: string;
  invoiced: number;
  paid: number;
  pending: number;
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90p: number;
};

type SalesCommissionRow = {
  salesAgentId: string;
  salesAgentName: string;
  basePaidAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: "pending" | "paid" | "cancelled" | string;
  paidAt: string | null;
};

type PaymentsMonthlyRow = {
  academyId: string;
  academyName: string;
  paymentsCount: number;
  totalPaid: number;
};

type InvoicesStatusRow = {
  academyId: string;
  academyName: string;
  invoicesCount: number;
  issuedCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  overdueCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
};

function CategoryChip({ label, tone }: { label: string; tone: "emerald" | "sky" | "fuchsia" | "amber" | "slate" }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "sky"
        ? "bg-sky-50 text-sky-700 ring-sky-200"
        : tone === "fuchsia"
          ? "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200"
          : tone === "amber"
            ? "bg-amber-50 text-amber-700 ring-amber-200"
            : "bg-slate-100 text-slate-700 ring-slate-200";

  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>{label}</span>;
}

function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  contentClassName,
}: {
  value: string;
  onValueChange: (val: string) => void;
  options: { id: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    return options.find((o) => o.id === value)?.label ?? null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="w-full text-sm border rounded-md px-3 py-2 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center justify-between gap-2"
        >
          <span className={selectedLabel ? "truncate" : "truncate text-gray-400"}>{selectedLabel ?? placeholder}</span>
          <span className="text-gray-400">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`p-3 max-w-[calc(100vw-2rem)] ${contentClassName ?? "w-80"}`}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar..."
          className="h-11 text-base"
          autoFocus
        />

        <div className="mt-2 max-h-52 overflow-auto border rounded-md divide-y text-sm bg-white">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">Sin resultados</div>
          ) : (
            filteredOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${o.id === value ? "bg-gray-50" : ""}`}
                onClick={() => {
                  onValueChange(o.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getLastClosedMonth(): { year: number; month: number } {
  const now = new Date();
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastPrevMonth = new Date(firstThisMonth.getTime() - 24 * 60 * 60 * 1000);
  return { year: lastPrevMonth.getFullYear(), month: lastPrevMonth.getMonth() + 1 };
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split("-");
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
}

function diffDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function formatDisplayDate(value: string): string {
  const dt = parseYmd(value);
  if (!dt) return "Seleccionar";
  return dt.toLocaleDateString("es-PY");
}

function addDaysYmd(ymdValue: string, deltaDays: number): string {
  const dt = parseYmd(ymdValue);
  if (!dt) return ymd(new Date());
  dt.setDate(dt.getDate() + deltaDays);
  return ymd(dt);
}

function toFromInclusiveIso(fromYmd: string): string {
  return new Date(fromYmd + "T00:00:00.000Z").toISOString();
}

function toToExclusiveIso(toYmd: string): string {
  const toExclusiveDate = new Date(toYmd + "T00:00:00.000Z");
  toExclusiveDate.setUTCDate(toExclusiveDate.getUTCDate() + 1);
  return toExclusiveDate.toISOString();
}

async function getLogoPngInfo() {
  const res = await fetch("/icons/LogoAgendo1024.png");
  if (!res.ok) throw new Error("No se pudo cargar el logo");
  const blob = await res.blob();
  const base64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Error leyendo logo"));
    reader.readAsDataURL(blob);
  });

  const objectUrl = URL.createObjectURL(blob);
  try {
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = document.createElement("img");
      img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      img.onerror = () => reject(new Error("Error cargando dimensiones del logo"));
      img.src = objectUrl;
    });
    return { base64, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-[clamp(1.15rem,2.6vw,1.4rem)] font-semibold tabular-nums ${valueClassName ?? "text-[#0f172a]"}`}>
        {value}
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClassName ?? "text-[#0f172a]"}`}>{value}</div>
    </div>
  );
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/]/g, "-")
    .replace(/[:*?\"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fetchProfilesFullNameMap({
  supabase,
  userIds,
}: {
  supabase: ReturnType<typeof createClientBrowser>;
  userIds: string[];
}): Promise<Record<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const out: Record<string, string> = {};
  const chunkSize = 500;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data: profilesData, error: profilesErr } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", chunk);
    if (profilesErr) throw profilesErr;
    for (const p of (profilesData ?? []) as ProfileRow[]) {
      out[p.id] = (p.full_name ?? p.id) as string;
    }
  }

  for (const id of unique) {
    if (!out[id]) out[id] = id;
  }

  return out;
}

export default function SuperAdminReportsPage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const incomeRunIdRef = useRef(0);
  const [role, setRole] = useState<AppRole>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cutoffDate, setCutoffDate] = useState<string>(() => ymd(new Date()));
  const [rows, setRows] = useState<AcademyStudentsRow[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string>("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const [incomeFromDate, setIncomeFromDate] = useState<string>(() => {
    const now = new Date();
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastPrevMonth = new Date(firstThisMonth.getTime() - 24 * 60 * 60 * 1000);
    const firstPrevMonth = new Date(lastPrevMonth.getFullYear(), lastPrevMonth.getMonth(), 1);
    return ymd(firstPrevMonth);
  });
  const [incomeToDate, setIncomeToDate] = useState<string>(() => {
    const now = new Date();
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastPrevMonth = new Date(firstThisMonth.getTime() - 24 * 60 * 60 * 1000);
    return ymd(lastPrevMonth);
  });
  const [incomeRows, setIncomeRows] = useState<IncomeExpenseRow[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [exportingIncomePdf, setExportingIncomePdf] = useState(false);
  const [exportingIncomeExcel, setExportingIncomeExcel] = useState(false);

  const [incomeSummary, setIncomeSummary] = useState<IncomeExpenseTotals>({
    income: 0,
    expenses: 0,
    net: 0,
    margin: null,
  });
  const [incomeSummaryLoading, setIncomeSummaryLoading] = useState(false);
  const [incomeSummaryError, setIncomeSummaryError] = useState<string | null>(null);
  const incomeSummaryRunIdRef = useRef(0);

  const incomeAutoLoadRef = useRef(false);

  const [agingAsOfDate, setAgingAsOfDate] = useState<string>(() => ymd(new Date()));
  const [agingRows, setAgingRows] = useState<AgingRow[]>([]);
  const [agingLoading, setAgingLoading] = useState(false);
  const [agingError, setAgingError] = useState<string | null>(null);
  const [exportingAgingPdf, setExportingAgingPdf] = useState(false);
  const [exportingAgingExcel, setExportingAgingExcel] = useState(false);
  const agingRunIdRef = useRef(0);

  const [{ year: commissionsYear, month: commissionsMonth }, setCommissionsPeriod] = useState(() => getLastClosedMonth());
  const [commissionsRows, setCommissionsRows] = useState<SalesCommissionRow[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [commissionsError, setCommissionsError] = useState<string | null>(null);
  const [exportingCommissionsPdf, setExportingCommissionsPdf] = useState(false);
  const [exportingCommissionsExcel, setExportingCommissionsExcel] = useState(false);
  const commissionsRunIdRef = useRef(0);
  const [markingCommissionPaidId, setMarkingCommissionPaidId] = useState<string | null>(null);

  const [{ year: paymentsYear, month: paymentsMonth }, setPaymentsPeriod] = useState(() => getLastClosedMonth());
  const [paymentsRows, setPaymentsRows] = useState<PaymentsMonthlyRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [exportingPaymentsPdf, setExportingPaymentsPdf] = useState(false);
  const [exportingPaymentsExcel, setExportingPaymentsExcel] = useState(false);
  const paymentsRunIdRef = useRef(0);

  const [{ year: invoicesYear, month: invoicesMonth }, setInvoicesPeriod] = useState(() => getLastClosedMonth());
  const [invoicesRows, setInvoicesRows] = useState<InvoicesStatusRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [exportingInvoicesPdf, setExportingInvoicesPdf] = useState(false);
  const [exportingInvoicesExcel, setExportingInvoicesExcel] = useState(false);
  const invoicesRunIdRef = useRef(0);

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
        const { data: profile, error: profErr } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (profErr) throw profErr;
        const r = (profile?.role as AppRole) ?? null;
        setRole(r);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando tu perfil.");
        setRole(null);
      } finally {
        if (!active) return;
        setLoadingUser(false);
      }
    })();

    return () => {
      active = false;
    };

  }, [supabase]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: academiesData, error: acadErr }, { data: uaData, error: uaErr }] = await Promise.all([
        supabase.from("academies").select("id,name").order("name"),
        supabase
          .from("user_academies")
          .select("academy_id,user_id,role,is_active")
          .eq("role", "student")
          .eq("is_active", true),
      ]);

      if (acadErr) throw acadErr;
      if (uaErr) throw uaErr;

      const academies = ((academiesData ?? []) as any[]).map((a) => ({
        id: a.id as string,
        name: (a.name as string | null) ?? (a.id as string),
      })) as Academy[];

      const academyNameById: Record<string, string> = {};
      for (const a of academies) academyNameById[a.id] = a.name ?? a.id;

      const uaRows = (uaData ?? []) as unknown as UserAcademyRow[];

      const usersByAcademy: Record<string, Set<string>> = {};
      for (const r of uaRows) {
        if (!r.academy_id || !r.user_id) continue;
        (usersByAcademy[r.academy_id] ||= new Set()).add(r.user_id);
      }

      const out: AcademyStudentsRow[] = Object.keys(usersByAcademy)
        .map((academyId) => {
          const ids = Array.from(usersByAcademy[academyId] ?? []);
          return {
            academyId,
            academyName: academyNameById[academyId] ?? academyId,
            activeStudentsCount: ids.length,
            studentUserIds: ids,
          };
        })
        .sort((a, b) => b.activeStudentsCount - a.activeStudentsCount);

      setRows(out);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando reporte.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyPayments = async () => {
    const y = Number(paymentsYear);
    const m = Number(paymentsMonth);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      setPaymentsError("Seleccioná un mes/año válido.");
      return;
    }

    const runId = (paymentsRunIdRef.current += 1);
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const timeoutMs = 60_000;
      const withTimeout = async <T,>(p: Promise<T>) => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error("La consulta tardó demasiado. Probá filtrar por academia.")), timeoutMs);
          }),
        ]);
      };

      const compute = async () => {
        const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const to = new Date(Date.UTC(y, m, 1, 0, 0, 0));

        const { data: academiesData, error: acadErr } = await supabase.from("academies").select("id,name").order("name");
        if (acadErr) throw acadErr;
        const academies = ((academiesData ?? []) as any[])
          .map((a) => ({ id: a.id as string, name: (a.name as string | null) ?? (a.id as string) }))
          .filter((a) => !!a.id) as { id: string; name: string }[];

        const scopeAcademies = selectedAcademyId ? academies.filter((a) => a.id === selectedAcademyId) : academies;
        const academyIds = scopeAcademies.map((a) => a.id);
        if (academyIds.length === 0) return [] as PaymentsMonthlyRow[];

        const academyNameById: Record<string, string> = {};
        for (const a of scopeAcademies) academyNameById[a.id] = a.name;

        const { data: payRows, error: payErr } = await supabase
          .from("billing_payments")
          .select("academy_id,paid_at,amount")
          .in("academy_id", academyIds)
          .gte("paid_at", from.toISOString())
          .lt("paid_at", to.toISOString());
        if (payErr) throw payErr;

        const byAcademy: Record<string, PaymentsMonthlyRow> = {};
        for (const p of (payRows ?? []) as any[]) {
          const academyId = p.academy_id as string;
          const amt = Number(p.amount ?? 0) || 0;
          if (!academyId || amt <= 0) continue;
          const row = (byAcademy[academyId] ||= {
            academyId,
            academyName: academyNameById[academyId] ?? academyId,
            paymentsCount: 0,
            totalPaid: 0,
          });
          row.paymentsCount += 1;
          row.totalPaid += amt;
        }

        return Object.values(byAcademy).sort((a, b) => b.totalPaid - a.totalPaid);
      };

      const result = await withTimeout(compute());
      if (runId !== paymentsRunIdRef.current) return;
      setPaymentsRows(result);
    } catch (e: any) {
      if (runId !== paymentsRunIdRef.current) return;
      setPaymentsRows([]);
      setPaymentsError(e?.message ?? "No se pudo cargar el reporte.");
    } finally {
      if (runId !== paymentsRunIdRef.current) return;
      setPaymentsLoading(false);
    }
  };

  const paymentsTotals = useMemo(() => {
    const totalPaid = paymentsRows.reduce((acc, r) => acc + (r.totalPaid || 0), 0);
    const paymentsCount = paymentsRows.reduce((acc, r) => acc + (r.paymentsCount || 0), 0);
    return { totalPaid, paymentsCount, academies: paymentsRows.length };
  }, [paymentsRows]);

  const onExportPaymentsExcel = async () => {
    setExportingPaymentsExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Pagos", { views: [{ state: "frozen", ySplit: 3 }] });

      ws.columns = [
        { header: "Academia", key: "academy", width: 34 },
        { header: "Pagos (cant.)", key: "count", width: 14 },
        { header: "Total cobrado", key: "total", width: 18 },
      ];

      ws.insertRow(1, [`Pagos recibidos - ${paymentsYear}-${pad2(paymentsMonth)}`]);
      ws.mergeCells("A1:C1");
      ws.getRow(1).font = { bold: true };
      ws.insertRow(2, [`Total: ${formatPyg(paymentsTotals.totalPaid)} · Pagos: ${paymentsTotals.paymentsCount}`]);
      ws.mergeCells("A2:C2");
      ws.getRow(2).font = { bold: true };

      ws.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

      for (const r of paymentsRows) {
        ws.addRow({
          academy: r.academyName,
          count: r.paymentsCount,
          total: r.totalPaid,
        });
      }

      ws.getColumn(2).numFmt = "#,##0";
      ws.getColumn(3).numFmt = "#,##0";

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = sanitizeFileName(`Agendo - Pagos recibidos - ${paymentsYear}-${pad2(paymentsMonth)}.xlsx`);
      downloadBlob(blob, fileName);
      toast.success("Excel generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar Excel.");
    } finally {
      setExportingPaymentsExcel(false);
    }
  };

  const onExportPaymentsPdf = async () => {
    setExportingPaymentsPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;
      let y = 46;

      doc.setFontSize(16);
      doc.setTextColor(15);
      doc.text("Pagos recibidos", marginX, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Período: ${paymentsYear}-${pad2(paymentsMonth)}`, marginX, y);
      y += 14;
      doc.setTextColor(30);
      doc.text(`Total: ${formatPyg(paymentsTotals.totalPaid)} · Pagos: ${String(paymentsTotals.paymentsCount)}`, marginX, y);

      autoTable(doc, {
        startY: y + 16,
        head: [["Academia", "Pagos", "Total cobrado"]],
        body: paymentsRows.map((r) => [r.academyName, String(r.paymentsCount), formatPyg(r.totalPaid)]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        columnStyles: {
          0: { cellWidth: pageWidth - marginX * 2 - 2 * 70 },
          1: { halign: "right", cellWidth: 70 },
          2: { halign: "right", cellWidth: 70 },
        },
        margin: { left: marginX, right: marginX },
      });

      const fileName = sanitizeFileName(`Agendo - Pagos recibidos - ${paymentsYear}-${pad2(paymentsMonth)}.pdf`);
      doc.save(fileName);
      toast.success("PDF generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar PDF.");
    } finally {
      setExportingPaymentsPdf(false);
    }
  };

  const loadInvoicesByStatus = async () => {
    const y = Number(invoicesYear);
    const m = Number(invoicesMonth);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      setInvoicesError("Seleccioná un mes/año válido.");
      return;
    }

    const runId = (invoicesRunIdRef.current += 1);
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const timeoutMs = 60_000;
      const withTimeout = async <T,>(p: Promise<T>) => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error("La consulta tardó demasiado. Probá filtrar por academia.")), timeoutMs);
          }),
        ]);
      };

      const compute = async () => {
        const { data: academiesData, error: acadErr } = await supabase.from("academies").select("id,name").order("name");
        if (acadErr) throw acadErr;
        const academies = ((academiesData ?? []) as any[])
          .map((a) => ({ id: a.id as string, name: (a.name as string | null) ?? (a.id as string) }))
          .filter((a) => !!a.id) as { id: string; name: string }[];

        const scopeAcademies = selectedAcademyId ? academies.filter((a) => a.id === selectedAcademyId) : academies;
        const academyIds = scopeAcademies.map((a) => a.id);
        if (academyIds.length === 0) return [] as InvoicesStatusRow[];

        const academyNameById: Record<string, string> = {};
        for (const a of scopeAcademies) academyNameById[a.id] = a.name;

        const { data: invRows, error: invErr } = await supabase
          .from("billing_invoices")
          .select("id,academy_id,total_amount,status,period_year,period_month")
          .in("academy_id", academyIds)
          .eq("period_year", y)
          .eq("period_month", m)
          .neq("status", "cancelled");
        if (invErr) throw invErr;

        const invoices = (invRows ?? []) as any[];
        const invoiceIds = invoices.map((r) => r.id as string).filter(Boolean);
        const paidByInvoice: Record<string, number> = {};

        if (invoiceIds.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < invoiceIds.length; i += chunkSize) {
            const chunk = invoiceIds.slice(i, i + chunkSize);
            const { data: payRows, error: payErr } = await supabase
              .from("billing_payments")
              .select("invoice_id,amount")
              .in("invoice_id", chunk);
            if (payErr) throw payErr;
            for (const p of (payRows ?? []) as any[]) {
              const invId = p.invoice_id as string;
              const amt = Number(p.amount ?? 0) || 0;
              if (!invId || amt <= 0) continue;
              paidByInvoice[invId] = (paidByInvoice[invId] ?? 0) + amt;
            }
          }
        }

        const byAcademy: Record<string, InvoicesStatusRow> = {};
        for (const inv of invoices) {
          const invId = inv.id as string;
          const academyId = inv.academy_id as string;
          const status = String(inv.status ?? "issued");
          const total = Number(inv.total_amount ?? 0) || 0;
          if (!academyId) continue;
          const paid = Number(paidByInvoice[invId] ?? 0) || 0;
          const pending = Math.max(0, total - paid);

          const row = (byAcademy[academyId] ||= {
            academyId,
            academyName: academyNameById[academyId] ?? academyId,
            invoicesCount: 0,
            issuedCount: 0,
            partiallyPaidCount: 0,
            paidCount: 0,
            overdueCount: 0,
            totalInvoiced: 0,
            totalPaid: 0,
            totalPending: 0,
          });

          row.invoicesCount += 1;
          row.totalInvoiced += total;
          row.totalPaid += paid;
          row.totalPending += pending;

          if (status === "paid") row.paidCount += 1;
          else if (status === "partially_paid") row.partiallyPaidCount += 1;
          else if (status === "overdue") row.overdueCount += 1;
          else row.issuedCount += 1;
        }

        return Object.values(byAcademy).sort((a, b) => b.totalPending - a.totalPending);
      };

      const result = await withTimeout(compute());
      if (runId !== invoicesRunIdRef.current) return;
      setInvoicesRows(result);
    } catch (e: any) {
      if (runId !== invoicesRunIdRef.current) return;
      setInvoicesRows([]);
      setInvoicesError(e?.message ?? "No se pudo cargar el reporte.");
    } finally {
      if (runId !== invoicesRunIdRef.current) return;
      setInvoicesLoading(false);
    }
  };

  const invoicesTotals = useMemo(() => {
    const totalInvoiced = invoicesRows.reduce((acc, r) => acc + (r.totalInvoiced || 0), 0);
    const totalPaid = invoicesRows.reduce((acc, r) => acc + (r.totalPaid || 0), 0);
    const totalPending = invoicesRows.reduce((acc, r) => acc + (r.totalPending || 0), 0);
    const invoicesCount = invoicesRows.reduce((acc, r) => acc + (r.invoicesCount || 0), 0);
    const overdueCount = invoicesRows.reduce((acc, r) => acc + (r.overdueCount || 0), 0);
    return { totalInvoiced, totalPaid, totalPending, invoicesCount, overdueCount, academies: invoicesRows.length };
  }, [invoicesRows]);

  const onExportInvoicesExcel = async () => {
    setExportingInvoicesExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Facturas", { views: [{ state: "frozen", ySplit: 3 }] });

      ws.columns = [
        { header: "Academia", key: "academy", width: 30 },
        { header: "Facturas", key: "count", width: 10 },
        { header: "Emitidas", key: "issued", width: 10 },
        { header: "Parcial", key: "partial", width: 10 },
        { header: "Pagadas", key: "paid", width: 10 },
        { header: "Vencidas", key: "overdue", width: 10 },
        { header: "Total facturado", key: "inv", width: 16 },
        { header: "Total cobrado", key: "paidAmt", width: 16 },
        { header: "Pendiente", key: "pending", width: 16 },
      ];

      ws.insertRow(1, [`Facturas por estado - ${invoicesYear}-${pad2(invoicesMonth)}`]);
      ws.mergeCells("A1:I1");
      ws.getRow(1).font = { bold: true };
      ws.insertRow(2, [`Facturado: ${formatPyg(invoicesTotals.totalInvoiced)} · Pendiente: ${formatPyg(invoicesTotals.totalPending)}`]);
      ws.mergeCells("A2:I2");
      ws.getRow(2).font = { bold: true };

      ws.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

      for (const r of invoicesRows) {
        ws.addRow({
          academy: r.academyName,
          count: r.invoicesCount,
          issued: r.issuedCount,
          partial: r.partiallyPaidCount,
          paid: r.paidCount,
          overdue: r.overdueCount,
          inv: r.totalInvoiced,
          paidAmt: r.totalPaid,
          pending: r.totalPending,
        });
      }

      for (const col of [2, 3, 4, 5, 6]) ws.getColumn(col).numFmt = "#,##0";
      for (const col of [7, 8, 9]) ws.getColumn(col).numFmt = "#,##0";

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = sanitizeFileName(`Agendo - Facturas por estado - ${invoicesYear}-${pad2(invoicesMonth)}.xlsx`);
      downloadBlob(blob, fileName);
      toast.success("Excel generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar Excel.");
    } finally {
      setExportingInvoicesExcel(false);
    }
  };

  const onExportInvoicesPdf = async () => {
    setExportingInvoicesPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const marginX = 36;
      let y = 46;

      doc.setFontSize(16);
      doc.setTextColor(15);
      doc.text("Facturas por estado", marginX, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Período: ${invoicesYear}-${pad2(invoicesMonth)}`, marginX, y);
      y += 14;
      doc.setTextColor(30);
      doc.text(`Facturado: ${formatPyg(invoicesTotals.totalInvoiced)} · Pendiente: ${formatPyg(invoicesTotals.totalPending)}`, marginX, y);

      autoTable(doc, {
        startY: y + 16,
        head: [["Academia", "Fact.", "Emit.", "Parcial", "Pag.", "Venc.", "Facturado", "Cobrado", "Pend."]],
        body: invoicesRows.map((r) => [
          r.academyName,
          String(r.invoicesCount),
          String(r.issuedCount),
          String(r.partiallyPaidCount),
          String(r.paidCount),
          String(r.overdueCount),
          formatPyg(r.totalInvoiced),
          formatPyg(r.totalPaid),
          formatPyg(r.totalPending),
        ]),
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right" },
        },
        margin: { left: marginX, right: marginX },
      });

      const fileName = sanitizeFileName(`Agendo - Facturas por estado - ${invoicesYear}-${pad2(invoicesMonth)}.pdf`);
      doc.save(fileName);
      toast.success("PDF generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar PDF.");
    } finally {
      setExportingInvoicesPdf(false);
    }
  };

  const loadSalesCommissions = async () => {
    const y = Number(commissionsYear);
    const m = Number(commissionsMonth);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      setCommissionsError("Seleccioná un mes/año válido.");
      return;
    }

    const runId = (commissionsRunIdRef.current += 1);
    setCommissionsLoading(true);
    setCommissionsError(null);
    try {
      const timeoutMs = 60_000;
      const withTimeout = async <T,>(p: Promise<T>) => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error("La consulta tardó demasiado. Probá de nuevo.")), timeoutMs);
          }),
        ]);
      };

      const compute = async () => {
        const [{ data: commRows, error: commErr }, { data: agentRows, error: agErr }] = await Promise.all([
          supabase
            .from("billing_sales_commissions")
            .select("sales_agent_id,period_year,period_month,base_paid_amount,commission_rate,commission_amount,status,paid_at")
            .eq("period_year", y)
            .eq("period_month", m)
            .neq("status", "cancelled"),
          supabase.from("billing_sales_agents").select("id,name").neq("is_active", false),
        ]);
        if (commErr) throw commErr;
        if (agErr) throw agErr;

        const byAgentId: Record<string, string> = {};
        for (const a of (agentRows ?? []) as any[]) {
          const id = (a as any)?.id as string | undefined;
          if (!id) continue;
          byAgentId[id] = ((a as any)?.name as string | undefined) ?? id;
        }

        const rows: SalesCommissionRow[] = ((commRows ?? []) as any[])
          .map((r) => {
            const agentId = (r as any)?.sales_agent_id as string;
            return {
              salesAgentId: agentId,
              salesAgentName: byAgentId[agentId] ?? agentId,
              basePaidAmount: Number((r as any)?.base_paid_amount ?? 0) || 0,
              commissionRate: Number((r as any)?.commission_rate ?? 0) || 0,
              commissionAmount: Number((r as any)?.commission_amount ?? 0) || 0,
              status: String((r as any)?.status ?? "pending"),
              paidAt: ((r as any)?.paid_at as string | null) ?? null,
            };
          })
          .sort((a, b) => b.commissionAmount - a.commissionAmount);

        return rows;
      };

      const result = await withTimeout(compute());
      if (runId !== commissionsRunIdRef.current) return;
      setCommissionsRows(result);
    } catch (e: any) {
      if (runId !== commissionsRunIdRef.current) return;
      setCommissionsRows([]);
      setCommissionsError(e?.message ?? "No se pudo cargar el reporte.");
    } finally {
      if (runId !== commissionsRunIdRef.current) return;
      setCommissionsLoading(false);
    }
  };

  const commissionsTotals = useMemo(() => {
    const base = commissionsRows.reduce((acc, r) => acc + (r.basePaidAmount || 0), 0);
    const total = commissionsRows.reduce((acc, r) => acc + (r.commissionAmount || 0), 0);
    const paid = commissionsRows
      .filter((r) => r.status === "paid")
      .reduce((acc, r) => acc + (r.commissionAmount || 0), 0);
    const pending = Math.max(0, total - paid);
    return { base, total, paid, pending };
  }, [commissionsRows]);

  const onExportCommissionsExcel = async () => {
    setExportingCommissionsExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Comisiones", { views: [{ state: "frozen", ySplit: 3 }] });

      ws.columns = [
        { header: "Vendedor", key: "agent", width: 34 },
        { header: "Base cobrada", key: "base", width: 16 },
        { header: "Tasa", key: "rate", width: 10 },
        { header: "Comisión", key: "commission", width: 16 },
        { header: "Estado", key: "status", width: 12 },
        { header: "Pagado en", key: "paidAt", width: 18 },
      ];

      ws.insertRow(1, [`Comisiones por vendedor - ${commissionsYear}-${pad2(commissionsMonth)}`]);
      ws.mergeCells("A1:F1");
      ws.getRow(1).font = { bold: true };
      ws.insertRow(2, [`Total comisiones: ${commissionsTotals.total} · Pendiente: ${commissionsTotals.pending}`]);
      ws.mergeCells("A2:F2");
      ws.getRow(2).font = { bold: true };

      ws.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

      for (const r of commissionsRows) {
        ws.addRow({
          agent: r.salesAgentName,
          base: r.basePaidAmount,
          rate: r.commissionRate,
          commission: r.commissionAmount,
          status: r.status,
          paidAt: r.paidAt ? formatDisplayDate(String(r.paidAt).slice(0, 10)) : "-",
        });
      }

      ws.getColumn(2).numFmt = "#,##0";
      ws.getColumn(4).numFmt = "#,##0";
      ws.getColumn(3).numFmt = "0.00%";

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = sanitizeFileName(`Agendo - Comisiones por vendedor - ${commissionsYear}-${pad2(commissionsMonth)}.xlsx`);
      downloadBlob(blob, fileName);
      toast.success("Excel generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar Excel.");
    } finally {
      setExportingCommissionsExcel(false);
    }
  };

  const onExportCommissionsPdf = async () => {
    setExportingCommissionsPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;
      let y = 46;

      doc.setFontSize(16);
      doc.setTextColor(15);
      doc.text("Comisiones por vendedor", marginX, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Período: ${commissionsYear}-${pad2(commissionsMonth)}`, marginX, y);
      y += 14;
      doc.setTextColor(30);
      doc.text(`Total: ${formatPyg(commissionsTotals.total)} · Pendiente: ${formatPyg(commissionsTotals.pending)}`, marginX, y);

      autoTable(doc, {
        startY: y + 16,
        head: [["Vendedor", "Base", "Tasa", "Comisión", "Estado"]],
        body: commissionsRows.map((r) => [
          r.salesAgentName,
          formatPyg(r.basePaidAmount),
          `${(r.commissionRate * 100).toFixed(1)}%`,
          formatPyg(r.commissionAmount),
          r.status,
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        columnStyles: {
          0: { cellWidth: pageWidth - marginX * 2 - 4 * 70 },
          1: { halign: "right", cellWidth: 70 },
          2: { halign: "right", cellWidth: 70 },
          3: { halign: "right", cellWidth: 70 },
          4: { halign: "left", cellWidth: 70 },
        },
        margin: { left: marginX, right: marginX },
      });

      const fileName = sanitizeFileName(`Agendo - Comisiones por vendedor - ${commissionsYear}-${pad2(commissionsMonth)}.pdf`);
      doc.save(fileName);
      toast.success("PDF generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar PDF.");
    } finally {
      setExportingCommissionsPdf(false);
    }
  };

  const onMarkCommissionPaid = async (salesAgentId: string) => {
    if (!salesAgentId) return;
    if (markingCommissionPaidId) return;
    const ok = window.confirm("¿Marcar esta comisión como pagada para el período seleccionado?");
    if (!ok) return;

    setMarkingCommissionPaidId(salesAgentId);
    try {
      let accessToken: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        accessToken = (data?.session?.access_token as string | undefined) ?? null;
      } catch {
        accessToken = null;
      }

      const res = await fetch("/api/billing/commission-mark-paid", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          salesAgentId,
          periodYear: commissionsYear,
          periodMonth: commissionsMonth,
          paidAt: new Date().toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error ?? "No se pudo marcar como pagada.");
      }

      setCommissionsRows((prev) =>
        prev.map((r) =>
          r.salesAgentId === salesAgentId
            ? {
                ...r,
                status: "paid",
                paidAt: new Date().toISOString(),
              }
            : r
        )
      );
      toast.success("Comisión marcada como pagada.");
      await loadSalesCommissions();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo marcar como pagada.");
    } finally {
      setMarkingCommissionPaidId(null);
    }
  };

  const loadIncomeSummary = async () => {
    const runId = (incomeSummaryRunIdRef.current += 1);
    setIncomeSummaryLoading(true);
    setIncomeSummaryError(null);
    try {
      const timeoutMs = 60_000;
      const withTimeout = async <T,>(p: Promise<T>) => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error("La consulta tardó demasiado. Probá de nuevo.")), timeoutMs);
          }),
        ]);
      };

      const compute = async () => {
        const fromInclusive = toFromInclusiveIso(incomeFromDate);
        const toExclusive = toToExclusiveIso(incomeToDate);

        const [{ data: payRows, error: payErr }, { data: asgRows, error: asgErr }] = await Promise.all([
          supabase
            .from("billing_payments")
            .select("academy_id, paid_at, amount")
            .gte("paid_at", fromInclusive)
            .lt("paid_at", toExclusive),
          supabase
            .from("billing_academy_sales_agents")
            .select("academy_id,sales_agent_id,commission_rate,valid_from,valid_to"),
        ]);
        if (payErr) throw payErr;
        if (asgErr) throw asgErr;

        const payments = (payRows ?? []) as any[];
        const assignments = (asgRows ?? []) as any[];

        const assignmentsByAcademy: Record<string, any[]> = {};
        for (const a of assignments) {
          const academyId = a.academy_id as string;
          if (!academyId) continue;
          (assignmentsByAcademy[academyId] ||= []).push(a);
        }

        let income = 0;
        let expenses = 0;

        for (const p of payments) {
          const amount = Number(p.amount ?? 0) || 0;
          income += amount;

          const academyId = p.academy_id as string;
          const paidAtIso = p.paid_at as string;
          if (!academyId || !paidAtIso || amount <= 0) continue;

          const paidYmdLocal = getLocalYmdFromIso(paidAtIso, TZ);
          const asgs = assignmentsByAcademy[academyId] ?? [];
          const active = asgs.find((asg) => {
            const from = asg.valid_from ? String(asg.valid_from).slice(0, 10) : null;
            const to = asg.valid_to ? String(asg.valid_to).slice(0, 10) : null;
            if (from && paidYmdLocal < from) return false;
            if (to && paidYmdLocal >= to) return false;
            return true;
          });

          const rate = active ? Number(active.commission_rate ?? 0) || 0 : 0;
          if (rate > 0) expenses += amount * rate;
        }

        const net = income - expenses;
        const margin = income > 0 ? (net / income) * 100 : null;

        return { income, expenses, net, margin } as IncomeExpenseTotals;
      };

      const totals = await withTimeout(compute());
      if (runId !== incomeSummaryRunIdRef.current) return;
      setIncomeSummary(totals);
    } catch (e: any) {
      if (runId !== incomeSummaryRunIdRef.current) return;
      setIncomeSummary({ income: 0, expenses: 0, net: 0, margin: null });
      setIncomeSummaryError(e?.message ?? "No se pudo cargar el resumen.");
    } finally {
      if (runId !== incomeSummaryRunIdRef.current) return;
      setIncomeSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (role !== "super_admin") return;
    if (incomeAutoLoadRef.current) return;
    incomeAutoLoadRef.current = true;
    void loadIncomeSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role !== "super_admin") return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const loadAging = async () => {
    const asOf = parseYmd(agingAsOfDate);
    if (!asOf) {
      setAgingError("Seleccioná una fecha válida.");
      return;
    }

    const runId = (agingRunIdRef.current += 1);
    setAgingLoading(true);
    setAgingError(null);
    try {
      const timeoutMs = 60_000;
      const withTimeout = async <T,>(p: Promise<T>) => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error("La consulta tardó demasiado. Probá filtrar por academia.")), timeoutMs);
          }),
        ]);
      };

      const compute = async () => {
        const { data: academiesData, error: acadErr } = await supabase.from("academies").select("id,name").order("name");
        if (acadErr) throw acadErr;
        const academies = ((academiesData ?? []) as any[])
          .map((a) => ({ id: a.id as string, name: (a.name as string | null) ?? (a.id as string) }))
          .filter((a) => !!a.id) as { id: string; name: string }[];

        const scopeAcademies = selectedAcademyId ? academies.filter((a) => a.id === selectedAcademyId) : academies;
        const academyIds = scopeAcademies.map((a) => a.id);
        if (academyIds.length === 0) return [] as AgingRow[];

        const { data: invRows, error: invErr } = await supabase
          .from("billing_invoices")
          .select("id,academy_id,period_year,period_month,total_amount,status,due_to_day")
          .in("academy_id", academyIds)
          .neq("status", "cancelled");
        if (invErr) throw invErr;

        const invoices = (invRows ?? []) as any[];
        const invoiceIds = invoices.map((i) => i.id as string).filter(Boolean);
        const paidByInvoice: Record<string, number> = {};

        if (invoiceIds.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < invoiceIds.length; i += chunkSize) {
            const chunk = invoiceIds.slice(i, i + chunkSize);
            const { data: payRows, error: payErr } = await supabase
              .from("billing_payments")
              .select("invoice_id,amount")
              .in("invoice_id", chunk);
            if (payErr) throw payErr;
            for (const p of (payRows ?? []) as any[]) {
              const invId = p.invoice_id as string;
              const amt = Number(p.amount ?? 0) || 0;
              if (!invId || amt <= 0) continue;
              paidByInvoice[invId] = (paidByInvoice[invId] ?? 0) + amt;
            }
          }
        }

        const academyNameById: Record<string, string> = {};
        for (const a of academies) academyNameById[a.id] = a.name;

        const outByAcademy: Record<string, AgingRow> = {};

        for (const inv of invoices) {
          const invId = inv.id as string;
          const academyId = inv.academy_id as string;
          if (!invId || !academyId) continue;
          if (selectedAcademyId && academyId !== selectedAcademyId) continue;

          const total = Number(inv.total_amount ?? 0) || 0;
          const paid = Number(paidByInvoice[invId] ?? 0) || 0;
          const pending = Math.max(0, total - paid);
          if (pending <= 0) continue;

          const year = Number(inv.period_year ?? 0) || 0;
          const month = Number(inv.period_month ?? 0) || 0;
          const dueToDay = Number(inv.due_to_day ?? 10) || 10;
          const dueDate = new Date(year, Math.max(0, month - 1), dueToDay);
          const daysPastDue = Math.max(0, diffDays(dueDate, asOf));

          const row = (outByAcademy[academyId] ||= {
            academyId,
            academyName: academyNameById[academyId] ?? academyId,
            invoiced: 0,
            paid: 0,
            pending: 0,
            bucket0_30: 0,
            bucket31_60: 0,
            bucket61_90: 0,
            bucket90p: 0,
          });

          row.invoiced += total;
          row.paid += paid;
          row.pending += pending;

          if (daysPastDue <= 30) row.bucket0_30 += pending;
          else if (daysPastDue <= 60) row.bucket31_60 += pending;
          else if (daysPastDue <= 90) row.bucket61_90 += pending;
          else row.bucket90p += pending;
        }

        return Object.values(outByAcademy)
          .sort((a, b) => b.pending - a.pending);
      };

      const result = await withTimeout(compute());
      if (runId !== agingRunIdRef.current) return;
      setAgingRows(result);
    } catch (e: any) {
      if (runId !== agingRunIdRef.current) return;
      setAgingRows([]);
      setAgingError(e?.message ?? "No se pudo cargar el reporte.");
    } finally {
      if (runId !== agingRunIdRef.current) return;
      setAgingLoading(false);
    }
  };

  const loadIncomeExpenses = async () => {
    if (!incomeFromDate || !incomeToDate) {
      setIncomeError("Selecciona un rango de fechas.");
      return;
    }
    if (incomeFromDate > incomeToDate) {
      setIncomeError("El rango de fechas es inválido.");
      return;
    }

    const runId = (incomeRunIdRef.current += 1);
    setIncomeLoading(true);
    setIncomeError(null);
    try {
      const timeoutMs = 60_000;
      const withTimeout = async <T,>(p: Promise<T>) => {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error("La consulta tardó demasiado. Probá filtrar por academia o acortar el rango.")), timeoutMs);
          }),
        ]);
      };

      const compute = async () => {
        const fromInclusive = toFromInclusiveIso(incomeFromDate);
        const toExclusive = toToExclusiveIso(incomeToDate);

        const { data: academiesData, error: acadErr } = await supabase.from("academies").select("id,name").order("name");
        if (acadErr) throw acadErr;
        const academies = ((academiesData ?? []) as any[])
          .map((a) => ({ id: a.id as string, name: (a.name as string | null) ?? (a.id as string) }))
          .filter((a) => !!a.id) as { id: string; name: string }[];

        const scopeAcademies = selectedAcademyId ? academies.filter((a) => a.id === selectedAcademyId) : academies;
        const academyIds = scopeAcademies.map((a) => a.id);
        if (academyIds.length === 0) return [] as IncomeExpenseRow[];

        const academyNameById: Record<string, string> = {};
        for (const a of scopeAcademies) academyNameById[a.id] = a.name;

        const [{ data: payRows, error: payErr }, { data: asgRows, error: asgErr }] = await Promise.all([
          supabase
            .from("billing_payments")
            .select("academy_id,paid_at,amount")
            .in("academy_id", academyIds)
            .gte("paid_at", fromInclusive)
            .lt("paid_at", toExclusive),
          supabase
            .from("billing_academy_sales_agents")
            .select("academy_id,sales_agent_id,commission_rate,valid_from,valid_to")
            .in("academy_id", academyIds),
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

        const incomeByAcademy: Record<string, number> = {};
        const expensesByAcademy: Record<string, number> = {};

        const asgByAcademy: Record<string, typeof assignments> = {};
        for (const a of assignments) {
          if (!a.academy_id) continue;
          (asgByAcademy[a.academy_id] ||= []).push(a);
        }

        const findAssignmentsForPayment = (academyId: string, paidAtIso: string) => {
          const day = String(paidAtIso).slice(0, 10);
          return (asgByAcademy[academyId] ?? [])
            .filter((a) => a.valid_from <= day)
            .filter((a) => !a.valid_to || day < a.valid_to);
        };

        for (const p of payments) {
          const academyId = p.academy_id;
          const amt = Number(p.amount ?? 0);
          if (!academyId || !Number.isFinite(amt) || amt <= 0) continue;

          incomeByAcademy[academyId] = (incomeByAcademy[academyId] ?? 0) + amt;

          const activeAsg = findAssignmentsForPayment(academyId, p.paid_at);
          let paymentCommissions = 0;
          for (const a of activeAsg) {
            const rate = Number(a.commission_rate ?? 0);
            if (!Number.isFinite(rate) || rate <= 0) continue;
            paymentCommissions += amt * rate;
          }
          if (paymentCommissions > 0) {
            expensesByAcademy[academyId] = (expensesByAcademy[academyId] ?? 0) + paymentCommissions;
          }
        }

        const out: IncomeExpenseRow[] = academyIds
          .map((academyId) => {
            const income = incomeByAcademy[academyId] ?? 0;
            const expenses = expensesByAcademy[academyId] ?? 0;
            return { academyId, academyName: academyNameById[academyId] ?? academyId, income, expenses };
          })
          .filter((r) => r.income !== 0 || r.expenses !== 0)
          .sort((a, b) => (b.income - b.expenses) - (a.income - a.expenses));

        return out;
      };

      const out = await withTimeout(compute());
      if (incomeRunIdRef.current !== runId) return;
      setIncomeRows(out);
    } catch (e: any) {
      if (incomeRunIdRef.current !== runId) return;
      setIncomeError(e?.message ?? "Error calculando ingresos y egresos.");
      setIncomeRows([]);
    } finally {
      if (incomeRunIdRef.current !== runId) return;
      setIncomeLoading(false);
    }
  };

  const academyOptions = useMemo(() => {
    const opts = rows
      .map((r) => ({ id: r.academyId, label: r.academyName }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ id: "", label: "Todas" }, ...opts];
  }, [rows]);

  const filtered = useMemo(() => {
    if (!selectedAcademyId) return rows;
    return rows.filter((r) => r.academyId === selectedAcademyId);
  }, [rows, selectedAcademyId]);

  const totalActive = useMemo(() => filtered.reduce((sum, r) => sum + (r.activeStudentsCount || 0), 0), [filtered]);

  const incomeTotals = useMemo<IncomeExpenseTotals>(() => {
    const income = incomeRows.reduce((acc, r) => acc + (r.income || 0), 0);
    const expenses = incomeRows.reduce((acc, r) => acc + (r.expenses || 0), 0);
    const net = income - expenses;
    const margin = income > 0 ? (net / income) * 100 : null;
    return { income, expenses, net, margin };
  }, [incomeRows]);

  const agingTotals = useMemo(() => {
    const invoiced = agingRows.reduce((acc, r) => acc + (r.invoiced || 0), 0);
    const paid = agingRows.reduce((acc, r) => acc + (r.paid || 0), 0);
    const pending = agingRows.reduce((acc, r) => acc + (r.pending || 0), 0);
    const b0 = agingRows.reduce((acc, r) => acc + (r.bucket0_30 || 0), 0);
    const b31 = agingRows.reduce((acc, r) => acc + (r.bucket31_60 || 0), 0);
    const b61 = agingRows.reduce((acc, r) => acc + (r.bucket61_90 || 0), 0);
    const b90 = agingRows.reduce((acc, r) => acc + (r.bucket90p || 0), 0);
    return { invoiced, paid, pending, b0, b31, b61, b90 };
  }, [agingRows]);

  const onExportAgingExcel = async () => {
    setExportingAgingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Aging", { views: [{ state: "frozen", ySplit: 3 }] });

      ws.columns = [
        { header: "Academia", key: "academy", width: 34 },
        { header: "Facturado", key: "invoiced", width: 16 },
        { header: "Cobrado", key: "paid", width: 16 },
        { header: "Pendiente", key: "pending", width: 16 },
        { header: "0-30", key: "b0", width: 14 },
        { header: "31-60", key: "b31", width: 14 },
        { header: "61-90", key: "b61", width: 14 },
        { header: "90+", key: "b90", width: 14 },
      ];

      ws.insertRow(1, [`Cuentas por cobrar (Aging) - Al día: ${formatDisplayDate(agingAsOfDate)}`]);
      ws.mergeCells("A1:H1");
      ws.getRow(1).font = { bold: true };
      ws.insertRow(2, [`Total pendiente: ${agingTotals.pending}`]);
      ws.mergeCells("A2:H2");
      ws.getRow(2).font = { bold: true };

      ws.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

      for (const r of agingRows) {
        ws.addRow({
          academy: r.academyName,
          invoiced: r.invoiced,
          paid: r.paid,
          pending: r.pending,
          b0: r.bucket0_30,
          b31: r.bucket31_60,
          b61: r.bucket61_90,
          b90: r.bucket90p,
        });
      }

      const numFmt = "#,##0";
      for (const key of ["invoiced", "paid", "pending", "b0", "b31", "b61", "b90"]) {
        const idx = (ws.columns.findIndex((c: any) => c.key === key) ?? -1) + 1;
        if (idx > 0) ws.getColumn(idx).numFmt = numFmt;
      }

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = sanitizeFileName(`Agendo - Cuentas por cobrar (Aging) - al ${agingAsOfDate}.xlsx`);
      downloadBlob(blob, fileName);
      toast.success("Excel generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar Excel.");
    } finally {
      setExportingAgingExcel(false);
    }
  };

  const onExportAgingPdf = async () => {
    setExportingAgingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;
      let y = 46;

      doc.setFontSize(16);
      doc.setTextColor(15);
      doc.text("Cuentas por cobrar (Aging)", marginX, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Al día: ${formatDisplayDate(agingAsOfDate)}`, marginX, y);
      y += 14;
      doc.setTextColor(30);
      doc.text(`Total pendiente: ${formatPyg(agingTotals.pending)}`, marginX, y);

      autoTable(doc, {
        startY: y + 16,
        head: [["Academia", "Fact.", "Cobr.", "Pend.", "0-30", "31-60", "61-90", "90+"]],
        body: agingRows.map((r) => [
          r.academyName,
          formatPyg(r.invoiced),
          formatPyg(r.paid),
          formatPyg(r.pending),
          formatPyg(r.bucket0_30),
          formatPyg(r.bucket31_60),
          formatPyg(r.bucket61_90),
          formatPyg(r.bucket90p),
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        columnStyles: {
          0: { cellWidth: pageWidth - marginX * 2 - 7 * 55 },
          1: { halign: "right", cellWidth: 55 },
          2: { halign: "right", cellWidth: 55 },
          3: { halign: "right", cellWidth: 55 },
          4: { halign: "right", cellWidth: 55 },
          5: { halign: "right", cellWidth: 55 },
          6: { halign: "right", cellWidth: 55 },
          7: { halign: "right", cellWidth: 55 },
        },
        margin: { left: marginX, right: marginX },
      });

      const fileName = sanitizeFileName(`Agendo - Cuentas por cobrar (Aging) - al ${agingAsOfDate}.pdf`);
      doc.save(fileName);
      toast.success("PDF generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar PDF.");
    } finally {
      setExportingAgingPdf(false);
    }
  };

  const onExportIncomePdf = async () => {
    setExportingIncomePdf(true);
    try {
      const logo = await getLogoPngInfo();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const totalPagesExp = "{total_pages_count_string}";

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;
      const topY = 36;

      const logoW = 44;
      const ratio = logo.height > 0 ? logo.width / logo.height : 1;
      const logoH = logoW / Math.max(ratio, 0.01);

      doc.addImage(logo.base64, "PNG", marginX, topY, logoW, logoH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Reporte de ingresos vs egresos", marginX + 56, topY + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(
        `Rango: ${formatDisplayDate(incomeFromDate)} al ${formatDisplayDate(incomeToDate)}`,
        marginX + 56,
        topY + 36,
      );
      doc.setTextColor(30);
      doc.text(
        `Total ingresos: ${formatPyg(incomeTotals.income)} · Total egresos: ${formatPyg(incomeTotals.expenses)}`,
        marginX,
        topY + 64,
      );

      const bodyRows = incomeRows.map((r) => {
        const net = (r.income || 0) - (r.expenses || 0);
        const margin = r.income > 0 ? (net / r.income) * 100 : null;
        return [
          r.academyName,
          formatPyg(r.income),
          formatPyg(r.expenses),
          formatPyg(net),
          margin === null ? "-" : `${margin.toFixed(1)}%`,
        ];
      });

      autoTable(doc, {
        startY: topY + 78,
        head: [["Academia", "Ingresos", "Egresos", "Neto", "Margen"]],
        body: bodyRows,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 170 },
          1: { cellWidth: 90, halign: "right" },
          2: { cellWidth: 90, halign: "right" },
          3: { cellWidth: 90, halign: "right" },
          4: { cellWidth: pageWidth - marginX * 2 - 440, halign: "right" },
        },
        didDrawPage: () => {
          const page = doc.getNumberOfPages();
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(
            `Agendo · Reportes Super Admin · Página ${page} de ${totalPagesExp}`,
            marginX,
            doc.internal.pageSize.getHeight() - 28,
          );
        },
      });

      const anyDoc = doc as any;
      if (typeof anyDoc.putTotalPages === "function") {
        anyDoc.putTotalPages(totalPagesExp);
      }

      const fileName = sanitizeFileName(
        `Agendo - Reporte Ingresos vs egresos - ${incomeFromDate} a ${incomeToDate}.pdf`,
      );
      doc.save(fileName);
      toast.success("PDF generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar PDF.");
    } finally {
      setExportingIncomePdf(false);
    }
  };

  const onExportIncomeExcel = async () => {
    setExportingIncomeExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Agendo";
      workbook.created = new Date();

      const ws = workbook.addWorksheet("Ingresos vs egresos", {
        views: [{ state: "frozen", ySplit: 3 }],
      });

      ws.columns = [
        { header: "Academia", key: "academy", width: 40 },
        { header: "Ingresos", key: "income", width: 16 },
        { header: "Egresos", key: "expenses", width: 16 },
        { header: "Neto", key: "net", width: 16 },
        { header: "Margen", key: "margin", width: 12 },
      ];

      ws.insertRow(1, [`Rango: ${formatDisplayDate(incomeFromDate)} al ${formatDisplayDate(incomeToDate)}`]);
      ws.mergeCells("A1:E1");
      ws.getRow(1).font = { bold: true };
      ws.insertRow(2, [`Total ingresos: ${incomeTotals.income} · Total egresos: ${incomeTotals.expenses}`]);
      ws.mergeCells("A2:E2");
      ws.getRow(2).font = { bold: true };

      ws.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

      incomeRows.forEach((r) => {
        const net = (r.income || 0) - (r.expenses || 0);
        const margin = r.income > 0 ? (net / r.income) * 100 : null;
        ws.addRow({
          academy: r.academyName,
          income: r.income,
          expenses: r.expenses,
          net,
          margin: margin === null ? null : Number(margin.toFixed(2)),
        });
      });

      ws.getColumn("income").numFmt = "#,##0";
      ws.getColumn("expenses").numFmt = "#,##0";
      ws.getColumn("net").numFmt = "#,##0";
      ws.getColumn("margin").numFmt = "0.00";
      ws.getColumn("income").alignment = { horizontal: "right" };
      ws.getColumn("expenses").alignment = { horizontal: "right" };
      ws.getColumn("net").alignment = { horizontal: "right" };
      ws.getColumn("margin").alignment = { horizontal: "right" };

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const fileName = sanitizeFileName(
        `Agendo - Reporte Ingresos vs egresos - ${incomeFromDate} a ${incomeToDate}.xlsx`,
      );
      downloadBlob(blob, fileName);
      toast.success("Excel generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar Excel.");
    } finally {
      setExportingIncomeExcel(false);
    }
  };

  const onExportPdf = async () => {
    setExportingPdf(true);
    try {
      const logo = await getLogoPngInfo();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const totalPagesExp = "{total_pages_count_string}";

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;
      const topY = 36;

      const logoW = 44;
      const ratio = logo.height > 0 ? logo.width / logo.height : 1;
      const logoH = logoW / Math.max(ratio, 0.01);

      doc.addImage(logo.base64, "PNG", marginX, topY, logoW, logoH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Reporte de alumnos activos por academia", marginX + 56, topY + 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Fecha de corte: ${formatDisplayDate(cutoffDate)} (estado actual)`, marginX + 56, topY + 36);

      doc.setTextColor(30);
      doc.setFontSize(10);
      doc.text(`Total alumnos activos (según filtro): ${totalActive}`, marginX, topY + 64);

      const exportUserIds = filtered.flatMap((r) => r.studentUserIds);
      const fullNameByUserId = await fetchProfilesFullNameMap({ supabase, userIds: exportUserIds });

      const bodyRows = filtered.map((r) => {
        const list = (r.studentUserIds ?? [])
          .map((userId) => fullNameByUserId[userId] ?? userId)
          .sort((a, b) => a.localeCompare(b))
          .join("\n");
        return [r.academyName, String(r.activeStudentsCount), list];
      });

      autoTable(doc, {
        startY: topY + 78,
        head: [["Academia", "Activos", "Detalle de alumnos"]],
        body: bodyRows,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 160 },
          1: { cellWidth: 50, halign: "right" },
          2: { cellWidth: pageWidth - marginX * 2 - 210 },
        },
        didDrawPage: (data) => {
          const page = doc.getNumberOfPages();
          doc.setFontSize(9);
          doc.setTextColor(120);
          const footer = `Agendo · Reportes Super Admin · Página ${page} de ${totalPagesExp}`;
          doc.text(footer, marginX, doc.internal.pageSize.getHeight() - 28);
        },
      });

      // Reemplaza el placeholder con el total real de páginas
      const anyDoc = doc as any;
      if (typeof anyDoc.putTotalPages === "function") {
        anyDoc.putTotalPages(totalPagesExp);
      }

      const fileName = sanitizeFileName(`Agendo - Reporte Alumnos activos por academia - ${cutoffDate}.pdf`);
      doc.save(fileName);
      toast.success("PDF generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const onExportExcel = async () => {
    setExportingExcel(true);
    try {
      const exportUserIds = filtered.flatMap((r) => r.studentUserIds);
      const fullNameByUserId = await fetchProfilesFullNameMap({ supabase, userIds: exportUserIds });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Agendo";
      workbook.created = new Date();

      const summary = workbook.addWorksheet("Resumen", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      summary.columns = [
        { header: "Academia", key: "academy", width: 40 },
        { header: "Alumnos activos", key: "count", width: 16 },
      ];
      summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      summary.getRow(1).alignment = { vertical: "middle" };

      filtered.forEach((r) => {
        summary.addRow({ academy: r.academyName, count: r.activeStudentsCount });
      });
      summary.getColumn("count").alignment = { horizontal: "right" };

      // Metadata arriba (2 filas)
      summary.insertRow(1, ["Fecha de corte", formatDisplayDate(cutoffDate)]);
      summary.insertRow(2, ["Total alumnos activos", totalActive]);
      summary.getRow(1).font = { bold: true };
      summary.getRow(2).font = { bold: true };
      summary.mergeCells("A1:B1");
      summary.mergeCells("A2:B2");

      // Re-aplico estilo header (ahora quedó en fila 3)
      summary.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      summary.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      summary.views = [{ state: "frozen", ySplit: 3 }];

      const detail = workbook.addWorksheet("Detalle", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      detail.columns = [
        { header: "Academia", key: "academy", width: 40 },
        { header: "Alumno activo", key: "student", width: 40 },
      ];
      detail.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      detail.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

      filtered.forEach((r) => {
        const names = (r.studentUserIds ?? [])
          .map((id) => fullNameByUserId[id] ?? id)
          .sort((a, b) => a.localeCompare(b));
        names.forEach((name) => {
          detail.addRow({ academy: r.academyName, student: name });
        });
      });

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const fileName = sanitizeFileName(`Agendo - Reporte Alumnos activos por academia - ${cutoffDate}.xlsx`);
      downloadBlob(blob, fileName);
      toast.success("Excel generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  if (loadingUser) {
    return (
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-sm text-gray-500">Cargando...</div>
      </section>
    );
  }

  if (role !== "super_admin") {
    return (
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="border rounded-lg bg-white p-4">
          <div className="text-sm font-semibold text-[#0f172a]">No autorizado</div>
          <div className="text-xs text-gray-600 mt-1">Esta sección es exclusiva para Super Admin.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-6 space-y-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 160px)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Reportes (Super Admin)</h1>
          <p className="text-sm text-gray-600">Reportes globales.</p>
        </div>
        <div className="flex items-center justify-end flex-1">
          <Link href="/" className="flex items-center">
            <div className="h-16 w-32 relative">
              <Image src="/icons/logoHome.png" alt="Agendo" fill className="object-contain" priority />
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniKpi label="Ingresos" value={incomeSummaryLoading ? "..." : formatPyg(incomeSummary.income)} />
        <MiniKpi label="Egresos" value={incomeSummaryLoading ? "..." : formatPyg(incomeSummary.expenses)} />
        <MiniKpi label="Neto" value={incomeSummaryLoading ? "..." : formatPyg(incomeSummary.net)} valueClassName={incomeSummary.net >= 0 ? "text-emerald-700" : "text-red-600"} />
        <MiniKpi label="Alumnos activos" value={String(totalActive)} />
      </div>

      {incomeSummaryError && <div className="text-sm text-red-600">{incomeSummaryError}</div>}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <details className="group border rounded-xl bg-white shadow-sm">
        <summary className="px-4 py-3 border-b bg-slate-50 rounded-t-xl cursor-pointer select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TrendingUpDown className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-[#31435d] truncate">Ingresos vs egresos (Super Admin)</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">Ingresos: cobros a academias · Egresos: comisiones de vendedores</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <CategoryChip label="Finanzas" tone="emerald" />
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </div>
          </div>
        </summary>

        <div className="p-4 space-y-4">
          {incomeError && <div className="text-sm text-red-600">{incomeError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <MetricCard label="Ingresos" value={incomeLoading ? "..." : formatPyg(incomeTotals.income)} />
            <MetricCard label="Egresos" value={incomeLoading ? "..." : formatPyg(incomeTotals.expenses)} />
            <MetricCard
              label="Neto"
              value={incomeLoading ? "..." : formatPyg(incomeTotals.net)}
              valueClassName={incomeTotals.net >= 0 ? "text-emerald-700" : "text-red-600"}
            />
            <MetricCard
              label="Margen"
              value={incomeLoading ? "..." : incomeTotals.margin === null ? "-" : `${incomeTotals.margin.toFixed(1)}%`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Distribución</div>
              <div className="mt-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      dataKey="value"
                      data={[
                        { name: "Ingresos", value: incomeTotals.income },
                        { name: "Egresos", value: incomeTotals.expenses },
                      ]}
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f97316" />
                    </Pie>
                    <Tooltip formatter={(v) => formatPyg(Number(v ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="truncate text-gray-600">Ingresos</span>
                  </div>
                  <span className="tabular-nums text-[#0f172a]">{formatPyg(incomeTotals.income)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="truncate text-gray-600">Egresos</span>
                  </div>
                  <span className="tabular-nums text-[#0f172a]">{formatPyg(incomeTotals.expenses)}</span>
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">Rango: {formatDisplayDate(incomeFromDate)} al {formatDisplayDate(incomeToDate)}</div>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Desde</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 mt-1">
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                        <span className={incomeFromDate ? "" : "text-gray-400"}>{formatDisplayDate(incomeFromDate)}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseYmd(incomeFromDate)}
                        onSelect={(date) => {
                          if (!date) return;
                          setIncomeFromDate(ymd(date));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Hasta</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 mt-1">
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                        <span className={incomeToDate ? "" : "text-gray-400"}>{formatDisplayDate(incomeToDate)}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseYmd(incomeToDate)}
                        onSelect={(date) => {
                          if (!date) return;
                          setIncomeToDate(ymd(date));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Filtrar por academia</div>
                  <div className="mt-1">
                    <SearchableSelect
                      value={selectedAcademyId}
                      onValueChange={(val) => setSelectedAcademyId(val)}
                      options={academyOptions}
                      placeholder="Todas"
                      disabled={rows.length === 0}
                      contentClassName="w-80"
                    />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">Este filtro aplica a ambos reportes.</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
                <Button type="button" variant="outline" disabled={incomeLoading} onClick={loadIncomeExpenses}>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  {incomeLoading ? "Calculando..." : "Actualizar"}
                </Button>
                <Button type="button" variant="outline" disabled={exportingIncomeExcel || incomeRows.length === 0} onClick={onExportIncomeExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  {exportingIncomeExcel ? "Generando..." : "Exportar Excel"}
                </Button>
                <Button type="button" disabled={exportingIncomePdf || incomeRows.length === 0} onClick={onExportIncomePdf}>
                  <Download className="w-4 h-4 mr-2" />
                  {exportingIncomePdf ? "Generando..." : "Exportar PDF"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#31435d]">Por academia</div>
              {incomeLoading && <div className="text-xs text-gray-500">Calculando...</div>}
            </div>
            {incomeRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No hay datos para mostrar.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-4">Academia</div>
                  <div className="col-span-2 text-right">Ingresos</div>
                  <div className="col-span-2 text-right">Egresos</div>
                  <div className="col-span-2 text-right">Neto</div>
                  <div className="col-span-2 text-right">Margen</div>
                </div>
                <div className="divide-y">
                  {incomeRows.map((r) => {
                    const net = (r.income || 0) - (r.expenses || 0);
                    const margin = r.income > 0 ? (net / r.income) * 100 : null;
                    return (
                      <div key={r.academyId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                        <div className="col-span-12 md:col-span-4 text-sm font-semibold text-[#0f172a] truncate">{r.academyName}</div>
                        <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{formatPyg(r.income)}</div>
                        <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{formatPyg(r.expenses)}</div>
                        <div className={`col-span-6 md:col-span-2 text-sm tabular-nums text-right ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatPyg(net)}</div>
                        <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{margin === null ? "-" : `${margin.toFixed(1)}%`}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>

      <details className="group border rounded-xl bg-white shadow-sm">
        <summary className="px-4 py-3 border-b bg-slate-50 rounded-t-xl cursor-pointer select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-[#31435d] truncate">Cuentas por cobrar (Aging)</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">Pendiente por academia con buckets 0-30 / 31-60 / 61-90 / 90+.</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <CategoryChip label="Cobranza" tone="sky" />
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </div>
          </div>
        </summary>

        <div className="p-4 space-y-4">
          {agingError && <div className="text-sm text-red-600">{agingError}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Resumen</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MiniKpi label="Pendiente" value={agingLoading ? "..." : formatPyg(agingTotals.pending)} />
                <MiniKpi label="0-30" value={agingLoading ? "..." : formatPyg(agingTotals.b0)} />
                <MiniKpi label="31-60" value={agingLoading ? "..." : formatPyg(agingTotals.b31)} />
                <MiniKpi label="61-90" value={agingLoading ? "..." : formatPyg(agingTotals.b61)} />
                <MiniKpi label="90+" value={agingLoading ? "..." : formatPyg(agingTotals.b90)} />
                <MiniKpi label="Academias" value={String(agingRows.length)} />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Al día (fecha)</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 mt-1">
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                        <span className={agingAsOfDate ? "" : "text-gray-400"}>{formatDisplayDate(agingAsOfDate)}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseYmd(agingAsOfDate)}
                        onSelect={(date) => {
                          if (!date) return;
                          setAgingAsOfDate(ymd(date));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Filtrar por academia</div>
                  <div className="mt-1">
                    <SearchableSelect
                      value={selectedAcademyId}
                      onValueChange={(val) => setSelectedAcademyId(val)}
                      options={academyOptions}
                      placeholder="Todas"
                      disabled={rows.length === 0}
                      contentClassName="w-80"
                    />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">Este filtro aplica a los reportes.</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
                <Button type="button" variant="outline" disabled={agingLoading} onClick={loadAging}>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  {agingLoading ? "Calculando..." : "Actualizar"}
                </Button>
                <Button type="button" variant="outline" disabled={exportingAgingExcel || agingRows.length === 0} onClick={onExportAgingExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  {exportingAgingExcel ? "Generando..." : "Exportar Excel"}
                </Button>
                <Button type="button" disabled={exportingAgingPdf || agingRows.length === 0} onClick={onExportAgingPdf}>
                  <Download className="w-4 h-4 mr-2" />
                  {exportingAgingPdf ? "Generando..." : "Exportar PDF"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#31435d]">Por academia</div>
              {agingLoading && <div className="text-xs text-gray-500">Calculando...</div>}
            </div>
            {agingRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No hay datos para mostrar.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-4">Academia</div>
                  <div className="col-span-2 text-right">Pend.</div>
                  <div className="col-span-2 text-right">0-30</div>
                  <div className="col-span-2 text-right">31-60</div>
                  <div className="col-span-1 text-right">61-90</div>
                  <div className="col-span-1 text-right">90+</div>
                </div>
                <div className="divide-y">
                  {agingRows.map((r) => (
                    <div key={r.academyId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-12 md:col-span-4 text-sm font-semibold text-[#0f172a] truncate">{r.academyName}</div>
                      <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{formatPyg(r.pending)}</div>
                      <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{formatPyg(r.bucket0_30)}</div>
                      <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{formatPyg(r.bucket31_60)}</div>
                      <div className="col-span-6 md:col-span-1 text-sm tabular-nums text-right">{formatPyg(r.bucket61_90)}</div>
                      <div className="col-span-6 md:col-span-1 text-sm tabular-nums text-right">{formatPyg(r.bucket90p)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>

      <details className="group border rounded-xl bg-white shadow-sm">
        <summary className="px-4 py-3 border-b bg-slate-50 rounded-t-xl cursor-pointer select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-[#31435d] truncate">Comisiones por vendedor (mensual)</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">Ranking de comisiones por período con estado pagado/pendiente.</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <CategoryChip label="Comisiones" tone="fuchsia" />
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </div>
          </div>
        </summary>

        <div className="p-4 space-y-4">
          {commissionsError && <div className="text-sm text-red-600">{commissionsError}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Resumen</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MiniKpi label="Base cobrada" value={commissionsLoading ? "..." : formatPyg(commissionsTotals.base)} />
                <MiniKpi label="Total comisiones" value={commissionsLoading ? "..." : formatPyg(commissionsTotals.total)} />
                <MiniKpi label="Pagado" value={commissionsLoading ? "..." : formatPyg(commissionsTotals.paid)} />
                <MiniKpi label="Pendiente" value={commissionsLoading ? "..." : formatPyg(commissionsTotals.pending)} />
                <MiniKpi label="Vendedores" value={String(commissionsRows.length)} />
                <MiniKpi label="Período" value={`${commissionsYear}-${pad2(commissionsMonth)}`} />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Año</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={String(commissionsYear)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const y = Number(raw);
                      setCommissionsPeriod((prev) => ({ ...prev, year: Number.isFinite(y) ? y : prev.year }));
                    }}
                    className="mt-1 h-11 text-base"
                  />
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Mes</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12}
                    value={String(commissionsMonth)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const m = Number(raw);
                      if (!Number.isFinite(m)) return;
                      setCommissionsPeriod((prev) => ({ ...prev, month: Math.max(1, Math.min(12, m)) }));
                    }}
                    className="mt-1 h-11 text-base"
                  />
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Acciones</div>
                  <div className="mt-1 flex items-center justify-end gap-2 flex-wrap">
                    <Button type="button" variant="outline" disabled={commissionsLoading} onClick={loadSalesCommissions}>
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      {commissionsLoading ? "Calculando..." : "Actualizar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={exportingCommissionsExcel || commissionsRows.length === 0}
                      onClick={onExportCommissionsExcel}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {exportingCommissionsExcel ? "Generando..." : "Exportar Excel"}
                    </Button>
                    <Button type="button" disabled={exportingCommissionsPdf || commissionsRows.length === 0} onClick={onExportCommissionsPdf}>
                      <Download className="w-4 h-4 mr-2" />
                      {exportingCommissionsPdf ? "Generando..." : "Exportar PDF"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">Este reporte es bajo demanda (Actualizar) para evitar cargas innecesarias.</div>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#31435d]">Ranking</div>
              {commissionsLoading && <div className="text-xs text-gray-500">Calculando...</div>}
            </div>
            {commissionsRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No hay datos para mostrar.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-4">Vendedor</div>
                  <div className="col-span-2 text-right">Base</div>
                  <div className="col-span-2 text-right">Tasa</div>
                  <div className="col-span-2 text-right">Comisión</div>
                  <div className="col-span-1 text-right">Estado</div>
                  <div className="col-span-1 text-right">Acción</div>
                </div>
                <div className="divide-y">
                  {commissionsRows.map((r) => (
                    <div key={r.salesAgentId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-12 md:col-span-4 text-sm font-semibold text-[#0f172a] truncate">{r.salesAgentName}</div>
                      <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{formatPyg(r.basePaidAmount)}</div>
                      <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{(r.commissionRate * 100).toFixed(1)}%</div>
                      <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{formatPyg(r.commissionAmount)}</div>
                      <div className="col-span-6 md:col-span-1 text-sm tabular-nums text-right">{r.status}</div>
                      <div className="col-span-6 md:col-span-1 text-right">
                        {r.status === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={markingCommissionPaidId === r.salesAgentId}
                            onClick={() => onMarkCommissionPaid(r.salesAgentId)}
                          >
                            {markingCommissionPaidId === r.salesAgentId ? "..." : "Marcar"}
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>

      <details className="group border rounded-xl bg-white shadow-sm">
        <summary className="px-4 py-3 border-b bg-slate-50 rounded-t-xl cursor-pointer select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-[#31435d] truncate">Pagos recibidos (mensual)</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">Total cobrado por academia en el período seleccionado.</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <CategoryChip label="Finanzas" tone="amber" />
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </div>
          </div>
        </summary>

        <div className="p-4 space-y-4">
          {paymentsError && <div className="text-sm text-red-600">{paymentsError}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Resumen</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MiniKpi label="Total cobrado" value={paymentsLoading ? "..." : formatPyg(paymentsTotals.totalPaid)} />
                <MiniKpi label="Pagos" value={paymentsLoading ? "..." : String(paymentsTotals.paymentsCount)} />
                <MiniKpi label="Academias" value={String(paymentsTotals.academies)} />
                <MiniKpi label="Período" value={`${paymentsYear}-${pad2(paymentsMonth)}`} />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Año</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={String(paymentsYear)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const y = Number(raw);
                      setPaymentsPeriod((prev) => ({ ...prev, year: Number.isFinite(y) ? y : prev.year }));
                    }}
                    className="mt-1 h-11 text-base"
                  />
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Mes</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12}
                    value={String(paymentsMonth)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const m = Number(raw);
                      if (!Number.isFinite(m)) return;
                      setPaymentsPeriod((prev) => ({ ...prev, month: Math.max(1, Math.min(12, m)) }));
                    }}
                    className="mt-1 h-11 text-base"
                  />
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Acciones</div>
                  <div className="mt-1 flex items-center justify-end gap-2 flex-wrap">
                    <Button type="button" variant="outline" disabled={paymentsLoading} onClick={loadMonthlyPayments}>
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      {paymentsLoading ? "Calculando..." : "Actualizar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={exportingPaymentsExcel || paymentsRows.length === 0}
                      onClick={onExportPaymentsExcel}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {exportingPaymentsExcel ? "Generando..." : "Exportar Excel"}
                    </Button>
                    <Button type="button" disabled={exportingPaymentsPdf || paymentsRows.length === 0} onClick={onExportPaymentsPdf}>
                      <Download className="w-4 h-4 mr-2" />
                      {exportingPaymentsPdf ? "Generando..." : "Exportar PDF"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">Este reporte es bajo demanda (Actualizar). Aplica el filtro de academia global.</div>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#31435d]">Por academia</div>
              {paymentsLoading && <div className="text-xs text-gray-500">Calculando...</div>}
            </div>
            {paymentsRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No hay datos para mostrar.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-6">Academia</div>
                  <div className="col-span-2 text-right">Pagos</div>
                  <div className="col-span-4 text-right">Total cobrado</div>
                </div>
                <div className="divide-y">
                  {paymentsRows.map((r) => (
                    <div key={r.academyId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-12 md:col-span-6 text-sm font-semibold text-[#0f172a] truncate">{r.academyName}</div>
                      <div className="col-span-6 md:col-span-2 text-sm tabular-nums text-right">{String(r.paymentsCount)}</div>
                      <div className="col-span-6 md:col-span-4 text-sm tabular-nums text-right">{formatPyg(r.totalPaid)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>

      <details className="group border rounded-xl bg-white shadow-sm">
        <summary className="px-4 py-3 border-b bg-slate-50 rounded-t-xl cursor-pointer select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-[#31435d] truncate">Facturas por estado (mensual)</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">Cantidad y montos por academia (emitidas/parcial/pagadas/vencidas).</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <CategoryChip label="Cobranza" tone="slate" />
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </div>
          </div>
        </summary>

        <div className="p-4 space-y-4">
          {invoicesError && <div className="text-sm text-red-600">{invoicesError}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Resumen</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MiniKpi label="Facturado" value={invoicesLoading ? "..." : formatPyg(invoicesTotals.totalInvoiced)} />
                <MiniKpi label="Cobrado" value={invoicesLoading ? "..." : formatPyg(invoicesTotals.totalPaid)} />
                <MiniKpi label="Pendiente" value={invoicesLoading ? "..." : formatPyg(invoicesTotals.totalPending)} />
                <MiniKpi label="Facturas" value={invoicesLoading ? "..." : String(invoicesTotals.invoicesCount)} />
                <MiniKpi label="Vencidas" value={invoicesLoading ? "..." : String(invoicesTotals.overdueCount)} />
                <MiniKpi label="Período" value={`${invoicesYear}-${pad2(invoicesMonth)}`} />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Año</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={String(invoicesYear)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const y = Number(raw);
                      setInvoicesPeriod((prev) => ({ ...prev, year: Number.isFinite(y) ? y : prev.year }));
                    }}
                    className="mt-1 h-11 text-base"
                  />
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Mes</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12}
                    value={String(invoicesMonth)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const m = Number(raw);
                      if (!Number.isFinite(m)) return;
                      setInvoicesPeriod((prev) => ({ ...prev, month: Math.max(1, Math.min(12, m)) }));
                    }}
                    className="mt-1 h-11 text-base"
                  />
                </div>

                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Acciones</div>
                  <div className="mt-1 flex items-center justify-end gap-2 flex-wrap">
                    <Button type="button" variant="outline" disabled={invoicesLoading} onClick={loadInvoicesByStatus}>
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      {invoicesLoading ? "Calculando..." : "Actualizar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={exportingInvoicesExcel || invoicesRows.length === 0}
                      onClick={onExportInvoicesExcel}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {exportingInvoicesExcel ? "Generando..." : "Exportar Excel"}
                    </Button>
                    <Button type="button" disabled={exportingInvoicesPdf || invoicesRows.length === 0} onClick={onExportInvoicesPdf}>
                      <Download className="w-4 h-4 mr-2" />
                      {exportingInvoicesPdf ? "Generando..." : "Exportar PDF"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">Este reporte es bajo demanda (Actualizar). Aplica el filtro de academia global.</div>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#31435d]">Por academia</div>
              {invoicesLoading && <div className="text-xs text-gray-500">Calculando...</div>}
            </div>
            {invoicesRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No hay datos para mostrar.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-4">Academia</div>
                  <div className="col-span-1 text-right">Fact.</div>
                  <div className="col-span-1 text-right">Emit.</div>
                  <div className="col-span-1 text-right">Parc.</div>
                  <div className="col-span-1 text-right">Pag.</div>
                  <div className="col-span-1 text-right">Venc.</div>
                  <div className="col-span-1 text-right">Fact.</div>
                  <div className="col-span-1 text-right">Cobr.</div>
                  <div className="col-span-1 text-right">Pend.</div>
                </div>
                <div className="divide-y">
                  {invoicesRows.map((r) => (
                    <div key={r.academyId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-12 md:col-span-4 text-sm font-semibold text-[#0f172a] truncate">{r.academyName}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{String(r.invoicesCount)}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{String(r.issuedCount)}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{String(r.partiallyPaidCount)}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{String(r.paidCount)}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{String(r.overdueCount)}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{formatPyg(r.totalInvoiced)}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{formatPyg(r.totalPaid)}</div>
                      <div className="col-span-4 md:col-span-1 text-sm tabular-nums text-right">{formatPyg(r.totalPending)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>

      <details className="group border rounded-xl bg-white shadow-sm">
        <summary className="px-4 py-3 border-b bg-slate-50 rounded-t-xl cursor-pointer select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-[#31435d] truncate">Alumnos activos por academia</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">Conteo actual de alumnos activos (user_academies).</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <CategoryChip label="Operativo" tone="slate" />
              <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            </div>
          </div>
        </summary>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Distribución (Top 5 vs resto)</div>
              <div className="mt-2 h-44">
                {(() => {
                  const sorted = [...filtered].sort((a, b) => (b.activeStudentsCount || 0) - (a.activeStudentsCount || 0));
                  const top = sorted.slice(0, 5).reduce((acc, r) => acc + (r.activeStudentsCount || 0), 0);
                  const rest = Math.max(0, totalActive - top);
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          dataKey="value"
                          data={[
                            { name: "Top 5", value: top },
                            { name: "Resto", value: rest },
                          ]}
                          innerRadius={42}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          <Cell fill="#6366f1" />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                        <Tooltip formatter={(v) => String(v ?? 0)} />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
              {(() => {
                const sorted = [...filtered].sort((a, b) => (b.activeStudentsCount || 0) - (a.activeStudentsCount || 0));
                const top = sorted.slice(0, 5).reduce((acc, r) => acc + (r.activeStudentsCount || 0), 0);
                const rest = Math.max(0, totalActive - top);
                return (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        <span className="truncate text-gray-600">Top 5</span>
                      </div>
                      <span className="tabular-nums text-[#0f172a]">{String(top)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                        <span className="truncate text-gray-600">Resto</span>
                      </div>
                      <span className="tabular-nums text-[#0f172a]">{String(rest)}</span>
                    </div>
                  </div>
                );
              })()}
              <div className="text-[11px] text-gray-500 mt-2">Total alumnos activos (según filtro): {totalActive}</div>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg bg-white p-3">
                  <div className="text-xs text-gray-500">Fecha de corte</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 mt-1">
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                        <span className={cutoffDate ? "" : "text-gray-400"}>{formatDisplayDate(cutoffDate)}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseYmd(cutoffDate)}
                        onSelect={(date) => {
                          if (!date) return;
                          setCutoffDate(ymd(date));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="text-[11px] text-gray-500 mt-2">La fecha es referencial; el conteo es el estado actual.</div>
                </div>

                <div className="border rounded-lg bg-white p-3 md:col-span-2">
                  <div className="text-xs text-gray-500">Filtrar por academia</div>
                  <div className="mt-1">
                    <SearchableSelect
                      value={selectedAcademyId}
                      onValueChange={(val) => setSelectedAcademyId(val)}
                      options={academyOptions}
                      placeholder="Todas"
                      disabled={rows.length === 0}
                      contentClassName="w-80"
                    />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">Academias: {filtered.length} · Total alumnos activos: {totalActive}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
                <Button type="button" variant="outline" disabled={loading} onClick={reload}>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
                <Button type="button" variant="outline" disabled={exportingExcel || filtered.length === 0} onClick={onExportExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  {exportingExcel ? "Generando..." : "Exportar Excel"}
                </Button>
                <Button type="button" disabled={exportingPdf || filtered.length === 0} onClick={onExportPdf}>
                  <Download className="w-4 h-4 mr-2" />
                  {exportingPdf ? "Generando..." : "Exportar PDF"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#31435d]">Detalle por academia</div>
              {loading && <div className="text-xs text-gray-500">Cargando...</div>}
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No hay datos para mostrar.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-9">Academia</div>
                  <div className="col-span-3 text-right">Activos</div>
                </div>
                <div className="divide-y">
                  {filtered.map((r) => (
                    <div key={r.academyId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-12 md:col-span-9 flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-900/5 flex items-center justify-center overflow-hidden flex-none">
                          <Image src="/icons/LogoAgendo1024.png" alt="Agendo" width={24} height={24} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0f172a] truncate">{r.academyName}</div>
                          <div className="text-[11px] text-gray-500">Alumnos activos</div>
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-3 text-sm font-semibold tabular-nums text-right text-[#0f172a]">{r.activeStudentsCount}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
