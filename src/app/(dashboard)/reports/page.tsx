"use client";

import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClientBrowser } from "@/lib/supabase";
import { formatPyg } from "@/lib/formatters";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  BarChart3,
  UserCheck,
  Users,
  MapPin,
  Download,
  Eraser,
  Banknote,
} from "lucide-react";

type RentMode = "per_student" | "per_hour" | "both";

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

type ClassSessionRow = {
  id: string;
  date: string;
  coach_id: string | null;
  court_id: string | null;
};

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

interface AttendanceStudentRow {
  class_id: string;
  date: string;
  present: boolean;
  coach_name: string | null;
  court_name: string | null;
  location_name: string | null;
}

interface StudentOption {
  id: string;
  label: string;
}

interface CoachOption {
  id: string;
  label: string;
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
          <span className={selectedLabel ? "truncate" : "truncate text-gray-400"}>
            {selectedLabel ?? placeholder}
          </span>
          <span className="text-gray-400">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={`p-3 max-w-[calc(100vw-2rem)] ${contentClassName ?? "w-80"}`}
      >
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
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                  o.id === value ? "bg-gray-50" : ""
                }`}
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

interface CoachClassRow {
  class_id: string;
  date: string;
  court_name: string | null;
  location_name: string | null;
  present_count: number;
  absent_count: number;
}

interface CoachExpenseRow {
  coach_id: string;
  coach_name: string | null;
  classes_count: number;
  fee_per_class: number | null;
  total_expense: number;
}

interface RentExpenseRow {
  location_id: string;
  location_name: string | null;
  classes_count: number;
  rent_total: number;
}

interface LocationOption {
  id: string;
  label: string;
}

interface CourtOption {
  id: string;
  label: string;
  location_id: string | null;
}

interface LocationClassRow {
  class_id: string;
  date: string;
  coach_name: string | null;
  court_name: string | null;
  location_name: string | null;
  present_count: number;
  absent_count: number;
}

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
}

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

function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const selectedDate = parseYmd(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left text-sm font-normal flex items-center gap-2"
       >
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <span className={selectedDate ? "" : "text-gray-400"}>
            {formatDisplay(selectedDate)}
          </span>
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

export default function ReportsPage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const CLASS_DURATION_MINUTES = 60;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentReportRow[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [studentSummary, setStudentSummary] = useState<StudentSummaryRow[]>([]);
  const [planSummary, setPlanSummary] = useState<PlanSummaryRow[]>([]);
  const [showIncome, setShowIncome] = useState(false);
  const [showPlanSummary, setShowPlanSummary] = useState(false);
  const [studentDetailModalOpen, setStudentDetailModalOpen] = useState(false);
  const [studentDetailName, setStudentDetailName] = useState<string | null>(null);
  const [studentDetailRows, setStudentDetailRows] = useState<PaymentReportRow[]>([]);
  const [planDetailModalOpen, setPlanDetailModalOpen] = useState(false);
  const [planDetailName, setPlanDetailName] = useState<string | null>(null);
  const [planDetailRows, setPlanDetailRows] = useState<PaymentReportRow[]>([]);

  // Asistencia por alumno
  const [attendanceStudents, setAttendanceStudents] = useState<StudentOption[]>([]);
  const [attendanceStudentId, setAttendanceStudentId] = useState("");
  const [attendanceFrom, setAttendanceFrom] = useState("");
  const [attendanceTo, setAttendanceTo] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceStudentRow[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ total: number; present: number; absent: number } | null>(null);
  const [showAttendanceStudent, setShowAttendanceStudent] = useState(false);

  // Asistencia por profesor
  const [coachOptions, setCoachOptions] = useState<CoachOption[]>([]);
  const [coachId, setCoachId] = useState("");
  const [coachFrom, setCoachFrom] = useState("");
  const [coachTo, setCoachTo] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachRows, setCoachRows] = useState<CoachClassRow[]>([]);
  const [coachSummary, setCoachSummary] = useState<{ totalClasses: number; present: number; absent: number } | null>(null);
  const [showAttendanceCoach, setShowAttendanceCoach] = useState(false);

  // Asistencia por sede / cancha
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [courtOptions, setCourtOptions] = useState<CourtOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [courtId, setCourtId] = useState("");
  const [locationFrom, setLocationFrom] = useState("");
  const [locationTo, setLocationTo] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationRows, setLocationRows] = useState<LocationClassRow[]>([]);
  const [locationSummary, setLocationSummary] = useState<{ totalClasses: number; present: number; absent: number } | null>(null);
  const [showAttendanceLocation, setShowAttendanceLocation] = useState(false);

  // Detalle de una clase en reporte por sede/cancha
  const [locationDetailOpen, setLocationDetailOpen] = useState(false);
  const [locationDetailClassId, setLocationDetailClassId] = useState<string | null>(null);
  const [locationDetailInfo, setLocationDetailInfo] = useState<{
    date: string;
    location_name: string | null;
    court_name: string | null;
    coach_name: string | null;
  } | null>(null);
  const [locationDetailRows, setLocationDetailRows] = useState<{
    student_id: string;
    student_name: string | null;
    present: boolean;
  }[]>([]);

  const [exportMenu, setExportMenu] = useState<{
    income: boolean;
    expenses: boolean;
    attendanceStudent: boolean;
    attendanceCoach: boolean;
    attendanceLocation: boolean;
  }>({
    income: false,
    expenses: false,
    attendanceStudent: false,
    attendanceCoach: false,
    attendanceLocation: false,
  });

  // Multi-academia
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [academyLocationIds, setAcademyLocationIds] = useState<Set<string>>(new Set());

  // Egresos por profesor
  const [showCoachExpenses, setShowCoachExpenses] = useState(false);
  const [coachExpensesLoading, setCoachExpensesLoading] = useState(false);
  const [coachExpenses, setCoachExpenses] = useState<CoachExpenseRow[]>([]);
  const [coachExpensesTotal, setCoachExpensesTotal] = useState(0);

  // Egresos por alquiler de cancha
  const [rentExpensesLoading, setRentExpensesLoading] = useState(false);
  const [rentExpenses, setRentExpenses] = useState<RentExpenseRow[]>([]);
  const [rentExpensesTotal, setRentExpensesTotal] = useState(0);
  const [hasAutoRunFromPreset, setHasAutoRunFromPreset] = useState(false);

  const sanitizeFileName = (value: string) => {
    return value
      .replace(/[\\/]/g, "-")
      .replace(/[:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const translateExportError = (raw: string) => {
    const msg = String(raw || '').trim();
    const lower = msg.toLowerCase();
    if (!msg) return 'Error desconocido.';
    if (lower.includes('not implemented')) return 'Función no disponible en este dispositivo.';
    if (lower.includes('share')) return 'No se pudo abrir el panel para compartir.';
    return msg;
  };

  const buildReportFileName = (
    reportTitle: string,
    from: string | null | undefined,
    to: string | null | undefined,
    ext: "xlsx" | "pdf",
  ) => {
    const rangePart = from && to ? ` - ${from} a ${to}` : "";
    return sanitizeFileName(`Agendo - Reporte ${reportTitle}${rangePart}.${ext}`);
  };

  const getLogoPngInfo = async () => {
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
  };

  const downloadBlob = async (blob: Blob, fileName: string) => {
    const isNative = typeof window !== 'undefined' && (window as any)?.Capacitor?.isNativePlatform?.() === true;
    if (!isNative) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const plugins = (window as any)?.Capacitor?.Plugins;
    const Filesystem = plugins?.Filesystem;
    const Share = plugins?.Share;
    if (!Filesystem) throw new Error('No se encontró el plugin Filesystem.');
    if (!Share) throw new Error('No se encontró el plugin Share.');

    const base64Data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(blob);
    });

    const writeRes = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: 'DOCUMENTS',
      recursive: true,
    }).catch(async (err: any) => {
      // Algunos dispositivos pueden fallar en DOCUMENTS; hacemos fallback a CACHE.
      try {
        return await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: 'CACHE',
          recursive: true,
        });
      } catch (err2: any) {
        const detail = (err2?.message ?? err?.message ?? String(err2 ?? err)).trim();
        throw new Error(`No se pudo acceder al sistema de archivos del dispositivo: ${detail}`);
      }
    });

    await Share.share({
      title: fileName,
      text: fileName,
      url: writeRes.uri,
      dialogTitle: 'Compartir archivo',
    });
  };

  const safeRangeLabel = (from: string | null | undefined, to: string | null | undefined) => {
    if (from && to) return `Rango: ${from} a ${to}`;
    return "Rango: -";
  };

  const exportToExcel = async (
    fileName: string,
    sheetName: string,
    rows: any[],
    rangeFrom?: string | null,
    rangeTo?: string | null,
  ) => {
    if (!rows || rows.length === 0) return;
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Agendo";
      workbook.created = new Date();

      const ws = workbook.addWorksheet(sheetName);

      const { base64: logoBase64, width: logoW, height: logoH } = await getLogoPngInfo();
      const logoId = workbook.addImage({
        base64: logoBase64,
        extension: "png",
      });

      // Header area
      ws.mergeCells("A1:D3");
      const excelLogoTargetHeight = 55;
      const excelLogoTargetWidth = Math.round((excelLogoTargetHeight * (logoW || 1)) / (logoH || 1));
      ws.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: excelLogoTargetWidth, height: excelLogoTargetHeight },
      });

      ws.mergeCells("E1:K1");
      ws.getCell("E1").value = `Agendo - ${sheetName}`;
      ws.getCell("E1").font = { bold: true, size: 16, color: { argb: "FF31435D" } };

      ws.mergeCells("E2:K2");
      ws.getCell("E2").value = safeRangeLabel(rangeFrom, rangeTo);
      ws.getCell("E2").font = { size: 10, color: { argb: "FF64748B" } };

      ws.mergeCells("E3:K3");
      ws.getCell("E3").value = `Generado: ${new Date().toLocaleString()}`;
      ws.getCell("E3").font = { size: 10, color: { argb: "FF64748B" } };

      // Data
      const keys = Object.keys(rows[0] ?? {});
      const headerRowIndex = 5;
      const dataStartRow = headerRowIndex + 1;

      ws.getRow(headerRowIndex).values = ["", ...keys];
      ws.getRow(headerRowIndex).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(headerRowIndex).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF31435D" },
      };
      ws.getRow(headerRowIndex).alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(headerRowIndex).height = 18;

      ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const excelRow = ws.getRow(dataStartRow + i);
        excelRow.values = ["", ...keys.map((k) => r[k])];
        excelRow.font = { size: 10, color: { argb: "FF0F172A" } };
        excelRow.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

        if (i % 2 === 1) {
          excelRow.eachCell((cell, colNumber) => {
            if (colNumber === 1) return;
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          });
        }

        excelRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) return;
          if (typeof cell.value === "number") {
            cell.numFmt = "#,##0";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          }
        });
      }

      // Column widths (based on data)
      const columnWidths = keys.map((k) => {
        let maxLen = String(k).length;
        for (const row of rows) {
          const v = (row as any)?.[k];
          const len = v === null || v === undefined ? 0 : String(v).length;
          if (len > maxLen) maxLen = len;
        }
        return Math.min(55, Math.max(12, maxLen + 2));
      });
      ws.columns = [{ key: "_pad", width: 2 }, ...keys.map((k, idx) => ({ key: k, width: columnWidths[idx] }))];

      // Border for table
      const lastRow = dataStartRow + rows.length - 1;
      for (let r = headerRowIndex; r <= lastRow; r++) {
        const row = ws.getRow(r);
        row.eachCell((cell, colNumber) => {
          if (colNumber === 1) return;
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      }

      ws.getRow(headerRowIndex).eachCell((cell, colNumber) => {
        if (colNumber === 1) return;
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      await downloadBlob(blob, fileName);
      toast.success("Exportación a Excel lista");
    } catch (e) {
      console.error(e);
      const msg = translateExportError((e as any)?.message ?? String(e));
      toast.error(`No se pudo exportar a Excel: ${msg}`);
    }
  };

  const incomeChartData = rows.length
    ? Object.entries(
        rows.reduce<Record<string, number>>((acc, r) => {
          const key = new Date(r.payment_date).toLocaleDateString();
          acc[key] = (acc[key] || 0) + (r.amount || 0);
          return acc;
        }, {})
      ).map(([date, total]) => ({ date, total }))
    : [];

  const exportToPdf = async (
    fileName: string,
    title: string,
    headers: string[],
    rows: any[][],
    rangeFrom?: string | null,
    rangeTo?: string | null,
  ) => {
    if (!rows || rows.length === 0) return;
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default as any;

      const doc = new jsPDF({ format: "a4", orientation: "portrait" });

      const { base64: logoBase64, width: logoW, height: logoH } = await getLogoPngInfo();
      const rangeTxt = safeRangeLabel(rangeFrom, rangeTo);
      const generatedTxt = `Generado: ${new Date().toLocaleString()}`;

      const drawHeader = () => {
        const headerY = 10;
        const leftX = 14;
        let logoWidth = 0;

        try {
          const pdfLogoTargetHeight = 12;
          const pdfLogoTargetWidth = (pdfLogoTargetHeight * (logoW || 1)) / (logoH || 1);
          logoWidth = pdfLogoTargetWidth;
          doc.addImage(logoBase64, "PNG", leftX, headerY, pdfLogoTargetWidth, pdfLogoTargetHeight);
        } catch {
          logoWidth = 0;
        }

        const textX = leftX + (logoWidth ? logoWidth + 4 : 0);
        doc.setFontSize(14);
        doc.setTextColor(49, 67, 93);
        doc.text(`Agendo - ${title}`, textX, 16);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(rangeTxt, textX, 21);
        doc.text(generatedTxt, textX, 25);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 29, 196, 29);
      };

      const drawFooter = (page: number, total: number) => {
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        const footerText = `Página ${page} de ${total}`;
        doc.text(footerText, pageW - 14, pageH - 10, { align: "right" });
      };

      // Draw header on page 1 before table
      drawHeader();

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 32,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [49, 67, 93], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: () => {
          drawHeader();
        },
        didParseCell: (data: any) => {
          // Alinear números a la derecha
          if (data.section === "body") {
            const raw = data.cell?.raw;
            if (typeof raw === "number") {
              data.cell.styles.halign = "right";
            }
          }
        },
      });

      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawFooter(p, totalPages);
      }

      const pdfBlob = doc.output('blob');
      await downloadBlob(pdfBlob, fileName);
      toast.success("Exportación a PDF lista");
    } catch (e) {
      console.error(e);
      const msg = translateExportError((e as any)?.message ?? String(e));
      toast.error(`No se pudo exportar a PDF: ${msg}`);
    }
  };

  // Cargar rango inicial según preset y sección
  useEffect(() => {
    let preset: string | null = null;
    let section: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      preset = params.get("preset");
      section = params.get("section");
    }

    if (preset === "last30") {
      const today = new Date();
      const toDateIso = today.toISOString().slice(0, 10);
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      const fromDateIso = from.toISOString().slice(0, 10);

      setFromDate(fromDateIso);
      setToDate(toDateIso);

      // Abrir acordeones de ingresos y egresos si venimos desde el dashboard
      setShowIncome(true);
      setShowCoachExpenses(true);
    } else {
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
    }

    if (section === "income") {
      setShowIncome(true);
    }
  }, []);

  // Cargar academia seleccionada y sedes asociadas
  useEffect(() => {
    (async () => {
      let academyId: string | null = null;
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("selectedAcademyId");
        academyId = stored && stored.trim() ? stored : null;
      }
      setSelectedAcademyId(academyId);

      if (!academyId) {
        setAcademyLocationIds(new Set());
        return;
      }

      const { data: alData, error: alErr } = await supabase
        .from("academy_locations")
        .select("academy_id,location_id")
        .eq("academy_id", academyId);
      if (alErr) {
        setAcademyLocationIds(new Set());
        return;
      }
      const ids = new Set<string>(
        ((alData ?? []) as { location_id: string | null }[])
          .map((r) => r.location_id)
          .filter((id): id is string => !!id)
      );
      setAcademyLocationIds(ids);
    })();
  }, [supabase]);

  // Cargar alumnos y catálogos para reportes de asistencia
  useEffect(() => {
    (async () => {
      try {
        if (!selectedAcademyId) {
          // Sin academia seleccionada: no mostramos alumnos ni profesores
          setAttendanceStudents([]);
          setCoachOptions([]);
          return;
        }

        const { data: studs, error: sErr } = await supabase
          .from("students")
          .select("id,user_id,level,notes");
        if (sErr) throw sErr;
        let studentsRaw = (studs ?? []) as { id: string; user_id: string | null; level: string | null; notes: string | null }[];

        // user_academies para determinar qué usuarios pertenecen a la academia seleccionada
        const { data: uaData, error: uaErr } = await supabase
          .from("user_academies")
          .select("user_id,academy_id,role")
          .eq("academy_id", selectedAcademyId);
        if (uaErr) throw uaErr;
        const uaRows = (uaData ?? []) as { user_id: string | null; academy_id: string | null; role: string | null }[];

        const studentUserIds = new Set<string>(
          uaRows
            .filter((r) => (r.role ?? '').includes('student'))
            .map((r) => r.user_id)
            .filter((id): id is string => !!id)
        );

        // Filtrar alumnos por user_id presente en user_academies para esta academia
        studentsRaw = studentsRaw.filter((s) => s.user_id && studentUserIds.has(s.user_id));

        const userIds = Array.from(
          new Set(
            studentsRaw
              .map((s) => s.user_id)
              .filter((id): id is string => !!id)
          )
        );

        let profilesMap: Record<string, string | null> = {};
        if (userIds.length > 0) {
          const { data: profilesData, error: profErr } = await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", userIds);
          if (profErr) throw profErr;
          profilesMap = (profilesData ?? []).reduce<Record<string, string | null>>(
            (acc, p: any) => {
              acc[p.id as string] = (p.full_name as string | null) ?? null;
              return acc;
            },
            {}
          );
        }

        const options: StudentOption[] = studentsRaw.map((s) => {
          const label =
            (s.user_id ? profilesMap[s.user_id] ?? null : null) ??
            s.notes ??
            s.level ??
            s.id;
          return { id: s.id, label };
        });
        options.sort((a, b) => a.label.localeCompare(b.label));
        setAttendanceStudents(options);

        // Cargar profesores para reportes por profesor
        const { data: coachesData, error: coachesErr } = await supabase
          .from("coaches")
          .select("id,user_id");
        if (coachesErr) throw coachesErr;
        let coachesRaw = (coachesData ?? []) as { id: string; user_id: string | null }[];

        const coachUserIdsAcademy = new Set<string>(
          uaRows
            .filter((r) => (r.role ?? '').includes('coach'))
            .map((r) => r.user_id)
            .filter((id): id is string => !!id)
        );

        // Filtrar coaches por user_id presente en user_academies para esta academia
        coachesRaw = coachesRaw.filter((c) => c.user_id && coachUserIdsAcademy.has(c.user_id));

        const coachUserIds = Array.from(
          new Set(coachesRaw.map((c) => c.user_id).filter((id): id is string => !!id))
        );

        let coachProfilesMap: Record<string, string | null> = {};
        if (coachUserIds.length > 0) {
          const { data: coachProfiles, error: coachProfErr } = await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", coachUserIds);
          if (coachProfErr) throw coachProfErr;
          coachProfilesMap = (coachProfiles ?? []).reduce<Record<string, string | null>>(
            (acc, p: any) => {
              acc[p.id as string] = (p.full_name as string | null) ?? null;
              return acc;
            },
            {}
          );
        }

        const coachOpts: CoachOption[] = coachesRaw.map((c) => {
          const label = c.user_id ? coachProfilesMap[c.user_id] ?? c.id : c.id;
          return { id: c.id, label };
        });
        coachOpts.sort((a, b) => a.label.localeCompare(b.label));
        setCoachOptions(coachOpts);
      } catch (e) {
        // usamos el mismo error general
        const msg = (e as any)?.message || "Error cargando datos para reportes de asistencia";
        setError(msg);
      }
    })();
  }, [supabase, selectedAcademyId]);

  // Cargar sedes y canchas para reporte por sede/cancha
  useEffect(() => {
    (async () => {
      try {
        if (!selectedAcademyId || academyLocationIds.size === 0) {
          setLocationOptions([]);
          setCourtOptions([]);
          return;
        }

        const { data: locData, error: locErr } = await supabase
          .from("locations")
          .select("id,name")
          .in("id", Array.from(academyLocationIds));
        if (locErr) throw locErr;

        const locOptions: LocationOption[] = (locData ?? []).map((l: any) => ({
          id: l.id as string,
          label: ((l.name as string | null) ?? l.id) as string,
        }));
        locOptions.sort((a, b) => a.label.localeCompare(b.label));
        setLocationOptions(locOptions);

        const { data: courtsData, error: ctErr } = await supabase
          .from("courts")
          .select("id,name,location_id")
          .in("location_id", Array.from(academyLocationIds));
        if (ctErr) throw ctErr;

        const ctOptions: CourtOption[] = (courtsData ?? []).map((c: any) => ({
          id: c.id as string,
          label: ((c.name as string | null) ?? c.id) as string,
          location_id: (c.location_id as string | null) ?? null,
        }));
        ctOptions.sort((a, b) => a.label.localeCompare(b.label));
        setCourtOptions(ctOptions);
      } catch (e) {
        const msg = (e as any)?.message || "Error cargando sedes y canchas";
        setError(msg);
      }
    })();
  }, [supabase, selectedAcademyId, academyLocationIds]);

  const runIncomeReport = async () => {
    if (!fromDate || !toDate) {
      setError("Selecciona un rango de fechas");
      return;
    }
    if (!selectedAcademyId) {
      setRows([]);
      setTotalAmount(0);
      setStudentSummary([]);
      setPlanSummary([]);
      setError("Selecciona una academia para ver este reporte");
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

      const paymentsRaw = (paymentsData ?? []) as {
        id: string;
        student_id: string;
        student_plan_id: string;
        amount: number;
        currency: string;
        payment_date: string;
        method: string;
        status: string;
      }[];

      if (paymentsRaw.length === 0) {
        setRows([]);
        setTotalAmount(0);
        return;
      }

      // Filtrar pagos por academia usando student_plans.academy_id
      const studentPlanIdsAll = Array.from(new Set(paymentsRaw.map((p) => p.student_plan_id)));
      const { data: spAcademyData, error: spAcademyErr } = await supabase
        .from("student_plans")
        .select("id,academy_id")
        .in("id", studentPlanIdsAll);
      if (spAcademyErr) throw spAcademyErr;
      const allowedPlanIds = new Set<string>(
        ((spAcademyData ?? []) as { id: string; academy_id: string | null }[])
          .filter((row) => row.academy_id === selectedAcademyId)
          .map((row) => row.id)
      );

      const payments = paymentsRaw.filter((p) => allowedPlanIds.has(p.student_plan_id));
      if (payments.length === 0) {
        setRows([]);
        setTotalAmount(0);
        setStudentSummary([]);
        setPlanSummary([]);
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
        const key = r.plan_name ?? "Sin nombre";
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

  useEffect(() => {
    let preset: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      preset = params.get("preset");
    }

    if (preset !== "last30") return;
    if (hasAutoRunFromPreset) return;
    if (!fromDate || !toDate) return;
    if (!selectedAcademyId) return;
    if (academyLocationIds.size === 0) return;

    (async () => {
      await runIncomeReport();
      await runCoachExpensesReport();
      setHasAutoRunFromPreset(true);
    })();
  }, [fromDate, toDate, selectedAcademyId, academyLocationIds, hasAutoRunFromPreset]);

  const loadAttendanceByStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceStudentId) {
      setError("Selecciona un alumno para ver asistencia");
      return;
    }
    if (!attendanceFrom || !attendanceTo) {
      setError("Selecciona un rango de fechas para asistencia");
      return;
    }
    setAttendanceLoading(true);
    setError(null);
    try {
      const { data: attData, error: attErr } = await supabase
        .from("attendance")
        .select("class_id,student_id,present,class_sessions!inner(id,date,coach_id,court_id)")
        .eq("student_id", attendanceStudentId)
        .gte("class_sessions.date", attendanceFrom)
        .lte("class_sessions.date", attendanceTo);
      if (attErr) throw attErr;

      const rowsRawAll = (attData ?? []) as any[];
      if (rowsRawAll.length === 0) {
        setAttendanceRows([]);
        setAttendanceSummary({ total: 0, present: 0, absent: 0 });
        return;
      }

      const coachIds = Array.from(
        new Set(rowsRawAll.map((r) => r.class_sessions?.coach_id).filter((id: string | null): id is string => !!id))
      );
      const courtIds = Array.from(
        new Set(rowsRawAll.map((r) => r.class_sessions?.court_id).filter((id: string | null): id is string => !!id))
      );

      const coachMap: Record<string, string | null> = {};
      if (coachIds.length > 0) {
        const { data: coachesData, error: cErr } = await supabase
          .from("coaches")
          .select("id,user_id");
        if (cErr) throw cErr;
        const coachesRaw = (coachesData ?? []) as { id: string; user_id: string | null }[];
        const coachUserIds = Array.from(
          new Set(coachesRaw.map((c) => c.user_id).filter((id): id is string => !!id))
        );
        let profilesMap: Record<string, string | null> = {};
        if (coachUserIds.length > 0) {
          const { data: profilesData, error: pErr } = await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", coachUserIds);
          if (pErr) throw pErr;
          profilesMap = (profilesData ?? []).reduce<Record<string, string | null>>(
            (acc, p: any) => {
              acc[p.id as string] = (p.full_name as string | null) ?? null;
              return acc;
            },
            {}
          );
        }
        coachesRaw.forEach((c) => {
          if (!coachIds.includes(c.id)) return;
          coachMap[c.id] = c.user_id ? profilesMap[c.user_id] ?? null : null;
        });
      }

      let courtMap: Record<string, { court_name: string | null; location_id: string | null }> = {};
      if (courtIds.length > 0) {
        const { data: courtsData, error: ctErr } = await supabase
          .from("courts")
          .select("id,name,location_id")
          .in("id", courtIds);
        if (ctErr) throw ctErr;
        courtMap = (courtsData ?? []).reduce<
          Record<string, { court_name: string | null; location_id: string | null }>
        >(
          (acc, c: any) => {
            acc[c.id as string] = {
              court_name: (c.name as string | null) ?? null,
              location_id: (c.location_id as string | null) ?? null,
            };
            return acc;
          },
          {}
        );
      }

      const locationIds = Array.from(
        new Set(
          Object.values(courtMap)
            .map((c) => c.location_id)
            .filter((id): id is string => !!id)
        )
      );
      let locationMap: Record<string, string | null> = {};
      if (locationIds.length > 0) {
        const { data: locData, error: locErr } = await supabase
          .from("locations")
          .select("id,name")
          .in("id", locationIds);
        if (locErr) throw locErr;
        locationMap = (locData ?? []).reduce<Record<string, string | null>>(
          (acc, l: any) => {
            acc[l.id as string] = (l.name as string | null) ?? null;
            return acc;
          },
          {}
        );
      }

      const rowsRaw = rowsRawAll;

      const mapped: AttendanceStudentRow[] = rowsRaw.map((r) => {
        const cls = r.class_sessions;
        const courtInfo = cls?.court_id ? courtMap[cls.court_id] : undefined;
        const locationName = courtInfo?.location_id
          ? locationMap[courtInfo.location_id] ?? null
          : null;
        return {
          class_id: r.class_id as string,
          date: cls?.date as string,
          present: !!r.present,
          coach_name: cls?.coach_id ? coachMap[cls.coach_id] ?? null : null,
          court_name: courtInfo?.court_name ?? null,
          location_name: locationName,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      const total = mapped.length;
      const present = mapped.filter((r) => r.present).length;
      const absent = total - present;
      setAttendanceRows(mapped);
      setAttendanceSummary({ total, present, absent });
    } catch (e) {
      const msg = (e as any)?.message || "Error cargando asistencia";
      setError(msg);
      setAttendanceRows([]);
      setAttendanceSummary(null);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadAttendanceByCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachId) {
      setError("Selecciona un profesor para ver asistencia");
      return;
    }
    if (!coachFrom || !coachTo) {
      setError("Selecciona un rango de fechas para asistencia por profesor");
      return;
    }
    setCoachLoading(true);
    setError(null);
    try {
      const { data: clsData, error: clsErr } = await supabase
        .from("class_sessions")
        .select("id,date,court_id")
        .eq("coach_id", coachId)
        .gte("date", coachFrom)
        .lte("date", coachTo);
      if (clsErr) throw clsErr;

      const classesAll = (clsData ?? []) as { id: string; date: string; court_id: string | null }[];
      if (classesAll.length === 0) {
        setCoachRows([]);
        setCoachSummary({ totalClasses: 0, present: 0, absent: 0 });
        return;
      }

      const classIdsAll = classesAll.map((c) => c.id);
      const { data: attData, error: attErr } = await supabase
        .from("attendance")
        .select("class_id,present")
        .in("class_id", classIdsAll);
      if (attErr) throw attErr;

      const attendance = (attData ?? []) as { class_id: string; present: boolean | null }[];

      const courtIds = Array.from(
        new Set(classesAll.map((c) => c.court_id).filter((id): id is string => !!id))
      );
      let courtMap: Record<string, { court_name: string | null; location_id: string | null }> = {};
      if (courtIds.length > 0) {
        const { data: courtsData, error: ctErr } = await supabase
          .from("courts")
          .select("id,name,location_id")
          .in("id", courtIds);
        if (ctErr) throw ctErr;
        courtMap = (courtsData ?? []).reduce<
          Record<string, { court_name: string | null; location_id: string | null }>
        >(
          (acc, c: any) => {
            acc[c.id as string] = {
              court_name: (c.name as string | null) ?? null,
              location_id: (c.location_id as string | null) ?? null,
            };
            return acc;
          },
          {}
        );
      }

      const locationIds = Array.from(
        new Set(
          Object.values(courtMap)
            .map((c) => c.location_id)
            .filter((id): id is string => !!id)
        )
      );
      let locationMap: Record<string, string | null> = {};
      if (locationIds.length > 0) {
        const { data: locData, error: locErr } = await supabase
          .from("locations")
          .select("id,name")
          .in("id", locationIds);
        if (locErr) throw locErr;
        locationMap = (locData ?? []).reduce<Record<string, string | null>>(
          (acc, l: any) => {
            acc[l.id as string] = (l.name as string | null) ?? null;
            return acc;
          },
          {}
        );
      }

      const byClass: Record<string, { present: number; absent: number }> = {};
      attendance.forEach((a) => {
        const key = a.class_id;
        if (!byClass[key]) {
          byClass[key] = { present: 0, absent: 0 };
        }
        if (a.present) {
          byClass[key].present += 1;
        } else {
          byClass[key].absent += 1;
        }
      });

      const classes = classesAll;

      const rows: CoachClassRow[] = classes.map((c) => {
        const counts = byClass[c.id] ?? { present: 0, absent: 0 };
        const courtInfo = c.court_id ? courtMap[c.court_id] : undefined;
        const locationName = courtInfo?.location_id
          ? locationMap[courtInfo.location_id] ?? null
          : null;
        return {
          class_id: c.id,
          date: c.date,
          court_name: courtInfo?.court_name ?? null,
          location_name: locationName,
          present_count: counts.present,
          absent_count: counts.absent,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      const totalClasses = rows.length;
      const totalPresent = rows.reduce((acc, r) => acc + r.present_count, 0);
      const totalAbsent = rows.reduce((acc, r) => acc + r.absent_count, 0);
      setCoachRows(rows);
      setCoachSummary({ totalClasses, present: totalPresent, absent: totalAbsent });
    } catch (e) {
      const msg = (e as any)?.message || "Error cargando asistencia por profesor";
      setError(msg);
      setCoachRows([]);
      setCoachSummary(null);
    } finally {
      setCoachLoading(false);
    }
  };

  const loadLocationClassDetail = async (
    classId: string,
    info: { date: string; location_name: string | null; court_name: string | null; coach_name: string | null }
  ) => {
    setLocationDetailClassId(classId);
    setLocationDetailInfo(info);
    setLocationDetailRows([]);

    try {
      // 1) Traer asistencia de la clase
      const { data: attData, error: attErr } = await supabase
        .from("attendance")
        .select("student_id,present")
        .eq("class_id", classId);
      if (attErr) throw attErr;

      const attRows = (attData ?? []) as { student_id: string; present: boolean | null }[];

      if (attRows.length === 0) {
        setLocationDetailRows([]);
        setLocationDetailOpen(true);
        return;
      }

      // 2) Cargar alumnos y perfiles para armar nombres
      const studentIds = Array.from(new Set(attRows.map((a) => a.student_id)));
      const { data: studentsData, error: studentsErr } = await supabase
        .from("students")
        .select("id,user_id,level,notes")
        .in("id", studentIds);
      if (studentsErr) throw studentsErr;

      const students = (studentsData ?? []) as { id: string; user_id: string | null; level: string | null; notes: string | null }[];
      const userIds = Array.from(
        new Set(students.map((s) => s.user_id).filter((id): id is string => !!id))
      );

      let profilesMap: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", userIds);
        if (profilesErr) throw profilesErr;
        profilesMap = (profilesData ?? []).reduce<Record<string, string | null>>(
          (acc, p: any) => {
            acc[p.id as string] = (p.full_name as string | null) ?? null;
            return acc;
          },
          {}
        );
      }

      const studentMap: Record<
        string,
        { level: string | null; notes: string | null; user_id: string | null }
      > = {};
      students.forEach((s) => {
        studentMap[s.id] = {
          level: s.level,
          notes: s.notes,
          user_id: s.user_id,
        };
      });

      const detailRows = attRows.map((a) => {
        const student = studentMap[a.student_id];
        const profileName = student?.user_id
          ? profilesMap[student.user_id] ?? null
          : null;
        const fallbackLabel =
          profileName ?? student?.notes ?? student?.level ?? a.student_id;
        return {
          student_id: a.student_id,
          student_name: fallbackLabel,
          present: !!a.present,
        };
      });

      setLocationDetailRows(detailRows);
      setLocationDetailOpen(true);
    } catch (e) {
      const msg = (e as any)?.message || "Error cargando detalle de asistencia";
      setError(msg);
      setLocationDetailRows([]);
      setLocationDetailOpen(true);
    }
  };

  const loadAttendanceByLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      setError("Selecciona una sede para ver asistencia por sede/cancha");
      return;
    }
    if (!locationFrom || !locationTo) {
      setError("Selecciona un rango de fechas para asistencia por sede/cancha");
      return;
    }

    setLocationLoading(true);
    setError(null);

    try {
      // 1) Obtener canchas de la sede seleccionada (o una cancha específica si se eligió)
      const courtFilter = supabase
        .from("courts")
        .select("id,name,location_id")
        .eq("location_id", locationId);

      const { data: courtsData, error: courtsErr } = await courtFilter;
      if (courtsErr) throw courtsErr;

      const courts = (courtsData ?? []) as { id: string; name: string | null; location_id: string | null }[];
      if (courts.length === 0) {
        setLocationRows([]);
        setLocationSummary({ totalClasses: 0, present: 0, absent: 0 });
        return;
      }

      const allowedCourtIds = courts.map((c) => c.id);

      // 2) Obtener clases en esas canchas y rango de fechas
      let clsQuery = supabase
        .from("class_sessions")
        .select("id,date,court_id,coach_id")
        .gte("date", locationFrom)
        .lte("date", locationTo)
        .in("court_id", allowedCourtIds);

      if (courtId) {
        clsQuery = clsQuery.eq("court_id", courtId);
      }

      const { data: clsData, error: clsErr } = await clsQuery;
      if (clsErr) throw clsErr;

      const classes = (clsData ?? []) as { id: string; date: string; court_id: string | null; coach_id: string | null }[];
      if (classes.length === 0) {
        setLocationRows([]);
        setLocationSummary({ totalClasses: 0, present: 0, absent: 0 });
        return;
      }

      // 3) Obtener asistencia de esas clases
      const classIds = classes.map((c) => c.id);
      const { data: attData, error: attErr } = await supabase
        .from("attendance")
        .select("class_id,present")
        .in("class_id", classIds);
      if (attErr) throw attErr;

      const attendance = (attData ?? []) as { class_id: string; present: boolean | null }[];

      // 4) Mapas de cancha y sede
      const courtIds = Array.from(new Set(classes.map((c) => c.court_id).filter((id): id is string => !!id)));
      let courtMap: Record<string, { court_name: string | null; location_id: string | null }> = {};
      if (courtIds.length > 0) {
        const { data: courtsFull, error: ctErr } = await supabase
          .from("courts")
          .select("id,name,location_id")
          .in("id", courtIds);
        if (ctErr) throw ctErr;
        courtMap = (courtsFull ?? []).reduce<
          Record<string, { court_name: string | null; location_id: string | null }>
        >(
          (acc, c: any) => {
            acc[c.id as string] = {
              court_name: (c.name as string | null) ?? null,
              location_id: (c.location_id as string | null) ?? null,
            };
            return acc;
          },
          {}
        );
      }

      const locationIds = Array.from(
        new Set(
          Object.values(courtMap)
            .map((c) => c.location_id)
            .filter((id): id is string => !!id)
        )
      );
      let locationMap: Record<string, string | null> = {};
      if (locationIds.length > 0) {
        const { data: locData, error: locErr } = await supabase
          .from("locations")
          .select("id,name")
          .in("id", locationIds);
        if (locErr) throw locErr;
        locationMap = (locData ?? []).reduce<Record<string, string | null>>(
          (acc, l: any) => {
            acc[l.id as string] = (l.name as string | null) ?? null;
            return acc;
          },
          {}
        );
      }

      // 5) Mapear profesores para mostrar nombre
      const coachIds = Array.from(
        new Set(classes.map((c) => c.coach_id).filter((id): id is string => !!id))
      );
      const coachMap: Record<string, string | null> = {};
      if (coachIds.length > 0) {
        const { data: coachesData, error: coachesErr } = await supabase
          .from("coaches")
          .select("id,user_id");
        if (coachesErr) throw coachesErr;
        const coachesRaw = (coachesData ?? []) as { id: string; user_id: string | null }[];
        const coachUserIds = Array.from(
          new Set(coachesRaw.map((c) => c.user_id).filter((id): id is string => !!id))
        );
        let profilesMap: Record<string, string | null> = {};
        if (coachUserIds.length > 0) {
          const { data: profilesData, error: pErr } = await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", coachUserIds);
          if (pErr) throw pErr;
          profilesMap = (profilesData ?? []).reduce<Record<string, string | null>>(
            (acc, p: any) => {
              acc[p.id as string] = (p.full_name as string | null) ?? null;
              return acc;
            },
            {}
          );
        }
        coachesRaw.forEach((c) => {
          if (!coachIds.includes(c.id)) return;
          coachMap[c.id] = c.user_id ? profilesMap[c.user_id] ?? null : null;
        });
      }

      // 6) Agrupar asistencia por clase
      const byClass: Record<string, { present: number; absent: number }> = {};
      attendance.forEach((a) => {
        const key = a.class_id;
        if (!byClass[key]) {
          byClass[key] = { present: 0, absent: 0 };
        }
        if (a.present) {
          byClass[key].present += 1;
        } else {
          byClass[key].absent += 1;
        }
      });

      // 7) Construir filas finales
      const rows: LocationClassRow[] = classes.map((c) => {
        const counts = byClass[c.id] ?? { present: 0, absent: 0 };
        const courtInfo = c.court_id ? courtMap[c.court_id] : undefined;
        const locationName = courtInfo?.location_id
          ? locationMap[courtInfo.location_id] ?? null
          : null;
        const coachName = c.coach_id ? coachMap[c.coach_id] ?? null : null;
        return {
          class_id: c.id,
          date: c.date,
          coach_name: coachName,
          court_name: courtInfo?.court_name ?? null,
          location_name: locationName,
          present_count: counts.present,
          absent_count: counts.absent,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      const totalClasses = rows.length;
      const totalPresent = rows.reduce((acc, r) => acc + r.present_count, 0);
      const totalAbsent = rows.reduce((acc, r) => acc + r.absent_count, 0);
      setLocationRows(rows);
      setLocationSummary({ totalClasses, present: totalPresent, absent: totalAbsent });
    } catch (e) {
      const msg = (e as any)?.message || "Error cargando asistencia por sede/cancha";
      setError(msg);
      setLocationRows([]);
      setLocationSummary(null);
    } finally {
      setLocationLoading(false);
    }
  };

  const loadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await runIncomeReport();
  };

  const runCoachExpensesReport = async () => {
    if (!fromDate || !toDate) {
      setError("Selecciona un rango de fechas para egresos.");
      return;
    }
    if (!selectedAcademyId || academyLocationIds.size === 0) {
      setError("Selecciona una academia para ver este reporte de egresos.");
      return;
    }

    setCoachExpensesLoading(true);
    setRentExpensesLoading(true);
    setError(null);
    try {
      const { data: courtsData, error: courtsErr } = await supabase
        .from("courts")
        .select("id,location_id")
        .in("location_id", Array.from(academyLocationIds));
      if (courtsErr) throw courtsErr;

      const courts = (courtsData ?? []) as { id: string; location_id: string | null }[];
      if (courts.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        return;
      }

      const allowedCourtIds = courts.map((c) => c.id);

      const { data: clsData, error: clsErr } = await supabase
        .from("class_sessions")
        .select("id,date,coach_id,court_id")
        .gte("date", fromDate)
        .lte("date", toDate)
        .in("court_id", allowedCourtIds)
        .not("coach_id", "is", null);
      if (clsErr) throw clsErr;

      const classes = (clsData ?? []) as { id: string; date: string; coach_id: string | null; court_id: string | null }[];
      if (classes.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        setRentExpenses([]);
        setRentExpensesTotal(0);
        return;
      }

      // 2b) Filtrar solo clases con al menos 1 booking (mismo criterio que alquiler)
      const classIds = classes.map((c) => c.id);
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from('bookings')
        .select('class_id')
        .in('class_id', classIds);
      if (bookingsErr) throw bookingsErr;

      const bookedClassIds = new Set<string>();
      for (const row of (bookingsData ?? []) as any[]) {
        const cid = row?.class_id as string | undefined;
        if (cid) bookedClassIds.add(cid);
      }

      const classesWithStudents: ClassSessionRow[] = classes.filter((c) => bookedClassIds.has(c.id));
      if (classesWithStudents.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        setRentExpenses([]);
        setRentExpensesTotal(0);
        return;
      }

      const coachIds = Array.from(
        new Set(classesWithStudents.map((c) => c.coach_id).filter((id): id is string => !!id)),
      );
      if (coachIds.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        return;
      }

      const { data: coachesData, error: coachesErr } = await supabase
        .from("coaches")
        .select("id,user_id")
        .in("id", coachIds);
      if (coachesErr) throw coachesErr;
      const coachesRaw = (coachesData ?? []) as { id: string; user_id: string | null }[];

      const coachUserIds = Array.from(
        new Set(coachesRaw.map((c) => c.user_id).filter((id): id is string => !!id)),
      );
      let profilesMap: Record<string, string | null> = {};
      if (coachUserIds.length > 0) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", coachUserIds);
        if (profilesErr) throw profilesErr;
        profilesMap = (profilesData ?? []).reduce<Record<string, string | null>>(
          (acc, p: any) => {
            acc[p.id as string] = (p.full_name as string | null) ?? null;
            return acc;
          },
          {}
        );
      }

      const coachNameMap: Record<string, string | null> = {};
      coachesRaw.forEach((c) => {
        if (!coachIds.includes(c.id)) return;
        coachNameMap[c.id] = c.user_id ? profilesMap[c.user_id ?? ""] ?? null : null;
      });

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

      const agg: Record<string, CoachExpenseRow> = {};
      classes.forEach((cls) => {
        const coachId = cls.coach_id as string;
        if (!coachId) return;
        if (!agg[coachId]) {
          const fee = feeMap[coachId] ?? null;
          agg[coachId] = {
            coach_id: coachId,
            coach_name: coachNameMap[coachId] ?? null,
            classes_count: 0,
            fee_per_class: fee,
            total_expense: 0,
          };
        }
        agg[coachId].classes_count += 1;
        const fee = agg[coachId].fee_per_class ?? 0;
        agg[coachId].total_expense += fee;
      });

      const rowsAgg = Object.values(agg).sort((a, b) => (b.total_expense || 0) - (a.total_expense || 0));
      setCoachExpenses(rowsAgg);
      setCoachExpensesTotal(rowsAgg.reduce((acc, r) => acc + (r.total_expense || 0), 0));
    } catch (e) {
      const msg = (e as any)?.message || "Error cargando egresos por profesor";
      setError(msg);
      setCoachExpenses([]);
      setCoachExpensesTotal(0);
    } finally {
      setCoachExpensesLoading(false);
    }
  };

  const loadCoachExpenses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) {
      setError('Selecciona un rango de fechas para egresos.');
      return;
    }
    if (!selectedAcademyId || academyLocationIds.size === 0) {
      setError('Selecciona una academia para ver este reporte de egresos.');
      return;
    }

    setCoachExpensesLoading(true);
    setRentExpensesLoading(true);
    setError(null);
    try {
      // Rent mode
      let rentMode: RentMode = "per_student";
      try {
        const { data: acad, error: acadErr } = await supabase
          .from('academies')
          .select('rent_mode')
          .eq('id', selectedAcademyId)
          .maybeSingle();
        if (!acadErr) {
          const m = (acad as any)?.rent_mode as RentMode | null | undefined;
          if (m === 'per_student' || m === 'per_hour' || m === 'both') rentMode = m;
        }
      } catch {
        // default per_student
      }

      // Para timestamptz: incluir todo el rango de días (toDate inclusive)
      const fromInclusive = new Date(fromDate + 'T00:00:00.000Z').toISOString();
      const toExclusiveDate = new Date(toDate + 'T00:00:00.000Z');
      toExclusiveDate.setUTCDate(toExclusiveDate.getUTCDate() + 1);
      const toExclusive = toExclusiveDate.toISOString();

      // 1) Obtener canchas asociadas a las sedes de la academia seleccionada
      const { data: courtsData, error: courtsErr } = await supabase
        .from('courts')
        .select('id,location_id')
        .in('location_id', Array.from(academyLocationIds));
      if (courtsErr) throw courtsErr;

      const courts = (courtsData ?? []) as { id: string; location_id: string | null }[];
      if (courts.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        return;
      }

      const allowedCourtIds = courts.map((c) => c.id);

      // 2) Obtener clases en esas canchas y rango de fechas con profesor asignado
      const { data: clsData, error: clsErr } = await supabase
        .from('class_sessions')
        .select('id,date,coach_id,court_id')
        .gte('date', fromInclusive)
        .lt('date', toExclusive)
        .in('court_id', allowedCourtIds)
        .not('coach_id', 'is', null);
      if (clsErr) throw clsErr;

      const classes = (clsData ?? []) as ClassSessionRow[];
      if (classes.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        setRentExpenses([]);
        setRentExpensesTotal(0);
        return;
      }

      // Filtrar solo clases con al menos 1 booking (mismo criterio que Home/alquiler)
      const classIds = classes.map((c) => c.id);
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from('bookings')
        .select('class_id')
        .in('class_id', classIds);
      if (bookingsErr) throw bookingsErr;

      const bookedClassIds = new Set<string>();
      for (const row of (bookingsData ?? []) as any[]) {
        const cid = row?.class_id as string | undefined;
        if (cid) bookedClassIds.add(cid);
      }

      const classesWithStudents = classes.filter((c) => bookedClassIds.has(c.id));
      if (classesWithStudents.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        setRentExpenses([]);
        setRentExpensesTotal(0);
        return;
      }

      const coachIds = Array.from(
        new Set(classesWithStudents.map((c) => c.coach_id).filter((id): id is string => !!id)),
      );
      if (coachIds.length === 0) {
        setCoachExpenses([]);
        setCoachExpensesTotal(0);
        setRentExpenses([]);
        setRentExpensesTotal(0);
        return;
      }

      // 3) Mapear nombres de profesores
      const { data: coachesData, error: coachesErr } = await supabase
        .from('coaches')
        .select('id,user_id')
        .in('id', coachIds);
      if (coachesErr) throw coachesErr;
      const coachesRaw = (coachesData ?? []) as { id: string; user_id: string | null }[];

      const coachUserIds = Array.from(
        new Set(coachesRaw.map((c) => c.user_id).filter((id): id is string => !!id)),
      );
      let profilesMap: Record<string, string | null> = {};
      if (coachUserIds.length > 0) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', coachUserIds);
        if (profilesErr) throw profilesErr;
        profilesMap = (profilesData ?? []).reduce<Record<string, string | null>>(
          (acc, p: any) => {
            acc[p.id as string] = (p.full_name as string | null) ?? null;
            return acc;
          },
          {},
        );
      }

      const coachNameMap: Record<string, string | null> = {};
      coachesRaw.forEach((c) => {
        if (!coachIds.includes(c.id)) return;
        coachNameMap[c.id] = c.user_id ? profilesMap[c.user_id ?? ''] ?? null : null;
      });

      // 4) Mapear tarifas por clase por profesor para la academia seleccionada
      const { data: feesData, error: feesErr } = await supabase
        .from('coach_academy_fees')
        .select('coach_id,fee_per_class')
        .eq('academy_id', selectedAcademyId)
        .in('coach_id', coachIds);
      if (feesErr) throw feesErr;

      const feeMap: Record<string, number | null> = {};
      (feesData ?? []).forEach((row: any) => {
        feeMap[row.coach_id as string] = (row.fee_per_class as number | null) ?? null;
      });

      // 5) Agregar clases y calcular egresos
      const byCoach: Record<string, CoachExpenseRow> = {};
      classesWithStudents.forEach((c) => {
        const coachId = c.coach_id as string | null;
        if (!coachId) return;
        const fee = feeMap[coachId] ?? 0;
        if (!byCoach[coachId]) {
          byCoach[coachId] = {
            coach_id: coachId,
            coach_name: coachNameMap[coachId] ?? coachId,
            classes_count: 0,
            fee_per_class: feeMap[coachId] ?? null,
            total_expense: 0,
          };
        }
        byCoach[coachId].classes_count += 1;
        byCoach[coachId].total_expense += fee || 0;
      });

      const rows = Object.values(byCoach).sort((a, b) => b.total_expense - a.total_expense);
      const total = rows.reduce((acc, r) => acc + r.total_expense, 0);
      setCoachExpenses(rows);
      setCoachExpensesTotal(total);

      // 6) Egresos por alquiler (según rent_mode)
      let rentPerHourTotal = 0;
      let rentPerStudentTotal = 0;
      let rentPerHourRows: RentExpenseRow[] = [];

      if (rentMode === 'per_hour' || rentMode === 'both') {
        try {
          const { data: rentRows, error: rentErr } = await supabase.rpc('get_rent_expenses', {
            academy_id: selectedAcademyId,
            from_date: fromDate,
            to_date: toDate,
          });

          if (rentErr) throw rentErr;

          const mappedRent = ((rentRows ?? []) as any[]).map((r) => ({
            location_id: r.location_id as string,
            location_name: (r.location_name as string | null) ?? null,
            classes_count: Number(r.classes_count ?? 0),
            rent_total: Number(r.rent_total ?? 0),
          })) as RentExpenseRow[];

          rentPerHourRows = mappedRent;
          rentPerHourTotal = mappedRent.reduce((acc, r) => acc + (r.rent_total || 0), 0);
        } catch (rpcErr: any) {
          console.error('Error cargando alquiler (RPC get_rent_expenses)', rpcErr);
          rentPerHourTotal = 0;
          rentPerHourRows = [];
        }
      }

      if (rentMode === 'per_student' || rentMode === 'both') {
        try {
          const TZ = 'America/Asuncion';

          // contar alumnos por clase via plan_usages
          const studentsCountByClass: Record<string, number> = {};
          const classIdsForCount = classesWithStudents.map((c) => c.id);
          if (classIdsForCount.length > 0) {
            const { data: usageRows, error: usageErr } = await supabase
              .from('plan_usages')
              .select('class_id')
              .in('class_id', classIdsForCount)
              .eq('status', 'confirmed');
            if (usageErr) throw usageErr;
            for (const r of (usageRows ?? []) as any[]) {
              const cid = r?.class_id as string | undefined;
              if (!cid) continue;
              studentsCountByClass[cid] = (studentsCountByClass[cid] ?? 0) + 1;
            }
          }

          // load active timebands per_student
          const [locBandsRes, courtBandsRes] = await Promise.all([
            supabase
              .from('location_rent_fees_per_student')
              .select(
                'location_id, fee_per_student, fee_per_student_one, fee_per_student_two_plus, valid_from, valid_to, time_from, time_to',
              )
              .eq('academy_id', selectedAcademyId)
              .is('valid_to', null),
            supabase
              .from('court_rent_fees_per_student')
              .select(
                'court_id, fee_per_student, fee_per_student_one, fee_per_student_two_plus, valid_from, valid_to, time_from, time_to',
              )
              .eq('academy_id', selectedAcademyId)
              .is('valid_to', null),
          ]);

          if (locBandsRes.error) throw locBandsRes.error;
          if (courtBandsRes.error) throw courtBandsRes.error;

          const locationBands: Record<
            string,
            { time_from: string; time_to: string; fee_one: number; fee_two: number; valid_from: string }[]
          > = {};
          for (const r of (locBandsRes.data ?? []) as any[]) {
            const lid = r.location_id as string | undefined;
            const feeLegacy = Number(r.fee_per_student);
            const feeOne = Number(r.fee_per_student_one ?? r.fee_per_student);
            const feeTwo = Number(r.fee_per_student_two_plus ?? r.fee_per_student);
            const vf = r.valid_from as string | undefined;
            const tf = String(r.time_from ?? '').slice(0, 5);
            const tt = String(r.time_to ?? '').slice(0, 5);
            if (!lid || !vf || !tf || !tt) continue;
            if (Number.isNaN(feeLegacy) || feeLegacy < 0) continue;
            if (Number.isNaN(feeOne) || feeOne < 0) continue;
            if (Number.isNaN(feeTwo) || feeTwo < 0) continue;
            (locationBands[lid] ||= []).push({ time_from: tf, time_to: tt, fee_one: feeOne, fee_two: feeTwo, valid_from: vf });
          }

          const courtBands: Record<
            string,
            { time_from: string; time_to: string; fee_one: number; fee_two: number; valid_from: string }[]
          > = {};
          for (const r of (courtBandsRes.data ?? []) as any[]) {
            const cid = r.court_id as string | undefined;
            const feeLegacy = Number(r.fee_per_student);
            const feeOne = Number(r.fee_per_student_one ?? r.fee_per_student);
            const feeTwo = Number(r.fee_per_student_two_plus ?? r.fee_per_student);
            const vf = r.valid_from as string | undefined;
            const tf = String(r.time_from ?? '').slice(0, 5);
            const tt = String(r.time_to ?? '').slice(0, 5);
            if (!cid || !vf || !tf || !tt) continue;
            if (Number.isNaN(feeLegacy) || feeLegacy < 0) continue;
            if (Number.isNaN(feeOne) || feeOne < 0) continue;
            if (Number.isNaN(feeTwo) || feeTwo < 0) continue;
            (courtBands[cid] ||= []).push({ time_from: tf, time_to: tt, fee_one: feeOne, fee_two: feeTwo, valid_from: vf });
          }

          // helpers
          const courtToLocation: Record<string, string | null> = {};
          for (const c of courts) courtToLocation[c.id] = c.location_id ?? null;

          const findBandFee = (
            rows: { time_from: string; time_to: string; fee_one: number; fee_two: number; valid_from: string }[],
            classDay: string,
            hm: string,
            students: number,
          ) => {
            const candidates = (rows ?? [])
              .filter((r) => r.valid_from <= classDay)
              .filter((r) => r.time_from <= hm && hm < r.time_to)
              .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
            const picked = candidates[0];
            if (!picked) return 0;
            return students <= 1 ? picked.fee_one ?? 0 : picked.fee_two ?? 0;
          };

          // aggregate per location
          const rentByLocation: Record<string, { classes: number; total: number }> = {};
          for (const cls of classesWithStudents) {
            const classId = cls.id;
            const students = studentsCountByClass[classId] ?? 0;
            if (students <= 0) continue;
            const courtId = cls.court_id as string | null;
            if (!courtId) continue;
            const locationId = courtToLocation[courtId] ?? null;
            if (!locationId) continue;

            const classDay = getLocalYmdFromIso(cls.date, TZ);
            const hm = getLocalHmFromIso(cls.date, TZ);

            const feeCourt = findBandFee(courtBands[courtId] ?? [], classDay, hm, students);
            const feeLoc = feeCourt > 0 ? feeCourt : findBandFee(locationBands[locationId] ?? [], classDay, hm, students);
            if (feeLoc <= 0) continue;

            const cost = students * feeLoc;
            rentPerStudentTotal += cost;
            if (!rentByLocation[locationId]) rentByLocation[locationId] = { classes: 0, total: 0 };
            rentByLocation[locationId].classes += 1;
            rentByLocation[locationId].total += cost;
          }

          // map location names
          const { data: locNames, error: locNamesErr } = await supabase
            .from('locations')
            .select('id,name')
            .in('id', Object.keys(rentByLocation));
          if (locNamesErr) throw locNamesErr;
          const nameMap: Record<string, string | null> = {};
          (locNames ?? []).forEach((l: any) => {
            if (!l?.id) return;
            nameMap[l.id as string] = (l.name as string | null) ?? null;
          });

          const mapped = Object.entries(rentByLocation)
            .map(([locationId, v]) => ({
              location_id: locationId,
              location_name: nameMap[locationId] ?? null,
              classes_count: v.classes,
              rent_total: v.total,
            }))
            .sort((a, b) => (b.rent_total || 0) - (a.rent_total || 0));

          // si rentMode es per_student, este es el reporte principal
          if (rentMode === 'per_student') {
            setRentExpenses(mapped);
          }
        } catch (e: any) {
          console.error('Error calculando alquiler per_student', e);
          rentPerStudentTotal = 0;
          if (rentMode === 'per_student') setRentExpenses([]);
        }
      }

      // Mostrar detalle de alquiler según modo
      if (rentMode === 'per_hour' || rentMode === 'both') {
        // per_hour/both: mantenemos el detalle por sede que devuelve la RPC
        setRentExpenses(rentPerHourRows);
      }

      const rentTotal =
        rentMode === 'per_student'
          ? rentPerStudentTotal
          : rentMode === 'per_hour'
            ? rentPerHourTotal
            : rentPerHourTotal + rentPerStudentTotal;

      setRentExpensesTotal(rentTotal);
    } catch (e: any) {
      const msg = e?.message ?? 'Error cargando egresos por profesor.';
      setError(msg);
      setCoachExpenses([]);
      setCoachExpensesTotal(0);
      setRentExpenses([]);
      setRentExpensesTotal(0);
    } finally {
      setCoachExpensesLoading(false);
      setRentExpensesLoading(false);
    }
  };

  // ...

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          {/* ... */}
          <BarChart3 className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Reportes</h1>
            <p className="text-sm text-gray-600">Consulta ingresos y uso de clases.</p>
          </div>
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

      {/* Ingresos */}
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowIncome((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#3cadaf]" />
            Ingresos
          </span>
          <span className="text-xs text-gray-500">{showIncome ? '▼' : '▲'}</span>
        </button>
        <AnimatePresence initial={false}>
          {showIncome && (
            <motion.div
              key="income-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="p-4 space-y-4 origin-top"
            >
            {/* Filtro de ingresos por fecha */}
            <form onSubmit={loadReport} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="min-w-0 flex flex-col items-start w-full max-w-xs">
                  <label className="block text-sm mb-1">Desde</label>
                  <DatePickerField value={fromDate} onChange={setFromDate} />
                </div>
                <div className="min-w-0 flex flex-col items-start w-full max-w-xs">
                  <label className="block text-sm mb-1">Hasta</label>
                  <DatePickerField value={toDate} onChange={setToDate} />
                </div>
                <div className="flex items-end gap-2 justify-end md:justify-start flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setRows([]);
                      setTotalAmount(0);
                      setStudentSummary([]);
                      setPlanSummary([]);
                      setError(null);
                    }}
                  >
                    <Eraser className="w-3 h-3" />
                    Limpiar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#3cadaf] hover:bg-[#31435d] text-white px-4 py-2 disabled:opacity-50 text-sm"
                    disabled={loading}
                  >
                    {loading ? "Cargando..." : "Ver ingresos"}
                  </Button>
                </div>
              </div>

              {incomeChartData.length > 0 && (
                <div className="mt-4 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeChartData} margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickMargin={8}
                      />
                      <YAxis tick={{ fontSize: 10 }} tickMargin={8} />
                      <Tooltip
                        formatter={(value: any) => [`${formatPyg(Number(value))} PYG`, "Total"]}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      {/* Ingresos: color principal de la app */}
                      <Bar dataKey="total" fill="#3cadaf" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
            </form>

            {/* Resumen y detalle de ingresos */}
            <div className="border rounded-lg bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-600">Total ingresado en el periodo seleccionado</p>
                  <p className="text-2xl font-semibold text-[#31435d]">
                    {loading ? "..." : `${formatPyg(totalAmount)} PYG`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-gray-500 relative">
                  <div>
                    {rows.length > 0
                      ? `Mostrando ${rows.length} pagos`
                      : "Sin pagos en el rango seleccionado"}
                  </div>
                  {rows.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-3 py-1 border rounded bg-white hover:bg-gray-50 text-[11px] text-gray-700"
                        onClick={() =>
                          setExportMenu((m) => ({
                            income: !m.income,
                            expenses: false,
                            attendanceStudent: false,
                            attendanceCoach: false,
                            attendanceLocation: false,
                          }))
                        }
                      >
                        <Download className="w-3 h-3" />
                        Exportar
                      </button>
                      {exportMenu.income && (
                        <div className="absolute right-0 mt-1 w-40 border rounded bg-white shadow text-[11px] z-10">
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToExcel(
                                buildReportFileName("Ingresos", fromDate, toDate, "xlsx"),
                                "Ingresos",
                                rows.map((r) => ({
                                  Fecha: new Date(r.payment_date).toLocaleDateString(),
                                  Alumno: r.student_name ?? r.student_id,
                                  Plan: r.plan_name ?? "-",
                                  Metodo: r.method,
                                  Monto: r.amount,
                                  Moneda: r.currency,
                                })),
                                fromDate,
                                toDate,
                              );
                              setExportMenu((m) => ({ ...m, income: false }));
                            }}
                          >
                            Excel (.xlsx)
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToPdf(
                                buildReportFileName("Ingresos", fromDate, toDate, "pdf"),
                                "Ingresos",
                                ["Fecha", "Alumno", "Plan", "Metodo", "Monto", "Moneda"],
                                rows.map((r) => [
                                  new Date(r.payment_date).toLocaleDateString(),
                                  r.student_name ?? r.student_id,
                                  r.plan_name ?? "-",
                                  r.method,
                                  String(r.amount),
                                  r.currency,
                                ]),
                                fromDate,
                                toDate,
                              );
                              setExportMenu((m) => ({ ...m, income: false }));
                            }}
                          >
                            PDF (.pdf)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {rows.length > 0 && (
                <>
                  {/* Resumen por alumno (el detalle completo se ve en el modal) */}
                  {studentSummary.length > 0 && (
                    <div className="border rounded-lg bg-white p-3 space-y-3 text-sm mt-3">
                      <div>
                        <p className="text-xs text-gray-600">Resumen por alumno</p>
                        <p className="text-[11px] text-gray-500">
                          Solo muestra total y cantidad de pagos. Toca un alumno para ver el histórico.
                        </p>
                      </div>

                      {/* Mobile: tarjetas */}
                      <div className="space-y-2 md:hidden">
                        {studentSummary.map((s) => (
                          <button
                            key={s.student_id}
                            type="button"
                            className="border rounded-lg px-3 py-2 text-xs bg-white flex flex-col gap-1 text-left w-full hover:bg-gray-50"
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
                                {s.payments_count} pago{s.payments_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="text-gray-600">
                              <span className="font-semibold">Total:</span>{" "}
                              {formatPyg(s.total_amount)} PYG
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Desktop: tabla */}
                      <div className="overflow-x-auto hidden md:block">
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
                                <td className="px-3 py-2 align-top">{s.student_name ?? s.student_id}</td>
                                <td className="px-3 py-2 align-top text-right">{formatPyg(s.total_amount)} PYG</td>
                                <td className="px-3 py-2 align-top text-right">{s.payments_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Egresos por profesor/cancha y ganancia neta */}
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowCoachExpenses((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#3cadaf]" />
            Egresos por profesor/cancha y ganancia neta
          </span>
          <span className="text-xs text-gray-500">{showCoachExpenses ? "▼" : "▲"}</span>
        </button>
        <AnimatePresence initial={false}>
          {showCoachExpenses && (
            <motion.div
              key="coach-expenses-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="p-4 space-y-4 origin-top"
            >
              <form onSubmit={loadCoachExpenses} className="space-y-3">
                <p className="text-xs text-gray-600">
                  Este reporte usa el mismo rango de fechas seleccionado en <strong>Ingresos</strong> y la
                  academia activa en configuración.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col text-xs text-gray-500">
                    <span>
                      Desde: <strong>{fromDate || "no definido"}</strong>
                    </span>
                    <span>
                      Hasta: <strong>{toDate || "no definido"}</strong>
                    </span>
                  </div>
                  <Button
                    type="submit"
                    className="ml-auto bg-[#3cadaf] hover:bg-[#31435d] text-white px-4 py-2 disabled:opacity-50 text-sm"
                    disabled={coachExpensesLoading}
                  >
                    {coachExpensesLoading ? "Calculando..." : "Calcular egresos y ganancia"}
                  </Button>
                </div>
              </form>

              {(coachExpenses.length > 0 || coachExpensesLoading) && (
                <div className="border rounded-lg bg-white p-3 space-y-4 text-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-600">Total egresos a profesores</p>
                      <p className="text-lg font-semibold text-[#31435d]">
                        {coachExpensesLoading ? "..." : `${formatPyg(coachExpensesTotal)} PYG`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total alquiler de canchas</p>
                      <p className="text-lg font-semibold text-[#31435d]">
                        {rentExpensesLoading ? "..." : `${formatPyg(rentExpensesTotal)} PYG`}
                      </p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-1 text-xs text-gray-500 relative">
                      <div>
                        <p className="text-xs text-gray-600">Ganancia neta (ingresos - egresos)</p>
                        <p className="text-lg font-semibold text-[#31435d]">
                          {coachExpensesLoading
                            ? "..."
                            : `${formatPyg(totalAmount - (coachExpensesTotal + rentExpensesTotal))} PYG`}
                        </p>
                      </div>
                      {(coachExpenses.length > 0 || rentExpenses.length > 0) && (
                        <div className="relative mt-1">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1 border rounded bg-white hover:bg-gray-50 text-[11px] text-gray-700"
                            onClick={() =>
                              setExportMenu((m) => ({
                                income: false,
                                expenses: !m.expenses,
                                attendanceStudent: false,
                                attendanceCoach: false,
                                attendanceLocation: false,
                              }))
                            }
                          >
                            <Download className="w-3 h-3" />
                            Exportar
                          </button>
                          {exportMenu.expenses && (
                            <div className="absolute left-0 md:left-auto md:right-0 mt-1 w-40 border rounded bg-white shadow text-[11px] z-10">
                              <button
                                type="button"
                                className="w-full px-3 py-1 text-left hover:bg-gray-50"
                                onClick={() => {
                                  const rowsToExport = [
                                    ...coachExpenses.map((c) => ({
                                      Categoria: 'Profesor',
                                      Nombre: c.coach_name ?? c.coach_id,
                                      Clases: c.classes_count,
                                      'Tarifa por clase': c.fee_per_class ?? 0,
                                      'Egreso total': c.total_expense,
                                      Moneda: 'PYG',
                                    })),
                                    ...rentExpenses.map((r) => ({
                                      Categoria: 'Cancha',
                                      Nombre: r.location_name ?? r.location_id,
                                      Clases: r.classes_count,
                                      'Tarifa por clase': '',
                                      'Egreso total': r.rent_total,
                                      Moneda: 'PYG',
                                    })),
                                  ];

                                  exportToExcel(
                                    buildReportFileName("Egresos", fromDate, toDate, "xlsx"),
                                    "Egresos",
                                    rowsToExport,
                                    fromDate,
                                    toDate,
                                  );
                                  setExportMenu((m) => ({ ...m, expenses: false }));
                                }}
                              >
                                Excel (.xlsx)
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-1 text-left hover:bg-gray-50"
                                onClick={() => {
                                  const rowsToExport = [
                                    ...coachExpenses.map((c) => [
                                      'Profesor',
                                      c.coach_name ?? c.coach_id,
                                      String(c.classes_count),
                                      String(c.fee_per_class ?? 0),
                                      String(c.total_expense),
                                      'PYG',
                                    ]),
                                    ...rentExpenses.map((r) => [
                                      'Cancha',
                                      r.location_name ?? r.location_id,
                                      String(r.classes_count),
                                      '',
                                      String(r.rent_total),
                                      'PYG',
                                    ]),
                                  ];

                                  exportToPdf(
                                    buildReportFileName("Egresos", fromDate, toDate, "pdf"),
                                    "Egresos",
                                    [
                                      'Categoria',
                                      'Nombre',
                                      'Clases',
                                      'Tarifa por clase',
                                      'Egreso total',
                                      'Moneda',
                                    ],
                                    rowsToExport.map((r) => [
                                      r[0],
                                      r[1],
                                      String(r[2]),
                                      String(r[3] ?? ''),
                                      String(r[4] ?? ''),
                                      String(r[5] ?? ''),
                                    ]),
                                    fromDate,
                                    toDate,
                                  );
                                  setExportMenu((m) => ({ ...m, expenses: false }));
                                }}
                              >
                                PDF (.pdf)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    Los egresos se calculan como <strong>clases impartidas × tarifa por clase</strong> por profesor.
                  </p>

                  {/* Gráfico de egresos por profesor */}
                  {coachExpenses.length > 0 && (
                    <div className="mt-2 h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={coachExpenses.map((c) => ({
                            coach: c.coach_name ?? c.coach_id,
                            total: c.total_expense,
                          }))}
                          margin={{ top: 8, right: 16, left: 24, bottom: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="coach"
                            tick={{ fontSize: 10 }}
                            tickMargin={8}
                            interval={0}
                            angle={-30}
                            textAnchor="end"
                          />
                          <YAxis tick={{ fontSize: 10 }} tickMargin={8} />
                          <Tooltip
                            formatter={(value: any) => [`${formatPyg(Number(value))} PYG`, "Egreso"]}
                            labelStyle={{ fontSize: 11 }}
                            contentStyle={{ fontSize: 11 }}
                          />
                          {/* Egresos: usar el color oscuro principal */}
                          <Bar dataKey="total" fill="#31435d" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Gráfico comparativo Ingresos vs Egresos */}
                  {!coachExpensesLoading && (totalAmount > 0 || coachExpensesTotal > 0) && (
                    <div className="mt-4 h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { label: "Ingresos", value: totalAmount },
                            { label: "Egresos", value: coachExpensesTotal + rentExpensesTotal },
                          ]}
                          margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickMargin={8} />
                          <YAxis tick={{ fontSize: 10 }} tickMargin={8} />
                          <Tooltip
                            formatter={(value: any, name: any, props: any) => [
                              `${formatPyg(Number(value))} PYG`,
                              props?.payload?.label ?? "",
                            ]}
                            labelStyle={{ fontSize: 11 }}
                            contentStyle={{ fontSize: 11 }}
                          />
                          {/* Comparativo: ingreso con color principal, egreso con color oscuro */}
                          <Bar
                            dataKey="value"
                            radius={[4, 4, 0, 0]}
                            fill="#3cadaf"
                          >
                            <Cell key="ingresos" fill="#3cadaf" />
                            <Cell key="egresos" fill="#31435d" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {(rentExpenses.length > 0 || rentExpensesLoading) && (
                <div className="border rounded-lg bg-white p-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600">Detalle de alquiler por sede</p>
                      <p className="text-[11px] text-gray-500">
                        Se calcula por clase (60 min) y solo cuenta clases con al menos 1 alumno.
                      </p>
                    </div>
                  </div>

                  {rentExpensesLoading ? (
                    <p className="text-xs text-gray-600">Calculando alquiler...</p>
                  ) : rentExpenses.length === 0 ? (
                    <p className="text-xs text-gray-600">Sin alquiler calculado para el rango.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs md:text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2 border-b">Sede</th>
                            <th className="px-3 py-2 border-b text-right">Clases</th>
                            <th className="px-3 py-2 border-b text-right">Alquiler total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rentExpenses.map((r) => (
                            <tr key={r.location_id} className="border-b last:border-b-0">
                              <td className="px-3 py-2 align-top">{r.location_name ?? r.location_id}</td>
                              <td className="px-3 py-2 align-top text-right">{r.classes_count}</td>
                              <td className="px-3 py-2 align-top text-right">{formatPyg(r.rent_total)} PYG</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {coachExpenses.length > 0 && (
                <div className="border rounded-lg bg-white p-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600">Detalle de egresos por profesor</p>
                      <p className="text-[11px] text-gray-500">
                        Se calcula como clases impartidas × tarifa por clase.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="px-3 py-2 border-b">Profesor</th>
                          <th className="px-3 py-2 border-b text-right">Clases impartidas</th>
                          <th className="px-3 py-2 border-b text-right">Tarifa/clase</th>
                          <th className="px-3 py-2 border-b text-right">Egreso total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coachExpenses.map((c) => (
                          <tr key={c.coach_id} className="border-b last:border-b-0">
                            <td className="px-3 py-2 align-top">{c.coach_name ?? c.coach_id}</td>
                            <td className="px-3 py-2 align-top text-right">{c.classes_count}</td>
                            <td className="px-3 py-2 align-top text-right">
                              {c.fee_per_class != null ? `${formatPyg(c.fee_per_class)} PYG` : "Sin tarifa"}
                            </td>
                            <td className="px-3 py-2 align-top text-right">{formatPyg(c.total_expense)} PYG</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Resumen por plan */}
      {planSummary.length > 0 && (
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
            onClick={() => setShowPlanSummary((v) => !v)}
          >
            <span className="inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-500" />
              Resumen por plan
            </span>
            <span className="text-xs text-gray-500">{showPlanSummary ? '▼' : '▲'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showPlanSummary && (
              <motion.div
                key="plan-summary-content"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="p-4 space-y-3 origin-top"
              >
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
                        {formatPyg(p.total_amount)} PYG
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
                            {formatPyg(p.total_amount)} PYG
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            {p.payments_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* Asistencia / Uso de clases por alumno */}
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowAttendanceStudent((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            Asistencia / Uso de clases por alumno
          </span>
          <span className="text-xs text-gray-500">
            {showAttendanceStudent ? "▼" : "▲"}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {showAttendanceStudent && (
            <motion.div
              key="attendance-student-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="p-4 space-y-4 origin-top"
            >
              <form onSubmit={loadAttendanceByStudent} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Alumno</label>
                  <SearchableSelect
                    value={attendanceStudentId}
                    onValueChange={(val) => setAttendanceStudentId(val)}
                    options={attendanceStudents}
                    placeholder="Selecciona un alumno"
                    disabled={attendanceStudents.length === 0}
                    contentClassName="w-80"
                  />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Desde</label>
                  <DatePickerField value={attendanceFrom} onChange={setAttendanceFrom} />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Hasta</label>
                  <DatePickerField value={attendanceTo} onChange={setAttendanceTo} />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <div className="relative">
                  {attendanceRows.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                        onClick={() =>
                          setExportMenu((m) => ({
                            income: false,
                            expenses: false,
                            attendanceStudent: !m.attendanceStudent,
                            attendanceCoach: false,
                            attendanceLocation: false,
                          }))
                        }
                      >
                        <Download className="w-3 h-3" />
                        Exportar
                      </button>
                      {exportMenu.attendanceStudent && (
                        <div className="absolute left-0 mt-1 w-40 border rounded bg-white shadow text-[11px] z-10">
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToExcel(
                                buildReportFileName("Asistencia por alumno", attendanceFrom, attendanceTo, "xlsx"),
                                "Asistencia por alumno",
                                attendanceRows.map((r) => ({
                                  Fecha: new Date(r.date).toLocaleString(),
                                  Sede: r.location_name ?? "-",
                                  Cancha: r.court_name ?? "-",
                                  Profesor: r.coach_name ?? "-",
                                  Estado: r.present ? "Presente" : "Ausente",
                                })),
                                attendanceFrom,
                                attendanceTo,
                              );
                              setExportMenu((m) => ({
                                ...m,
                                attendanceStudent: false,
                              }));
                            }}
                          >
                            Excel (.xlsx)
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToPdf(
                                buildReportFileName("Asistencia por alumno", attendanceFrom, attendanceTo, "pdf"),
                                "Asistencia por alumno",
                                ["Fecha", "Sede", "Cancha", "Profesor", "Estado"],
                                attendanceRows.map((r) => [
                                  new Date(r.date).toLocaleString(),
                                  r.location_name ?? "-",
                                  r.court_name ?? "-",
                                  r.coach_name ?? "-",
                                  r.present ? "Presente" : "Ausente",
                                ]),
                                attendanceFrom,
                                attendanceTo,
                              );
                              setExportMenu((m) => ({
                                ...m,
                                attendanceStudent: false,
                              }));
                            }}
                          >
                            PDF (.pdf)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                  onClick={() => {
                    setAttendanceFrom("");
                    setAttendanceTo("");
                    setAttendanceRows([]);
                    setAttendanceSummary(null);
                    setError(null);
                  }}
                >
                  <Eraser className="w-3 h-3" />
                  Limpiar
                </button>
                <button
                  type="submit"
                  className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50 text-sm"
                  disabled={attendanceLoading}
                >
                  {attendanceLoading
                    ? "Cargando asistencia..."
                    : "Ver asistencia"}
                </button>
              </div>
            </form>

            {attendanceSummary && (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                  <div className="space-y-1">
                    <p className="text-gray-700">
                      <span className="font-semibold">
                        Total clases en el periodo:
                      </span>{" "}
                      {attendanceSummary.total}
                    </p>
                    <p className="text-green-700 text-sm">
                      <span className="font-semibold">Presentes:</span>{" "}
                      {attendanceSummary.present}
                    </p>
                    <p className="text-red-700 text-sm">
                      <span className="font-semibold">Ausentes:</span>{" "}
                      {attendanceSummary.absent}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Presentes", value: attendanceSummary.present },
                        { name: "Ausentes", value: attendanceSummary.absent },
                      ]}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickMargin={8} />
                      <YAxis tick={{ fontSize: 10 }} tickMargin={6} allowDecimals={false} />
                      <Tooltip
                        formatter={(value: any) => [String(value), "Cantidad"]}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[
                          attendanceSummary.present,
                          attendanceSummary.absent,
                        ].map((_, idx) => (
                          <Cell
                            // eslint-disable-next-line react/no-array-index-key
                            key={idx}
                            fill={idx === 0 ? "#16a34a" : "#dc2626"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {attendanceRows.length > 0 && (
              <>
                {/* Mobile: tarjetas */}
                <div className="mt-2 space-y-2 md:hidden">
                  {attendanceRows.map((r) => (
                    <div
                      key={r.class_id + r.date}
                      className="border rounded-lg px-3 py-2 text-xs bg-white flex flex-col gap-1"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[#31435d]">
                          {new Date(r.date).toLocaleString()}
                        </span>
                        <span
                          className={
                            r.present
                              ? "text-green-700 font-semibold"
                              : "text-red-700 font-semibold"
                          }
                        >
                          {r.present ? "Presente" : "Ausente"}
                        </span>
                      </div>
                      {r.location_name && (
                        <div className="text-gray-600">
                          <span className="font-semibold">Sede:</span>{" "}
                          {r.location_name}
                        </div>
                      )}
                      {r.court_name && (
                        <div className="text-gray-600">
                          <span className="font-semibold">Cancha:</span>{" "}
                          {r.court_name}
                        </div>
                      )}
                      {r.coach_name && (
                        <div className="text-gray-600">
                          <span className="font-semibold">Profesor:</span>{" "}
                          {r.coach_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="overflow-x-auto mt-2 hidden md:block">
                  <table className="min-w-full text-xs md:text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 border-b">Fecha</th>
                        <th className="px-3 py-2 border-b">Sede</th>
                        <th className="px-3 py-2 border-b">Cancha</th>
                        <th className="px-3 py-2 border-b">Profesor</th>
                        <th className="px-3 py-2 border-b">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRows.map((r) => (
                        <tr
                          key={r.class_id + r.date}
                          className="border-b last:border-b-0"
                        >
                          <td className="px-3 py-2 align-top">
                            {new Date(r.date).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {r.location_name ?? "-"}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {r.court_name ?? "-"}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {r.coach_name ?? "-"}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <span
                              className={
                                r.present
                                  ? "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700"
                                  : "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700"
                              }
                            >
                              {r.present ? "Presente" : "Ausente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Asistencia / Uso de clases por profesor */}
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowAttendanceCoach((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <Users className="w-4 h-4 text-[#3cadaf]" />
            Asistencia / Uso de clases por profesor
          </span>
          <span className="text-xs text-gray-500">{showAttendanceCoach ? '▼' : '▲'}</span>
        </button>
        <AnimatePresence initial={false}>
          {showAttendanceCoach && (
            <motion.div
              key="attendance-coach-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="p-4 space-y-4 origin-top"
            >
              <form onSubmit={loadAttendanceByCoach} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Profesor</label>
                  <SearchableSelect
                    value={coachId}
                    onValueChange={(val) => setCoachId(val)}
                    options={coachOptions}
                    placeholder="Selecciona un profesor"
                    disabled={coachOptions.length === 0}
                    contentClassName="w-80"
                  />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Desde</label>
                  <DatePickerField value={coachFrom} onChange={setCoachFrom} />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Hasta</label>
                  <DatePickerField value={coachTo} onChange={setCoachTo} />
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <div className="relative">
                  {coachRows.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
                        onClick={() =>
                          setExportMenu((m) => ({
                            income: false,
                            expenses: false,
                            attendanceStudent: false,
                            attendanceCoach: !m.attendanceCoach,
                            attendanceLocation: false,
                          }))
                        }
                      >
                        Exportar
                      </button>
                      {exportMenu.attendanceCoach && (
                        <div className="absolute left-0 mt-1 w-40 border rounded bg-white shadow text-[11px] z-10">
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToExcel(
                                buildReportFileName("Asistencia por profesor", coachFrom, coachTo, "xlsx"),
                                "Asistencia por profesor",
                                coachRows.map((r) => ({
                                  Fecha: new Date(r.date).toLocaleString(),
                                  Sede: r.location_name ?? "-",
                                  Cancha: r.court_name ?? "-",
                                  Presentes: r.present_count,
                                  Ausentes: r.absent_count,
                                })),
                                coachFrom,
                                coachTo,
                              );
                              setExportMenu((m) => ({ ...m, attendanceCoach: false }));
                            }}
                          >
                            Excel (.xlsx)
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToPdf(
                                buildReportFileName("Asistencia por profesor", coachFrom, coachTo, "pdf"),
                                "Asistencia por profesor",
                                ["Fecha", "Sede", "Cancha", "Presentes", "Ausentes"],
                                coachRows.map((r) => [
                                  new Date(r.date).toLocaleString(),
                                  r.location_name ?? "-",
                                  r.court_name ?? "-",
                                  String(r.present_count),
                                  String(r.absent_count),
                                ]),
                                coachFrom,
                                coachTo,
                              );
                              setExportMenu((m) => ({ ...m, attendanceCoach: false }));
                            }}
                          >
                            PDF (.pdf)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                  onClick={() => {
                    setCoachFrom("");
                    setCoachTo("");
                    setCoachRows([]);
                    setCoachSummary(null);
                  }}
                >
                  <Eraser className="w-3 h-3" />
                  Limpiar
                </button>
                <button
                  type="submit"
                  className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50 text-sm"
                  disabled={coachLoading}
                >
                  {coachLoading ? 'Cargando asistencia...' : 'Ver asistencia'}
                </button>
              </div>
            </form>

            {coachSummary && (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                  <div className="space-y-1">
                    <p className="text-gray-700">
                      <span className="font-semibold">Total clases en el periodo:</span>{' '}
                      {coachSummary.totalClasses}
                    </p>
                    <p className="text-green-700 text-sm">
                      <span className="font-semibold">Presentes (alumnos):</span>{' '}
                      {coachSummary.present}
                    </p>
                    <p className="text-red-700 text-sm">
                      <span className="font-semibold">Ausentes (alumnos):</span>{' '}
                      {coachSummary.absent}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Presentes", value: coachSummary.present },
                        { name: "Ausentes", value: coachSummary.absent },
                      ]}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickMargin={8} />
                      <YAxis tick={{ fontSize: 10 }} tickMargin={6} allowDecimals={false} />
                      <Tooltip
                        formatter={(value: any) => [String(value), "Cantidad"]}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[
                          coachSummary.present,
                          coachSummary.absent,
                        ].map((_, idx) => (
                          <Cell
                            // eslint-disable-next-line react/no-array-index-key
                            key={idx}
                            fill={idx === 0 ? "#16a34a" : "#dc2626"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {coachRows.length > 0 && (
              <>
                {/* Mobile: tarjetas */}
                <div className="mt-2 space-y-2 md:hidden">
                  {coachRows.map((r) => (
                    <button
                      key={r.class_id + r.date}
                      type="button"
                      className="border rounded-lg px-3 py-2 text-xs bg-white flex flex-col gap-1 text-left w-full"
                      onClick={() =>
                        loadLocationClassDetail(r.class_id, {
                          date: r.date,
                          location_name: r.location_name ?? null,
                          court_name: r.court_name ?? null,
                          coach_name: null,
                        })
                      }
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[#31435d]">
                          {new Date(r.date).toLocaleString()}
                        </span>
                        <span className="text-gray-600 text-[11px]">
                          {r.location_name ?? '-'} / {r.court_name ?? '-'}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Presentes:</span>{' '}
                        {r.present_count}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Ausentes:</span>{' '}
                        {r.absent_count}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="overflow-x-auto mt-2 hidden md:block">
                  <table className="min-w-full text-xs md:text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 border-b">Fecha</th>
                        <th className="px-3 py-2 border-b">Sede</th>
                        <th className="px-3 py-2 border-b">Cancha</th>
                        <th className="px-3 py-2 border-b text-right">Presentes</th>
                        <th className="px-3 py-2 border-b text-right">Ausentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coachRows.map((r) => (
                        <tr
                          key={r.class_id + r.date}
                          className="border-b last:border-b-0 cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            loadLocationClassDetail(r.class_id, {
                              date: r.date,
                              location_name: r.location_name ?? null,
                              court_name: r.court_name ?? null,
                              coach_name: null,
                            })
                          }
                        >
                          <td className="px-3 py-2 align-top">
                            {new Date(r.date).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 align-top">{r.location_name ?? '-'}</td>
                          <td className="px-3 py-2 align-top">{r.court_name ?? '-'}</td>
                          <td className="px-3 py-2 align-top text-right">{r.present_count}</td>
                          <td className="px-3 py-2 align-top text-right">{r.absent_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Asistencia / Uso de clases por sede / cancha */}
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowAttendanceLocation((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-500" />
            Asistencia / Uso de clases por sede / cancha
          </span>
          <span className="text-xs text-gray-500">{showAttendanceLocation ? '▼' : '▲'}</span>
        </button>
        <AnimatePresence initial={false}>
          {showAttendanceLocation && (
            <motion.div
              key="attendance-location-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="p-4 space-y-4 origin-top"
            >
              <form onSubmit={loadAttendanceByLocation} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm mb-1">Sede</label>
                  <SearchableSelect
                    value={locationId}
                    onValueChange={(val) => {
                      setLocationId(val);
                      setCourtId("");
                    }}
                    options={locationOptions}
                    placeholder="Selecciona una sede"
                    disabled={locationOptions.length === 0}
                    contentClassName="w-64"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Cancha (opcional)</label>
                  <SearchableSelect
                    value={courtId}
                    onValueChange={(val) => setCourtId(val)}
                    options={courtOptions
                      .filter((c) => !locationId || c.location_id === locationId)
                      .map((c) => ({ id: c.id, label: c.label }))}
                    placeholder="Todas las canchas"
                    disabled={!locationId || courtOptions.length === 0}
                    contentClassName="w-64"
                  />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Desde</label>
                  <DatePickerField value={locationFrom} onChange={setLocationFrom} />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Hasta</label>
                  <DatePickerField value={locationTo} onChange={setLocationTo} />
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <div className="relative">
                  {locationRows.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
                        onClick={() =>
                          setExportMenu((m) => ({
                            income: false,
                            expenses: false,
                            attendanceStudent: false,
                            attendanceCoach: false,
                            attendanceLocation: !m.attendanceLocation,
                          }))
                        }
                      >
                        Exportar
                      </button>
                      {exportMenu.attendanceLocation && (
                        <div className="absolute left-0 mt-1 w-40 border rounded bg-white shadow text-[11px] z-10">
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToExcel(
                                buildReportFileName("Asistencia por sede-cancha", locationFrom, locationTo, "xlsx"),
                                "Asistencia por sede/cancha",
                                locationRows.map((r) => ({
                                  Fecha: new Date(r.date).toLocaleString(),
                                  Sede: r.location_name ?? "-",
                                  Cancha: r.court_name ?? "-",
                                  Profesor: r.coach_name ?? "-",
                                  Presentes: r.present_count,
                                  Ausentes: r.absent_count,
                                })),
                                locationFrom,
                                locationTo,
                              );
                              setExportMenu((m) => ({ ...m, attendanceLocation: false }));
                            }}
                          >
                            Excel (.xlsx)
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToPdf(
                                buildReportFileName("Asistencia por sede-cancha", locationFrom, locationTo, "pdf"),
                                "Asistencia por sede/cancha",
                                ["Fecha", "Sede", "Cancha", "Profesor", "Presentes", "Ausentes"],
                                locationRows.map((r) => [
                                  new Date(r.date).toLocaleString(),
                                  r.location_name ?? "-",
                                  r.court_name ?? "-",
                                  r.coach_name ?? "-",
                                  String(r.present_count),
                                  String(r.absent_count),
                                ]),
                                locationFrom,
                                locationTo,
                              );
                              setExportMenu((m) => ({ ...m, attendanceLocation: false }));
                            }}
                          >
                            PDF (.pdf)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                    onClick={() => {
                      setLocationId("");
                      setCourtId("");
                      setLocationFrom("");
                      setLocationTo("");
                      setLocationRows([]);
                      setLocationSummary(null);
                      setError(null);
                    }}
                  >
                    <Eraser className="w-3 h-3" />
                    Limpiar
                  </button>
                  <button
                    type="submit"
                    className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50 text-sm"
                    disabled={locationLoading}
                  >
                    {locationLoading ? 'Cargando asistencia...' : 'Ver asistencia'}
                  </button>
                </div>
              </div>
            </form>

            {locationSummary && (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                  <div className="space-y-1">
                    <p className="text-gray-700">
                      <span className="font-semibold">Total clases en el periodo:</span>{' '}
                      {locationSummary.totalClasses}
                    </p>
                    <p className="text-green-700 text-sm">
                      <span className="font-semibold">Presentes (alumnos):</span>{' '}
                      {locationSummary.present}
                    </p>
                    <p className="text-red-700 text-sm">
                      <span className="font-semibold">Ausentes (alumnos):</span>{' '}
                      {locationSummary.absent}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Horas por clase:</span>{' '}
                      {CLASS_DURATION_MINUTES / 60} h
                    </p>
                    <p>
                      <span className="font-semibold">Horas totales usadas:</span>{' '}
                      {(locationSummary.totalClasses * (CLASS_DURATION_MINUTES / 60)).toFixed(1)} h
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Presentes", value: locationSummary.present },
                        { name: "Ausentes", value: locationSummary.absent },
                      ]}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickMargin={8} />
                      <YAxis tick={{ fontSize: 10 }} tickMargin={6} allowDecimals={false} />
                      <Tooltip
                        formatter={(value: any) => [String(value), "Cantidad"]}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[
                          locationSummary.present,
                          locationSummary.absent,
                        ].map((_, idx) => (
                          <Cell
                            // eslint-disable-next-line react/no-array-index-key
                            key={idx}
                            fill={idx === 0 ? "#16a34a" : "#dc2626"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {locationRows.length > 0 && (
              <>
                {/* Mobile: tarjetas */}
                <div className="mt-2 space-y-2 md:hidden">
                  {locationRows.map((r) => (
                    <button
                      key={r.class_id + r.date}
                      type="button"
                      className="border rounded-lg px-3 py-2 text-xs bg-white flex flex-col gap-1 text-left w-full"
                      onClick={() =>
                        loadLocationClassDetail(r.class_id, {
                          date: r.date,
                          location_name: r.location_name,
                          court_name: r.court_name,
                          coach_name: r.coach_name,
                        })
                      }
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[#31435d]">
                          {new Date(r.date).toLocaleString()}
                        </span>
                        <span className="text-gray-600 text-[11px]">
                          {r.location_name ?? '-'} / {r.court_name ?? '-'}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Profesor:</span>{' '}
                        {r.coach_name ?? '-'}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Presentes:</span>{' '}
                        {r.present_count}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Ausentes:</span>{' '}
                        {r.absent_count}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="overflow-x-auto mt-2 hidden md:block">
                  <table className="min-w-full text-xs md:text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 border-b">Fecha</th>
                        <th className="px-3 py-2 border-b">Sede</th>
                        <th className="px-3 py-2 border-b">Cancha</th>
                        <th className="px-3 py-2 border-b">Profesor</th>
                        <th className="px-3 py-2 border-b text-right">Presentes</th>
                        <th className="px-3 py-2 border-b text-right">Ausentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locationRows.map((r) => (
                        <tr
                          key={r.class_id + r.date}
                          className="border-b last:border-b-0 cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            loadLocationClassDetail(r.class_id, {
                              date: r.date,
                              location_name: r.location_name,
                              court_name: r.court_name,
                              coach_name: r.coach_name,
                            })
                          }
                        >
                          <td className="px-3 py-2 align-top">
                            {new Date(r.date).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 align-top">{r.location_name ?? '-'}</td>
                          <td className="px-3 py-2 align-top">{r.court_name ?? '-'}</td>
                          <td className="px-3 py-2 align-top">{r.coach_name ?? '-'}</td>
                          <td className="px-3 py-2 align-top text-right">{r.present_count}</td>
                          <td className="px-3 py-2 align-top text-right">{r.absent_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal: detalle por alumno */}
      <Dialog open={studentDetailModalOpen} onOpenChange={setStudentDetailModalOpen}
      >
        <DialogContent
          className="w-full max-w-md sm:max-w-lg max-h-[90vh] p-0 flex flex-col rounded-xl border border-gray-200 shadow-xl bg-slate-50/95 backdrop-blur data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogHeader className="px-4 pt-4 pb-2 border-b bg-white/70 backdrop-blur-sm rounded-t-xl">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-500" />
              <DialogTitle className="text-lg font-semibold text-[#31435d]">
                Pagos del alumno
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Detalle de pagos del alumno en el periodo seleccionado
            </DialogDescription>
          </DialogHeader>
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
                        {formatPyg(r.amount)} {r.currency}
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
          <DialogFooter className="flex justify-end gap-2 px-4 py-3 border-t bg-white text-xs">
            {studentDetailRows.length > 0 && (
              <div className="mr-auto text-[11px] text-gray-600">
                <span className="font-semibold">Total en este periodo:</span>{' '}
                {formatPyg(studentDetailRows.reduce((acc, r) => acc + (r.amount || 0), 0))} PYG
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStudentDetailModalOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: detalle por plan */}
      <Dialog open={planDetailModalOpen} onOpenChange={setPlanDetailModalOpen}
      >
        <DialogContent
          className="w-full max-w-md sm:max-w-lg max-h-[90vh] p-0 flex flex-col rounded-xl border border-gray-200 shadow-xl bg-slate-50/95 backdrop-blur data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogHeader className="px-4 pt-4 pb-2 border-b bg-white/70 backdrop-blur-sm rounded-t-xl">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-500" />
              <DialogTitle className="text-lg font-semibold text-[#31435d]">
                Pagos del plan
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Detalle de pagos del plan en el periodo seleccionado
            </DialogDescription>
          </DialogHeader>
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
                        {formatPyg(r.amount)} {r.currency}
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
          <DialogFooter className="flex justify-end gap-2 px-4 py-3 border-t bg-white text-xs">
            {planDetailRows.length > 0 && (
              <div className="mr-auto text-[11px] text-gray-600">
                <span className="font-semibold">Total en este periodo:</span>{' '}
                {formatPyg(planDetailRows.reduce((acc, r) => acc + (r.amount || 0), 0))} PYG
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPlanDetailModalOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: detalle de asistencia por clase (sede / cancha) */}
      <Dialog open={locationDetailOpen && !!locationDetailInfo} onOpenChange={setLocationDetailOpen}
      >
        <DialogContent
          className="w-full max-w-md sm:max-w-lg max-h-[90vh] p-0 flex flex-col rounded-xl border border-gray-200 shadow-xl bg-slate-50/95 backdrop-blur data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogHeader className="px-4 pt-4 pb-2 border-b bg-white/70 backdrop-blur-sm rounded-t-xl">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <DialogTitle className="text-lg font-semibold text-[#31435d]">
                Asistencia de la clase
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Detalle de asistencia por alumno para la clase seleccionada
            </DialogDescription>
          </DialogHeader>
          {locationDetailInfo && (
            <div className="px-4 pt-2 pb-3 text-sm text-[#31435d] border-b space-y-1">
              <p>
                <span className="font-semibold">Fecha:</span>{' '}
                {new Date(locationDetailInfo.date).toLocaleString()}
              </p>
              <p>
                <span className="font-semibold">Sede:</span>{' '}
                {locationDetailInfo.location_name ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Cancha:</span>{' '}
                {locationDetailInfo.court_name ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Profesor:</span>{' '}
                {locationDetailInfo.coach_name ?? '-'}
              </p>
            </div>
          )}
          <div className="px-4 py-3 overflow-y-auto text-sm space-y-4">
            {locationDetailRows.length === 0 ? (
              <p className="text-xs text-gray-600">No hay registros de asistencia para esta clase.</p>
            ) : (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-[#31435d] mb-1">Presentes</h3>
                  <ul className="text-xs space-y-1">
                    {locationDetailRows
                      .filter((r) => r.present)
                      .map((r) => (
                        <li key={r.student_id} className="flex justify-between gap-2">
                          <span>{r.student_name ?? r.student_id}</span>
                          <span className="text-green-700 font-semibold text-[11px]">Presente</span>
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#31435d] mb-1">Ausentes</h3>
                  <ul className="text-xs space-y-1">
                    {locationDetailRows
                      .filter((r) => !r.present)
                      .map((r) => (
                        <li key={r.student_id} className="flex justify-between gap-2">
                          <span>{r.student_name ?? r.student_id}</span>
                          <span className="text-red-700 font-semibold text-[11px]">Ausente</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex justify-end gap-2 px-4 py-3 border-t bg-white text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLocationDetailOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
