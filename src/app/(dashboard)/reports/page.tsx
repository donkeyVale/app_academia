"use client";

import { useEffect, useState } from "react";
import { createClientBrowser } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface CoachClassRow {
  class_id: string;
  date: string;
  court_name: string | null;
  location_name: string | null;
  present_count: number;
  absent_count: number;
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

export default function ReportsPage() {
  const supabase = createClientBrowser();
  const CLASS_DURATION_MINUTES = 60;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentReportRow[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [studentSummary, setStudentSummary] = useState<StudentSummaryRow[]>([]);
  const [planSummary, setPlanSummary] = useState<PlanSummaryRow[]>([]);
  const [showIncome, setShowIncome] = useState(true);
  const [showStudentSummary, setShowStudentSummary] = useState(true);
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
    attendanceStudent: boolean;
    attendanceCoach: boolean;
    attendanceLocation: boolean;
  }>({ income: false, attendanceStudent: false, attendanceCoach: false, attendanceLocation: false });

  const formatPyg = (value: number) =>
    new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(value || 0);

  const exportToExcel = async (
    fileName: string,
    sheetName: string,
    rows: any[]
  ) => {
    if (!rows || rows.length === 0) return;
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportación a Excel lista");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo exportar a Excel");
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
    rows: any[][]
  ) => {
    if (!rows || rows.length === 0) return;
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default as any;

      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(title, 14, 16);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 22,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [49, 67, 93] },
      });

      doc.save(fileName);
      toast.success("Exportación a PDF lista");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo exportar a PDF");
    }
  };

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

  // Cargar alumnos y catálogos para reportes de asistencia
  useEffect(() => {
    (async () => {
      try {
        const { data: studs, error: sErr } = await supabase
          .from("students")
          .select("id,user_id,level,notes");
        if (sErr) throw sErr;
        const studentsRaw = (studs ?? []) as { id: string; user_id: string | null; level: string | null; notes: string | null }[];
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
        const coachesRaw = (coachesData ?? []) as { id: string; user_id: string | null }[];
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
  }, [supabase]);

  // Cargar sedes y canchas para reporte por sede/cancha
  useEffect(() => {
    (async () => {
      try {
        const { data: locData, error: locErr } = await supabase
          .from("locations")
          .select("id,name");
        if (locErr) throw locErr;

        const locOptions: LocationOption[] = (locData ?? []).map((l: any) => ({
          id: l.id as string,
          label: ((l.name as string | null) ?? l.id) as string,
        }));
        locOptions.sort((a, b) => a.label.localeCompare(b.label));
        setLocationOptions(locOptions);

        const { data: courtsData, error: ctErr } = await supabase
          .from("courts")
          .select("id,name,location_id");
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
  }, [supabase]);

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

      const rowsRaw = (attData ?? []) as any[];
      if (rowsRaw.length === 0) {
        setAttendanceRows([]);
        setAttendanceSummary({ total: 0, present: 0, absent: 0 });
        return;
      }

      const coachIds = Array.from(
        new Set(rowsRaw.map((r) => r.class_sessions?.coach_id).filter((id: string | null): id is string => !!id))
      );
      const courtIds = Array.from(
        new Set(rowsRaw.map((r) => r.class_sessions?.court_id).filter((id: string | null): id is string => !!id))
      );

      let coachMap: Record<string, string | null> = {};
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

      const classes = (clsData ?? []) as { id: string; date: string; court_id: string | null }[];
      if (classes.length === 0) {
        setCoachRows([]);
        setCoachSummary({ totalClasses: 0, present: 0, absent: 0 });
        return;
      }

      const classIds = classes.map((c) => c.id);
      const { data: attData, error: attErr } = await supabase
        .from("attendance")
        .select("class_id,present")
        .in("class_id", classIds);
      if (attErr) throw attErr;

      const attendance = (attData ?? []) as { class_id: string; present: boolean | null }[];

      const courtIds = Array.from(
        new Set(classes.map((c) => c.court_id).filter((id): id is string => !!id))
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
      let coachMap: Record<string, string | null> = {};
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

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#31435d]">Reportes</h1>
        <p className="text-sm text-gray-600">Consulta ingresos y uso de clases.</p>
      </div>

      {/* Ingresos */}
      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowIncome((v) => !v)}
        >
          <span>Ingresos</span>
          <span className="text-xs text-gray-500">{showIncome ? '▼' : '▲'}</span>
        </button>
        {showIncome && (
          <div className="p-4 space-y-4">
            {/* Filtro de ingresos por fecha */}
            <form onSubmit={loadReport} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="min-w-0 flex flex-col items-start w-full max-w-xs">
                  <label className="block text-sm mb-1">Desde</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Hasta</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2 justify-end md:justify-start flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
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
                        className="inline-flex items-center px-3 py-1 border rounded bg-white hover:bg-gray-50 text-[11px] text-gray-700"
                        onClick={() =>
                          setExportMenu((m) => ({
                            income: !m.income,
                            attendanceStudent: false,
                            attendanceCoach: false,
                            attendanceLocation: false,
                          }))
                        }
                      >
                        Exportar
                      </button>
                      {exportMenu.income && (
                        <div className="absolute right-0 mt-1 w-40 border rounded bg-white shadow text-[11px] z-10">
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToExcel(
                                `ingresos-${fromDate || ""}-${toDate || ""}.xlsx`,
                                "Ingresos",
                                rows.map((r) => ({
                                  Fecha: new Date(r.payment_date).toLocaleDateString(),
                                  Alumno: r.student_name ?? r.student_id,
                                  Plan: r.plan_name ?? "-",
                                  Metodo: r.method,
                                  Monto: r.amount,
                                  Moneda: r.currency,
                                }))
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
                                `ingresos-${fromDate || ""}-${toDate || ""}.pdf`,
                                "Ingresos",
                                ["Fecha", "Alumno", "Plan", "Metodo", "Monto", "Moneda"],
                                rows.map((r) => [
                                  new Date(r.payment_date).toLocaleDateString(),
                                  r.student_name ?? r.student_id,
                                  r.plan_name ?? "-",
                                  r.method,
                                  String(r.amount),
                                  r.currency,
                                ])
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
          </div>
        )}
      </div>

      {/* Resumen por alumno */}
      {studentSummary.length > 0 && (
        <div className="border rounded-lg bg-white shadow_sm">
          <button
            type="button"
            className="w-full flex items-center justify_between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
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
        <div className="border rounded-lg bg-white shadow_sm">
          <button
            type="button"
            className="w_full flex items-center justify_between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
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
      
      {/* Asistencia / Uso de clases por alumno */}
      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowAttendanceStudent((v) => !v)}
        >
          <span>Asistencia / Uso de clases por alumno</span>
          <span className="text-xs text-gray-500">
            {showAttendanceStudent ? "▼" : "▲"}
          </span>
        </button>
        {showAttendanceStudent && (
          <div className="p-4 space-y-4">
            <form onSubmit={loadAttendanceByStudent} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Alumno</label>
                  <select
                    className="border rounded p-2 w-full text-base md:text-sm"
                    value={attendanceStudentId}
                    onChange={(e) => setAttendanceStudentId(e.target.value)}
                  >
                    <option value="">Selecciona un alumno</option>
                    {attendanceStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Desde</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={attendanceFrom}
                    onChange={(e) => setAttendanceFrom(e.target.value)}
                  />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Hasta</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={attendanceTo}
                    onChange={(e) => setAttendanceTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <div className="relative">
                  {attendanceRows.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
                        onClick={() =>
                          setExportMenu((m) => ({
                            income: false,
                            attendanceStudent: !m.attendanceStudent,
                            attendanceCoach: false,
                            attendanceLocation: false,
                          }))
                        }
                      >
                        Exportar
                      </button>
                      {exportMenu.attendanceStudent && (
                        <div className="absolute left-0 mt-1 w-40 border rounded bg-white shadow text-[11px] z-10">
                          <button
                            type="button"
                            className="w-full px-3 py-1 text-left hover:bg-gray-50"
                            onClick={() => {
                              exportToExcel(
                                "asistencia-por-alumno.xlsx",
                                "Asistencia alumno",
                                attendanceRows.map((r) => ({
                                  Fecha: new Date(r.date).toLocaleString(),
                                  Sede: r.location_name ?? "-",
                                  Cancha: r.court_name ?? "-",
                                  Profesor: r.coach_name ?? "-",
                                  Estado: r.present ? "Presente" : "Ausente",
                                }))
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
                                "asistencia-por-alumno.pdf",
                                "Asistencia por alumno",
                                ["Fecha", "Sede", "Cancha", "Profesor", "Estado"],
                                attendanceRows.map((r) => [
                                  new Date(r.date).toLocaleString(),
                                  r.location_name ?? "-",
                                  r.court_name ?? "-",
                                  r.coach_name ?? "-",
                                  r.present ? "Presente" : "Ausente",
                                ])
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
                  className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
                  onClick={() => {
                    setAttendanceFrom("");
                    setAttendanceTo("");
                    setAttendanceRows([]);
                    setAttendanceSummary(null);
                    setError(null);
                  }}
                >
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
          </div>
        )}
      </div>

      {/* Asistencia / Uso de clases por profesor */}
      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowAttendanceCoach((v) => !v)}
        >
          <span>Asistencia / Uso de clases por profesor</span>
          <span className="text-xs text-gray-500">{showAttendanceCoach ? '▼' : '▲'}</span>
        </button>
        {showAttendanceCoach && (
          <div className="p-4 space-y-4">
            <form onSubmit={loadAttendanceByCoach} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Profesor</label>
                  <select
                    className="border rounded p-2 w-full text-base md:text-sm"
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                  >
                    <option value="">Selecciona un profesor</option>
                    {coachOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Desde</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={coachFrom}
                    onChange={(e) => setCoachFrom(e.target.value)}
                  />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Hasta</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={coachTo}
                    onChange={(e) => setCoachTo(e.target.value)}
                  />
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
                                "asistencia-por-profesor.xlsx",
                                "Asistencia profesor",
                                coachRows.map((r) => ({
                                  Fecha: new Date(r.date).toLocaleString(),
                                  Sede: r.location_name ?? "-",
                                  Cancha: r.court_name ?? "-",
                                  Presentes: r.present_count,
                                  Ausentes: r.absent_count,
                                }))
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
                                "asistencia-por-profesor.pdf",
                                "Asistencia por profesor",
                                ["Fecha", "Sede", "Cancha", "Presentes", "Ausentes"],
                                coachRows.map((r) => [
                                  new Date(r.date).toLocaleString(),
                                  r.location_name ?? "-",
                                  r.court_name ?? "-",
                                  String(r.present_count),
                                  String(r.absent_count),
                                ])
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
                  className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
                  onClick={() => {
                    setCoachFrom("");
                    setCoachTo("");
                    setCoachRows([]);
                    setCoachSummary(null);
                  }}
                >
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
          </div>
        )}
      </div>

      {/* Asistencia / Uso de clases por sede / cancha */}
      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowAttendanceLocation((v) => !v)}
        >
          <span>Asistencia / Uso de clases por sede / cancha</span>
          <span className="text-xs text-gray-500">{showAttendanceLocation ? '▼' : '▲'}</span>
        </button>
        {showAttendanceLocation && (
          <div className="p-4 space-y-4">
            <form onSubmit={loadAttendanceByLocation} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm mb-1">Sede</label>
                  <select
                    className="border rounded p-2 w-full text-base md:text-sm"
                    value={locationId}
                    onChange={(e) => {
                      setLocationId(e.target.value);
                      setCourtId("");
                    }}
                  >
                    <option value="">Selecciona una sede</option>
                    {locationOptions.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Cancha (opcional)</label>
                  <select
                    className="border rounded p-2 w-full text-base md:text-sm"
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                    disabled={!locationId}
                  >
                    <option value="">Todas las canchas</option>
                    {courtOptions
                      .filter((c) => !locationId || c.location_id === locationId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Desde</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={locationFrom}
                    onChange={(e) => setLocationFrom(e.target.value)}
                  />
                </div>
                <div className="min-w-0 flex flex-col items-start">
                  <label className="block text-sm mb-1">Hasta</label>
                  <Input
                    type="date"
                    className="w-full md:w-40 text-sm"
                    value={locationTo}
                    onChange={(e) => setLocationTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="border rounded px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
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
            </form>

            {locationSummary && (
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
          </div>
        )}
      </div>

      {/* Modal: detalle por alumno */}
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
              {studentDetailRows.length > 0 && (
                <div className="mr-auto text-[11px] text-gray-600">
                  <span className="font-semibold">Total en este periodo:</span>{' '}
                  {studentDetailRows.reduce((acc, r) => acc + (r.amount || 0), 0)} PYG
                </div>
              )}
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

      {/* Modal: detalle por plan */}
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
              {planDetailRows.length > 0 && (
                <div className="mr-auto text-[11px] text-gray-600">
                  <span className="font-semibold">Total en este periodo:</span>{' '}
                  {planDetailRows.reduce((acc, r) => acc + (r.amount || 0), 0)} PYG
                </div>
              )}
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

      {/* Modal: detalle de asistencia por clase (sede / cancha) */}
      {locationDetailOpen && locationDetailInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <h2 className="text-lg font-semibold text-[#31435d]">Asistencia de la clase</h2>
            </div>
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
            <div className="flex justify-end gap-2 px-4 py-3 border-t bg-white text-xs">
              <button
                type="button"
                className="px-3 py-2 border rounded"
                onClick={() => setLocationDetailOpen(false)}
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
