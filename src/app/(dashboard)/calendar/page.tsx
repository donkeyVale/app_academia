"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { Calendar as CalendarIcon } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AgendoLogo } from "@/components/agendo-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = {
  id: string;
  name: string;
};

type Location = { id: string; name: string | null };

type Court = { id: string; name: string; location_id: string | null };

type Coach = { id: string; user_id: string | null; full_name?: string | null };

type Student = { id: string; user_id: string | null; full_name?: string | null; notes?: string | null; level?: string | null };

type ClassSession = {
  id: string;
  date: string;
  type: string;
  capacity: number;
  coach_id: string | null;
  court_id: string | null;
  status?: string | null;
  attendance_pending?: boolean | null;
};

type BookingRow = {
  id: string;
  class_id: string | null;
  student_id: string | null;
};

type CalendarManualEventRow = {
  id: string;
  academy_id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  location_id: string | null;
  court_id: string | null;
  coach_id: string | null;
};

type CalendarBlockRow = {
  id: string;
  academy_id: string;
  kind: string;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  location_id: string | null;
  court_id: string | null;
  coach_id: string | null;
};

function toIsoSafe(d: Date): string {
  const t = d.getTime();
  if (Number.isNaN(t)) return new Date(0).toISOString();
  return new Date(t).toISOString();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function shortenName(name: string, max = 18): string {
  const t = (name || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export default function CalendarPage() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [isMobile, setIsMobile] = useState(false);
  const calendarCardRef = useRef<HTMLDivElement | null>(null);
  const [mobileCalendarHeight, setMobileCalendarHeight] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"timeGridDay" | "timeGridWeek" | "dayGridMonth">(
    "timeGridDay"
  );
  const calendarRef = useRef<FullCalendar | null>(null);

  const mobileScrollTime = useMemo(() => {
    const h = new Date().getHours();
    const clamped = Math.min(22, Math.max(6, h - 1));
    return `${pad2(clamped)}:00:00`;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const calc = () => setIsMobile(window.innerWidth < 640);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobile) {
      setMobileCalendarHeight(null);
      return;
    }

    const recalc = () => {
      const card = calendarCardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const marginBottom = 16;
      const h = Math.floor(window.innerHeight - rect.top - marginBottom);
      setMobileCalendarHeight(h > 320 ? h : 320);
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("calendarMobileView");
    if (stored === "timeGridDay" || stored === "timeGridWeek" || stored === "dayGridMonth") {
      setMobileView(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("calendarMobileView", mobileView);
    const api = calendarRef.current?.getApi?.();
    if (api && isMobile) {
      api.changeView(mobileView);
    }
  }, [mobileView, isMobile]);

  const [role, setRole] = useState<AppRole>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [selectedAcademyReady, setSelectedAcademyReady] = useState(false);

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const canCreate = role === "admin" || role === "coach";
  const canToggleAvailability = role === "admin" || role === "coach" || role === "super_admin";

  const [locations, setLocations] = useState<Location[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [coachSelfId, setCoachSelfId] = useState<string | null>(null);

  // Create class modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createLocationId, setCreateLocationId] = useState<string>("");
  const [createCourtId, setCreateCourtId] = useState<string>("");
  const [createDay, setCreateDay] = useState<string>("");
  const [createTime, setCreateTime] = useState<string>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [createCoachId, setCreateCoachId] = useState<string>("");
  const [createSelectedStudents, setCreateSelectedStudents] = useState<string[]>([]);
  const [studentsPopoverOpen, setStudentsPopoverOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const [remainingByStudent, setRemainingByStudent] = useState<Record<string, number>>({});
  const [remainingLoading, setRemainingLoading] = useState(false);

  const [pastWarningOpen, setPastWarningOpen] = useState(false);
  const [pastWarningLabel, setPastWarningLabel] = useState<string>("");
  const [pastWarningAllowPast, setPastWarningAllowPast] = useState(false);

  const [tappedEventId, setTappedEventId] = useState<string | null>(null);

  const [availabilityMode, setAvailabilityMode] = useState(false);
  const [currentViewType, setCurrentViewType] = useState<string>("timeGridWeek");
  const [occupiedCourtsBySlot, setOccupiedCourtsBySlot] = useState<Record<string, string[]>>({});
  const [availabilityEvents, setAvailabilityEvents] = useState<any[]>([]);
  const [availabilityLegend, setAvailabilityLegend] = useState<string>("");

  const [availabilityPopupOpen, setAvailabilityPopupOpen] = useState(false);
  const [availabilityPopupX, setAvailabilityPopupX] = useState(0);
  const [availabilityPopupY, setAvailabilityPopupY] = useState(0);
  const [availabilityPopupDay, setAvailabilityPopupDay] = useState<string>("");
  const [availabilityPopupTime, setAvailabilityPopupTime] = useState<string>("");
  const availabilityPopupRef = useRef<HTMLDivElement | null>(null);

  const [dayTotalClasses, setDayTotalClasses] = useState<Record<string, number>>({});

  const visibleRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<any | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDay, setRescheduleDay] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduling, setRescheduling] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editCourtId, setEditCourtId] = useState<string>("");
  const [editDay, setEditDay] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");
  const [editAvailableTimes, setEditAvailableTimes] = useState<string[]>([]);
  const [editCoachId, setEditCoachId] = useState<string>("");
  const [editSelectedStudents, setEditSelectedStudents] = useState<string[]>([]);
  const [editExistingStudents, setEditExistingStudents] = useState<string[]>([]);
  const [editStudentQuery, setEditStudentQuery] = useState<string>("");
  const [editStudentsPopoverOpen, setEditStudentsPopoverOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceList, setAttendanceList] = useState<{ student_id: string; present: boolean; label: string }[]>([]);

  const allCourtIds = useMemo(() => {
    return Array.from(new Set((courts ?? []).map((c) => c.id).filter(Boolean)));
  }, [courts]);

  const getSlotKey = (day: string, time: string) => {
    const hh = (time || "").split(":")[0] ?? "";
    return `${day}:${hh}`;
  };

  const getFreeCourtIdsForSlot = (day: string, time: string) => {
    const key = getSlotKey(day, time);
    const occupied = new Set((occupiedCourtsBySlot[key] ?? []).filter(Boolean));
    return allCourtIds.filter((id) => !occupied.has(id));
  };

  const openAvailabilityPopup = (params: { day: string; time: string; x: number; y: number }) => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 0;
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    const width = 280;
    const height = 220;
    const x = Math.max(8, Math.min(params.x, Math.max(8, vw - width - 8)));
    const y = Math.max(8, Math.min(params.y, Math.max(8, vh - height - 8)));

    setAvailabilityPopupDay(params.day);
    setAvailabilityPopupTime(params.time);
    setAvailabilityPopupX(x);
    setAvailabilityPopupY(y);
    setAvailabilityPopupOpen(true);
  };

  const closeAvailabilityPopup = () => {
    setAvailabilityPopupOpen(false);
  };

  useEffect(() => {
    if (!availabilityPopupOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAvailabilityPopup();
    };

    const onMouseDown = (e: MouseEvent) => {
      const el = availabilityPopupRef.current;
      if (!el) return;
      if (el.contains(e.target as any)) return;
      closeAvailabilityPopup();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [availabilityPopupOpen]);

  useEffect(() => {
    const vr = visibleRangeRef.current;
    if (!vr) return;
    if (!selectedAcademyId) {
      setEvents([]);
      return;
    }
    void loadCalendarRange(vr.start, vr.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAcademyId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = (data?.user?.id as string | undefined) ?? null;
        setUserId(uid);
        if (!uid) {
          setRole(null);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        const r = (profile?.role as AppRole) ?? null;
        setRole(r);

        if (r === "coach") {
          const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", uid)
            .maybeSingle();
          setCoachSelfId((coachRow as any)?.id ?? null);
        } else {
          setCoachSelfId(null);
        }
      } catch {
        setUserId(null);
        setRole(null);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!selectedAcademyReady) return;
    if (!selectedAcademyId) {
      setLocations([]);
      setCourts([]);
      setCoaches([]);
      setStudents([]);
      return;
    }

    (async () => {
      try {
        const { data: alRows, error: alErr } = await supabase
          .from("academy_locations")
          .select("location_id")
          .eq("academy_id", selectedAcademyId);
        if (alErr) throw alErr;
        const locationIds = Array.from(
          new Set(
            ((alRows as any[]) ?? [])
              .map((r) => (r?.location_id as string | null) ?? null)
              .filter((x): x is string => !!x)
          )
        );

        const [{ data: locRows, error: locErr }, { data: courtRows, error: courtErr }] = await Promise.all([
          supabase.from("locations").select("id,name").in("id", locationIds).order("name"),
          supabase.from("courts").select("id,name,location_id").in("location_id", locationIds).order("name"),
        ]);
        if (locErr) throw locErr;
        if (courtErr) throw courtErr;

        setLocations(((locRows as Location[] | null) ?? []).map((l) => ({ id: l.id, name: l.name })));
        setCourts(((courtRows as any[] | null) ?? []).map((c) => ({ id: c.id, name: c.name, location_id: c.location_id })));

        // Coaches assigned to academy
        const { data: uaRows, error: uaErr } = await supabase
          .from("user_academies")
          .select("user_id, role")
          .eq("academy_id", selectedAcademyId);
        if (uaErr) throw uaErr;
        const rows = ((uaRows as any[]) ?? []) as { user_id: string | null; role: string }[];
        const coachUserIds = Array.from(new Set(rows.filter((r) => r.role === "coach" && r.user_id).map((r) => r.user_id!)));
        const studentUserIds = Array.from(
          new Set(rows.filter((r) => r.role === "student" && r.user_id).map((r) => r.user_id!))
        );

        const [{ data: coachRows }, { data: profRows }, { data: studRows }, { data: studProfiles }] = await Promise.all([
          coachUserIds.length
            ? supabase.from("coaches").select("id,user_id").in("user_id", coachUserIds)
            : supabase.from("coaches").select("id,user_id").limit(0),
          coachUserIds.length
            ? supabase.from("profiles").select("id,full_name").in("id", coachUserIds)
            : supabase.from("profiles").select("id,full_name").limit(0),
          studentUserIds.length
            ? supabase.from("students").select("id,user_id,level,notes").in("user_id", studentUserIds)
            : supabase.from("students").select("id,user_id,level,notes").limit(0),
          studentUserIds.length
            ? supabase.from("profiles").select("id,full_name").in("id", studentUserIds)
            : supabase.from("profiles").select("id,full_name").limit(0),
        ]);

        const coachNameByUserId = ((profRows as any[]) ?? []).reduce<Record<string, string | null>>((acc, p: any) => {
          acc[p.id] = (p.full_name as string | null) ?? null;
          return acc;
        }, {});
        const finalCoaches = (((coachRows as any[]) ?? []) as { id: string; user_id: string | null }[]).map((c) => ({
          id: c.id,
          user_id: c.user_id,
          full_name: c.user_id ? coachNameByUserId[c.user_id] ?? null : null,
        }));
        setCoaches(finalCoaches);

        const studentNameByUserId = ((studProfiles as any[]) ?? []).reduce<Record<string, string | null>>((acc, p: any) => {
          acc[p.id] = (p.full_name as string | null) ?? null;
          return acc;
        }, {});
        const finalStudents = (((studRows as any[]) ?? []) as any[]).map((s) => ({
          id: s.id,
          user_id: s.user_id,
          level: s.level ?? null,
          notes: s.notes ?? null,
          full_name: s.user_id ? studentNameByUserId[s.user_id] ?? null : null,
        }));
        setStudents(finalStudents);
      } catch (e: any) {
        setLocations([]);
        setCourts([]);
        setCoaches([]);
        setStudents([]);
        toast.error(e?.message ?? "No se pudieron cargar datos de la academia.");
      }
    })();
  }, [selectedAcademyId, selectedAcademyReady, supabase]);

  useEffect(() => {
    if (!createCourtId || !createDay) {
      setAvailableTimes([]);
      setCreateTime("");
      return;
    }
    (async () => {
      // Candidate hours 06:00 - 23:00
      const candidates: string[] = [];
      for (let h = 6; h <= 23; h++) candidates.push(`${pad2(h)}:00`);
      try {
        const dayStart = new Date(`${createDay}T00:00:00`).toISOString();
        const dayEnd = new Date(`${createDay}T23:59:59`).toISOString();
        const { data: dayClasses, error } = await supabase
          .from("class_sessions")
          .select("id,date")
          .eq("court_id", createCourtId)
          .gte("date", dayStart)
          .lte("date", dayEnd)
          .neq("status", "cancelled");
        if (error) throw error;
        const occupied = new Set<string>();
        (dayClasses ?? []).forEach((c: any) => {
          const d = new Date(c.date);
          occupied.add(`${pad2(d.getHours())}:00`);
        });
        const free = candidates.filter((t) => !occupied.has(t));
        setAvailableTimes(free);
        if (!free.includes(createTime)) setCreateTime(free[0] ?? "");
      } catch {
        setAvailableTimes(candidates);
        if (!candidates.includes(createTime)) setCreateTime(candidates[0] ?? "");
      }
    })();
  }, [supabase, createCourtId, createDay]);

  useEffect(() => {
    (async () => {
      const shouldLoad = (studentsPopoverOpen || editStudentsPopoverOpen) && !!selectedAcademyId;
      if (!shouldLoad) return;
      if (remainingLoading) return;
      setRemainingLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_students_remaining_classes", {
          p_academy_id: selectedAcademyId,
        });
        if (error) throw error;
        const rows = (data ?? []) as any[];
        const map: Record<string, number> = {};
        for (const row of rows) {
          const sid = row?.student_id as string | undefined;
          const remaining = Number(row?.remaining ?? 0);
          if (sid) map[sid] = Number.isFinite(remaining) ? remaining : 0;
        }
        // Si el RPC no devuelve un alumno, lo tratamos como 0 para mostrarlo en rojo (sin saldo)
        for (const s of students) {
          if (map[s.id] === undefined) map[s.id] = 0;
        }
        setRemainingByStudent(map);
      } catch (e) {
        console.error("Error cargando clases restantes por alumno", e);
      } finally {
        setRemainingLoading(false);
      }
    })();
  }, [studentsPopoverOpen, editStudentsPopoverOpen, selectedAcademyId, supabase, remainingLoading, students]);

  useEffect(() => {
    if (!createOpen) return;
    if (role !== "coach") return;
    if (!coachSelfId) return;
    setCreateCoachId(coachSelfId);
  }, [createOpen, role, coachSelfId]);

  const resetCreateForm = () => {
    setCreateLocationId("");
    setCreateCourtId("");
    setCreateDay("");
    setCreateTime("");
    setCreateCoachId("");
    setCreateSelectedStudents([]);
    setStudentQuery("");
    setStudentsPopoverOpen(false);
  };

  const resetEditForm = () => {
    setEditOpen(false);
    setEditingClass(null);
    setEditLocationId("");
    setEditCourtId("");
    setEditDay("");
    setEditTime("");
    setEditAvailableTimes([]);
    setEditCoachId("");
    setEditSelectedStudents([]);
    setEditExistingStudents([]);
    setEditStudentQuery("");
    setEditStudentsPopoverOpen(false);
  };

  const resetAttendance = () => {
    setAttendanceOpen(false);
    setAttendanceLoading(false);
    setAttendanceSaving(false);
    setAttendanceList([]);
  };

  const onConfirmCancel = async () => {
    const p = (detailsEvent?.props ?? {}) as any;
    if (p?.kind !== "class_session") return;
    const cls = p.classSession as ClassSession | undefined;
    if (!cls?.id) return;

    if (!role || role === "super_admin" || role === "student") return;
    if (role === "coach" && coachSelfId && cls.coach_id !== coachSelfId) {
      toast.error("No tenés permisos para cancelar esta clase.");
      return;
    }

    const startTs = new Date(cls.date).getTime();
    if (startTs <= Date.now()) {
      toast.error("No se puede cancelar una clase que ya comenzó.");
      return;
    }

    if (!confirm("¿Cancelar esta clase? Se devolverán las clases a los planes y se avisará a los alumnos.")) return;

    setCancelling(true);
    try {
      const { data: bRows, error: bErr } = await supabase
        .from("bookings")
        .select("student_id")
        .eq("class_id", cls.id);
      if (bErr) throw bErr;
      const studentIds = Array.from(
        new Set(
          ((bRows as { student_id: string | null }[] | null) ?? [])
            .map((r) => r.student_id)
            .filter((x): x is string => !!x)
        )
      );

      const { error: delUsageErr } = await supabase
        .from("plan_usages")
        .update({ status: "refunded", refunded_at: new Date().toISOString() })
        .eq("class_id", cls.id)
        .in("status", ["pending", "confirmed"]);
      if (delUsageErr) throw delUsageErr;

      const { error: delAttErr } = await supabase.from("attendance").delete().eq("class_id", cls.id);
      if (delAttErr) throw delAttErr;

      const { error: delBookErr } = await supabase.from("bookings").delete().eq("class_id", cls.id);
      if (delBookErr) throw delBookErr;

      const { error: delErr } = await supabase.from("class_sessions").update({ status: "cancelled" }).eq("id", cls.id);
      if (delErr) throw delErr;

      if (selectedAcademyId && userId && role) {
        try {
          await fetch("/api/push/class-cancelled", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId: cls.id,
              coachId: cls.coach_id,
              studentIds,
              dateIso: cls.date,
              academyId: selectedAcademyId,
              cancelledByRole: role,
              cancelledByCoachId: role === "coach" ? cls.coach_id : null,
              cancelledByUserId: userId,
            }),
          });
        } catch (pushErr) {
          console.error("Error enviando notificación de clase cancelada", pushErr);
        }
      }

      toast.success("Clase cancelada correctamente y clases devueltas a los planes.");
      setDetailsOpen(false);
      setRescheduleOpen(false);

      const vr = visibleRangeRef.current;
      if (vr) await loadCalendarRange(vr.start, vr.end);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cancelar la clase.");
    } finally {
      setCancelling(false);
    }
  };

  const openAttendance = async () => {
    const p = (detailsEvent?.props ?? {}) as any;
    if (p?.kind !== "class_session") return;
    const cls = p.classSession as ClassSession | undefined;
    if (!cls?.id) return;

    if (!role || role === "super_admin" || role === "student") return;
    if (role === "coach" && coachSelfId && cls.coach_id !== coachSelfId) {
      toast.error("No tenés permisos para marcar asistencia en esta clase.");
      return;
    }

    setAttendanceOpen(true);
    setAttendanceLoading(true);
    try {
      const [{ data: bRows, error: bErr }, { data: aRows, error: aErr }] = await Promise.all([
        supabase.from("bookings").select("student_id").eq("class_id", cls.id),
        supabase.from("attendance").select("student_id,present").eq("class_id", cls.id),
      ]);
      if (bErr) throw bErr;
      if (aErr) throw aErr;

      const bookingIds = Array.from(
        new Set(
          ((bRows as { student_id: string | null }[] | null) ?? [])
            .map((r) => r.student_id)
            .filter((x): x is string => !!x)
        )
      );
      const attMap = new Map<string, boolean>(((aRows as any[]) ?? []).map((r: any) => [r.student_id as string, !!r.present]));

      const list = bookingIds.map((sid) => {
        const s = students.find((x) => x.id === sid);
        const label = (s?.full_name || "") || (s?.notes || "") || (s?.level || "") || s?.id || sid;
        return {
          student_id: sid,
          present: attMap.get(sid) ?? false,
          label,
        };
      });
      setAttendanceList(list);
    } catch (e: any) {
      toast.error(e?.message ?? "Error cargando asistencia");
      setAttendanceList([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const onSaveAttendance = async () => {
    const p = (detailsEvent?.props ?? {}) as any;
    if (p?.kind !== "class_session") return;
    const cls = p.classSession as ClassSession | undefined;
    if (!cls?.id) return;

    if (!role || role === "super_admin" || role === "student") return;
    if (role === "coach" && coachSelfId && cls.coach_id !== coachSelfId) {
      toast.error("No tenés permisos para marcar asistencia en esta clase.");
      return;
    }
    if (!userId) {
      toast.error("No se pudo identificar el usuario actual.");
      return;
    }

    setAttendanceSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const studentIds = attendanceList.map((r) => r.student_id).filter(Boolean);

      // Limpiar asistencia de alumnos que ya no están en la clase
      if (studentIds.length > 0) {
        const { error: delOldErr } = await supabase
          .from("attendance")
          .delete()
          .eq("class_id", cls.id)
          .not("student_id", "in", `(${studentIds.join(",")})`);
        if (delOldErr) throw delOldErr;
      } else {
        const { error: delAllErr } = await supabase.from("attendance").delete().eq("class_id", cls.id);
        if (delAllErr) throw delAllErr;
      }

      if (attendanceList.length) {
        const rows = attendanceList.map((row) => ({
          class_id: cls.id,
          student_id: row.student_id,
          present: row.present,
          marked_at: nowIso,
          marked_by_user_id: userId,
        }));

        const { error: upsertErr } = await supabase.from("attendance").upsert(rows, { onConflict: "class_id,student_id" });
        if (upsertErr) throw upsertErr;

        // Confirmar consumo del plan (presente o ausente)
        if (studentIds.length) {
          const { error: confirmErr } = await supabase
            .from("plan_usages")
            .update({ status: "confirmed", confirmed_at: nowIso })
            .eq("class_id", cls.id)
            .in("student_id", studentIds)
            .eq("status", "pending");
          if (confirmErr) {
            console.error("Error confirmando plan_usages por asistencia", confirmErr.message);
          }
        }

        const { error: updPendingErr } = await supabase
          .from("class_sessions")
          .update({ attendance_pending: false })
          .eq("id", cls.id);
        if (updPendingErr) {
          console.error("Error limpiando attendance_pending", updPendingErr.message);
        }
      }

      toast.success("Asistencia guardada.");
      resetAttendance();

      const vr = visibleRangeRef.current;
      if (vr) await loadCalendarRange(vr.start, vr.end);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la asistencia.");
    } finally {
      setAttendanceSaving(false);
    }
  };

  useEffect(() => {
    if (!editOpen) return;
    if (!editCourtId || !editDay) {
      setEditAvailableTimes([]);
      setEditTime("");
      return;
    }
    (async () => {
      const candidates: string[] = [];
      for (let h = 6; h <= 23; h++) candidates.push(`${pad2(h)}:00`);
      try {
        const dayStart = new Date(`${editDay}T00:00:00`).toISOString();
        const dayEnd = new Date(`${editDay}T23:59:59`).toISOString();
        const { data: dayClasses, error } = await supabase
          .from("class_sessions")
          .select("id,date")
          .eq("court_id", editCourtId)
          .gte("date", dayStart)
          .lte("date", dayEnd)
          .neq("status", "cancelled");
        if (error) throw error;
        const occupied = new Set<string>();
        (dayClasses ?? []).forEach((c: any) => {
          if (editingClass?.id && c.id === editingClass.id) return;
          const d = new Date(c.date);
          occupied.add(`${pad2(d.getHours())}:00`);
        });
        const free = candidates.filter((t) => !occupied.has(t));
        setEditAvailableTimes(free);
        if (!free.includes(editTime)) setEditTime(free[0] ?? "");
      } catch {
        setEditAvailableTimes(candidates);
        if (!candidates.includes(editTime)) setEditTime(candidates[0] ?? "");
      }
    })();
  }, [supabase, editOpen, editCourtId, editDay, editTime, editingClass?.id]);

  const onStartEdit = async () => {
    const p = (detailsEvent?.props ?? {}) as any;
    if (p?.kind !== "class_session") return;
    const cls = p.classSession as ClassSession | undefined;
    if (!cls?.id) return;

    if (!role || role === "super_admin" || role === "student") return;
    if (role === "coach" && coachSelfId && cls.coach_id !== coachSelfId) {
      toast.error("No tenés permisos para modificar esta clase.");
      return;
    }

    setEditingClass(cls);
    setEditCourtId(cls.court_id ?? "");
    setEditCoachId(cls.coach_id ?? "");

    const startDt = cls.date ? new Date(cls.date) : null;
    if (startDt) {
      setEditDay(toYmd(startDt));
      setEditTime(`${pad2(startDt.getHours())}:00`);
    } else {
      setEditDay("");
      setEditTime("");
    }

    const court = cls.court_id ? courts.find((c) => c.id === cls.court_id) : null;
    setEditLocationId(court?.location_id ?? "");

    try {
      const { data: bRows, error: bErr } = await supabase
        .from("bookings")
        .select("student_id")
        .eq("class_id", cls.id);
      if (bErr) throw bErr;
      const sids = Array.from(
        new Set(
          ((bRows as { student_id: string | null }[] | null) ?? [])
            .map((r) => r.student_id)
            .filter((x): x is string => !!x)
        )
      );
      setEditExistingStudents(sids);
      setEditSelectedStudents(sids);
    } catch {
      setEditExistingStudents([]);
      setEditSelectedStudents([]);
    }

    setEditOpen(true);
    setRescheduleOpen(false);
  };

  const onSaveEdit = async () => {
    const cls = editingClass;
    if (!cls?.id) return;

    if (!role || role === "super_admin" || role === "student") return;
    if (role === "coach" && coachSelfId && cls.coach_id !== coachSelfId) {
      toast.error("No tenés permisos para modificar esta clase.");
      return;
    }

    if (!editCourtId || !editDay || !editTime) {
      toast.error("Completa complejo/cancha, fecha y hora.");
      return;
    }
    if (!editCoachId) {
      toast.error("Selecciona un profesor.");
      return;
    }
    if (editSelectedStudents.length < 1) {
      toast.error("Selecciona al menos 1 alumno (máximo 4).");
      return;
    }
    if (editSelectedStudents.length > 4) {
      toast.error("Máximo 4 alumnos por clase.");
      return;
    }

    const hour = Number(editTime.split(":")[0] ?? "NaN");
    if (Number.isNaN(hour) || hour < 6 || hour > 23) {
      toast.error("Horario inválido. Seleccioná una hora entre 06:00 y 23:00.");
      return;
    }

    const newIso = new Date(`${editDay}T${editTime}:00`).toISOString();
    {
      const now = new Date();
      const classStart = new Date(newIso);
      if (classStart.getTime() <= now.getTime()) {
        toast.error("No podés mover una clase a una fecha y hora que ya pasaron.");
        return;
      }
    }

    const addedStudents = editSelectedStudents.filter((id) => !editExistingStudents.includes(id));
    const removedStudents = editExistingStudents.filter((id) => !editSelectedStudents.includes(id));

    setSavingEdit(true);
    try {
      const oldDateIso = cls.date;
      const oldCourtId = cls.court_id;
      const oldCoachId = cls.coach_id;

      // Conflicto de cancha
      {
        const { data: clash, error: clashErr } = await supabase
          .from("class_sessions")
          .select("id")
          .eq("court_id", editCourtId)
          .eq("date", newIso)
          .neq("id", cls.id)
          .neq("status", "cancelled")
          .limit(1);
        if (clashErr) throw clashErr;
        if ((clash ?? []).length > 0) {
          toast.error("Ese horario ya está ocupado en esa cancha. Elegí otra hora.");
          return;
        }
      }

      // Conflicto de profesor (warning)
      if (editCoachId) {
        const { data: coachClash, error: coachClashErr } = await supabase
          .from("class_sessions")
          .select("id")
          .eq("coach_id", editCoachId)
          .eq("date", newIso)
          .neq("status", "cancelled")
          .neq("id", cls.id)
          .limit(1);
        if (coachClashErr) {
          toast.error("No se pudo verificar la disponibilidad del profesor. Intenta nuevamente.");
          return;
        }
        if ((coachClash ?? []).length > 0) {
          toast.warning("El profesor ya tiene una clase en ese horario.");
        }
      }

      // Conflicto alumnos
      {
        const { data: conflictsFiltered, error: conflictsStatusErr } = await supabase
          .from("bookings")
          .select("student_id, class_sessions!inner(id,date,status)")
          .in("student_id", editSelectedStudents)
          .eq("class_sessions.date", newIso)
          .neq("class_sessions.status", "cancelled");
        if (conflictsStatusErr) throw conflictsStatusErr;
        const realConflicts = (conflictsFiltered ?? []).filter((r: any) => (r as any)?.class_sessions?.id !== cls.id);
        if (realConflicts.length > 0) {
          toast.error("Uno o más alumnos ya tienen una clase en ese horario.");
          return;
        }
      }

      // Validación de planes solo para alumnos agregados
      const planForStudent: Record<string, string> = {};
      for (const sid of addedStudents) {
        const label = students.find((s) => s.id === sid)?.full_name ?? "(sin nombre)";

        const { data: plans, error: planErr } = await supabase
          .from("student_plans")
          .select("id, remaining_classes, purchased_at")
          .eq("student_id", sid)
          .order("purchased_at", { ascending: true });
        if (planErr) {
          console.error("Error verificando student_plans en Calendar (edit)", sid, label, (planErr as any)?.message);
          toast.error(`No se pudo verificar el plan de ${label}. Intenta nuevamente.`);
          return;
        }

        if (!plans || plans.length === 0) {
          toast.error(`${label} no tiene un plan activo con clases disponibles.`);
          return;
        }

        let chosenPlan: any = null;
        for (const p of plans as any[]) {
          const { count: usedCount, error: usageCountErr } = await supabase
            .from("plan_usages")
            .select("id", { count: "exact", head: true })
            .eq("student_plan_id", p.id)
            .eq("student_id", sid)
            .in("status", ["pending", "confirmed"]);
          if (usageCountErr) throw usageCountErr;
          const used = Number(usedCount ?? 0);
          const remaining = Number((p.remaining_classes as number) ?? 0);
          if (remaining - used > 0) {
            chosenPlan = p;
            break;
          }
        }
        if (!chosenPlan) {
          const label = students.find((s) => s.id === sid)?.full_name ?? "(sin nombre)";
          toast.error(`${label} no tiene saldo disponible en sus planes.`);
          return;
        }

        const totalFromPlan = Number((chosenPlan.remaining_classes as number) ?? 0);
        if (totalFromPlan > 0) {
          const nowIso = new Date().toISOString();
          const { data: futureBookings, error: futureErr } = await supabase
            .from("bookings")
            .select("id, class_sessions!inner(id,date)")
            .eq("student_id", sid)
            .gt("class_sessions.date", nowIso);
          if (futureErr) throw new Error("No se pudo verificar las clases futuras del alumno. Intenta nuevamente.");
          const futureCount = (futureBookings ?? []).length;
          if (futureCount >= totalFromPlan) {
            const label = students.find((s) => s.id === sid)?.full_name ?? "(sin nombre)";
            toast.error(`${label} ya tiene reservadas todas sus clases del plan.`);
            return;
          }
        }

        planForStudent[sid] = chosenPlan.id as string;
      }

      const capacity = editSelectedStudents.length;
      const typeForSession = capacity === 1 ? "individual" : "grupal";

      const { error: updErr } = await supabase
        .from("class_sessions")
        .update({
          date: newIso,
          court_id: editCourtId,
          coach_id: editCoachId,
          capacity,
          type: typeForSession,
        })
        .eq("id", cls.id);
      if (updErr) throw updErr;

      // Remover bookings y devolver usos
      if (removedStudents.length > 0) {
        const { error: delBookErr } = await supabase
          .from("bookings")
          .delete()
          .eq("class_id", cls.id)
          .in("student_id", removedStudents);
        if (delBookErr) throw delBookErr;

        const { data: stillBooked, error: stillBookedErr } = await supabase
          .from("bookings")
          .select("student_id")
          .eq("class_id", cls.id)
          .in("student_id", removedStudents);
        if (stillBookedErr) throw stillBookedErr;
        if ((stillBooked ?? []).length > 0) {
          throw new Error("No se pudieron eliminar algunas reservas de alumnos removidos. Intenta nuevamente.");
        }

        const { error: refundErr } = await supabase
          .from("plan_usages")
          .update({ status: "refunded", refunded_at: new Date().toISOString() })
          .eq("class_id", cls.id)
          .in("student_id", removedStudents)
          .in("status", ["pending", "confirmed"]);
        if (refundErr) throw refundErr;
      }

      // Agregar bookings
      if (addedStudents.length > 0) {
        const bookingRows = addedStudents.map((sid) => ({
          class_id: cls.id,
          student_id: sid,
          status: "reserved",
        }));
        const { error: insBookErr } = await supabase.from("bookings").insert(bookingRows);
        if (insBookErr) throw insBookErr;

        for (const sid of addedStudents) {
          const planId = planForStudent[sid];
          if (!planId) continue;
          const { error: usageUpsertErr } = await supabase.from("plan_usages").upsert(
            {
              student_plan_id: planId,
              class_id: cls.id,
              student_id: sid,
              status: "pending",
              confirmed_at: null,
              refunded_at: null,
            },
            { onConflict: "student_id,class_id" }
          );
          if (usageUpsertErr) {
            console.error("Error registrando plan_usages en Calendar (edit)", usageUpsertErr.message);
          }
        }
      }

      // Push: removidos (class-cancelled)
      if (removedStudents.length > 0 && selectedAcademyId && userId && role) {
        try {
          const res = await fetch("/api/push/class-cancelled", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId: cls.id,
              coachId: editCoachId,
              studentIds: removedStudents,
              dateIso: newIso,
              academyId: selectedAcademyId,
              cancelledByRole: role,
              cancelledByUserId: userId,
            }),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.error("Push class-cancelled respondió con error", res.status, txt);
          }
        } catch (pushErr) {
          console.error("Error enviando push de alumnos removidos", pushErr);
        }
      }

      // Push: reprogramación si cambió algo
      const isRescheduled = oldDateIso !== newIso || oldCourtId !== editCourtId || oldCoachId !== editCoachId;
      if (isRescheduled && selectedAcademyId && userId && role) {
        try {
          const res = await fetch("/api/push/class-rescheduled", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId: cls.id,
              academyId: selectedAcademyId,
              studentIds: editSelectedStudents,
              coachId: editCoachId,
              oldDateIso,
              newDateIso: newIso,
              oldCourtId,
              newCourtId: editCourtId,
              oldCoachId,
              newCoachId: editCoachId,
              rescheduledByRole: role,
              rescheduledByUserId: userId,
            }),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.error("Push class-rescheduled respondió con error", res.status, txt);
          }
        } catch (pushErr) {
          console.error("Error enviando push de clase reprogramada", pushErr);
        }
      }

      toast.success("Cambios guardados.");
      setDetailsOpen(false);
      resetEditForm();

      const vr = visibleRangeRef.current;
      if (vr) await loadCalendarRange(vr.start, vr.end);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar.");
    } finally {
      setSavingEdit(false);
    }
  };

  const openCreate = (prefill?: { day?: string; time?: string }) => {
    if (!canCreate) return;
    setCreateOpen(true);
    if (prefill?.day) setCreateDay(prefill.day);
    if (prefill?.time) setCreateTime(prefill.time);
  };

  const onConfirmCreate = async () => {
    return onConfirmCreateInternal(false);
  };

  const onConfirmCreateInternal = async (allowPast: boolean) => {
    if (!selectedAcademyId) {
      toast.error("Seleccioná una academia en Configuración.");
      return;
    }
    if (role === "super_admin" || role === "student") return;
    if (!createCourtId || !createDay) {
      toast.error("Completa cancha y fecha.");
      return;
    }
    const coachIdToUse = role === "coach" ? coachSelfId : createCoachId;
    if (!coachIdToUse) {
      toast.error("Seleccioná un profesor.");
      return;
    }
    if (!createTime) {
      toast.error("Seleccioná una hora.");
      return;
    }
    const hour = Number(createTime.split(":")[0] ?? "NaN");
    if (Number.isNaN(hour) || hour < 6 || hour > 23) {
      toast.error("Horario inválido. Seleccioná una hora entre 06:00 y 23:00.");
      return;
    }
    if (createSelectedStudents.length < 1) {
      toast.error("Selecciona al menos 1 alumno (máximo 4).");
      return;
    }
    if (createSelectedStudents.length > 4) {
      toast.error("Máximo 4 alumnos por clase.");
      return;
    }

    const iso = new Date(`${createDay}T${createTime}:00`).toISOString();
    {
      const now = new Date();
      if (!allowPast && new Date(iso).getTime() <= now.getTime()) {
        setPastWarningLabel(`${createDay} ${createTime}`);
        setPastWarningAllowPast(true);
        setPastWarningOpen(true);
        return;
      }
    }

    setCreating(true);
    try {
      // Validar planes y saldo real (como /schedule) + elegir plan por alumno
      const planForStudent: Record<string, string> = {};
      for (const sid of createSelectedStudents) {
        const label = students.find((s) => s.id === sid)?.full_name ?? "(sin nombre)";

        const { data: plans, error: planErr } = await supabase
          .from("student_plans")
          .select("id, remaining_classes, purchased_at")
          .eq("student_id", sid)
          .order("purchased_at", { ascending: true });
        if (planErr) {
          console.error("Error verificando student_plans en Calendar (create)", sid, label, (planErr as any)?.message);
          toast.error(`No se pudo verificar el plan de ${label}. Intenta nuevamente.`);
          return;
        }

        if (!plans || plans.length === 0) {
          toast.error(`El alumno ${label} no tiene un plan con clases disponibles.`);
          return;
        }

        let chosenPlan: any = null;
        for (const p of plans as any[]) {
          const { count: usedCount, error: usageCountErr } = await supabase
            .from("plan_usages")
            .select("id", { count: "exact", head: true })
            .eq("student_plan_id", p.id)
            .eq("student_id", sid)
            .in("status", ["pending", "confirmed"]);
          if (usageCountErr) throw new Error("No se pudo verificar el uso de clases del plan.");

          const used = usedCount ?? 0;
          const totalFromPlan = Number((p.remaining_classes as number) ?? 0);
          const remaining = Math.max(0, totalFromPlan - used);
          if (remaining > 0) {
            chosenPlan = p;
            break;
          }
        }

        if (!chosenPlan) {
          const label = students.find((s) => s.id === sid)?.full_name ?? "(sin nombre)";
          toast.error(`El alumno ${label} ya no tiene clases disponibles en su plan.`);
          return;
        }

        // Limitar cantidad de clases futuras reservadas al total de clases del plan
        {
          const totalFromPlan = Number((chosenPlan.remaining_classes as number) ?? 0);
          if (totalFromPlan > 0) {
            const nowIso = new Date().toISOString();
            const { data: futureBookings, error: futureErr } = await supabase
              .from("bookings")
              .select("id, class_sessions!inner(id,date)")
              .eq("student_id", sid)
              .gt("class_sessions.date", nowIso);
            if (futureErr) throw new Error("No se pudo verificar las clases futuras del alumno. Intenta nuevamente.");

            const futureCount = (futureBookings ?? []).length;
            if (futureCount >= totalFromPlan) {
              const label = students.find((s) => s.id === sid)?.full_name ?? "(sin nombre)";
              toast.error(
                `El alumno ${label} ya tiene ${futureCount} clases futuras reservadas, que es el máximo permitido por su plan.`
              );
              return;
            }
          }
        }

        planForStudent[sid] = chosenPlan.id as string;
      }

      // Anti-race: misma cancha y misma hora
      {
        const { data: clash, error: clashErr } = await supabase
          .from("class_sessions")
          .select("id")
          .eq("court_id", createCourtId)
          .eq("date", iso)
          .neq("status", "cancelled")
          .limit(1);
        if (clashErr) throw clashErr;
        if ((clash ?? []).length > 0) {
          toast.error("Ese horario ya está ocupado en esa cancha. Elegí otra hora.");
          return;
        }
      }

      // Conflicto: alumnos con clase en mismo horario
      {
        const { data: conflictsFiltered, error: conflictsStatusErr } = await supabase
          .from("bookings")
          .select("student_id, class_sessions!inner(id,date,status)")
          .in("student_id", createSelectedStudents)
          .eq("class_sessions.date", iso)
          .neq("class_sessions.status", "cancelled");
        if (conflictsStatusErr) throw conflictsStatusErr;
        if ((conflictsFiltered ?? []).length > 0) {
          toast.error("Uno o más alumnos ya tienen una clase en ese horario.");
          return;
        }
      }

      const capacity = createSelectedStudents.length;
      const typeForSession = capacity === 1 ? "individual" : "grupal";

      const { data: inserted, error: insErr } = await supabase
        .from("class_sessions")
        .insert({
          date: iso,
          court_id: createCourtId,
          coach_id: coachIdToUse,
          capacity,
          type: typeForSession,
          attendance_pending: false,
        })
        .select("*")
        .maybeSingle();
      if (insErr) throw insErr;
      if (!inserted) throw new Error("No se pudo crear la clase.");

      const createdClassId = (inserted as any).id as string;
      const bookingRows = createSelectedStudents.map((sid) => ({
        class_id: createdClassId,
        student_id: sid,
        status: "reserved",
      }));
      const { error: bookingsErr } = await supabase.from("bookings").insert(bookingRows);
      if (bookingsErr) throw bookingsErr;

      // plan_usages (consumo pendiente)
      for (const sid of createSelectedStudents) {
        const planId = planForStudent[sid];
        if (!planId) continue;
        const { error: usageUpsertErr } = await supabase.from("plan_usages").upsert(
          {
            student_plan_id: planId,
            class_id: createdClassId,
            student_id: sid,
            status: "pending",
            confirmed_at: null,
            refunded_at: null,
          },
          { onConflict: "student_id,class_id" }
        );
        if (usageUpsertErr) {
          console.error("Error registrando plan_usages en Calendar (create)", usageUpsertErr.message);
        }
      }

      try {
        const res = await fetch("/api/push/class-created", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: createdClassId,
            coachId: coachIdToUse,
            studentIds: [...createSelectedStudents],
            dateIso: iso,
            academyId: selectedAcademyId,
          }),
        });

        if (!res.ok) {
          let txt = "";
          try {
            txt = await res.text();
          } catch {
            txt = "";
          }
          console.warn("Push class-created failed", res.status, txt);
        }
      } catch {
        // no bloquear UI por push
      }

      toast.success("Clase creada correctamente.");
      setCreateOpen(false);
      resetCreateForm();

      const vr = visibleRangeRef.current;
      if (vr) void loadCalendarRange(vr.start, vr.end);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la clase.");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("selectedAcademyId");
    setSelectedAcademyId(stored && stored.trim() ? stored : null);
    setSelectedAcademyReady(true);

    const onChanged = (ev: Event) => {
      const next = (ev as CustomEvent<{ academyId: string | null }>).detail?.academyId ?? null;
      setSelectedAcademyId(next && next.trim() ? next : null);
    };
    window.addEventListener("selectedAcademyIdChanged", onChanged as any);
    return () => window.removeEventListener("selectedAcademyIdChanged", onChanged as any);
  }, []);

  useEffect(() => {
    (async () => {
      if (!userId) {
        setAcademies([]);
        return;
      }

      try {
        const { data: uaRows, error: uaErr } = await supabase
          .from("user_academies")
          .select("academy_id")
          .eq("user_id", userId);
        if (uaErr) throw uaErr;

        const academyIds = Array.from(
          new Set(((uaRows as { academy_id: string }[] | null) ?? []).map((r) => r.academy_id).filter(Boolean))
        );

        if (academyIds.length === 0) {
          setAcademies([]);
          return;
        }

        const { data: aRows, error: aErr } = await supabase
          .from("academies")
          .select("id,name")
          .in("id", academyIds)
          .order("name");
        if (aErr) throw aErr;

        const list = ((aRows as Academy[] | null) ?? []).filter((a) => a?.id);
        setAcademies(list);
      } catch (e: any) {
        toast.error(e?.message ?? "No se pudieron cargar academias.");
        setAcademies([]);
      }
    })();
  }, [supabase, userId, selectedAcademyId]);

  const loadCalendarRange = async (start: Date, end: Date) => {
    if (!selectedAcademyReady) return;
    if (!selectedAcademyId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const { data: locRows, error: locErr } = await supabase
        .from("academy_locations")
        .select("location_id")
        .eq("academy_id", selectedAcademyId);
      if (locErr) throw locErr;

      const locationIds = Array.from(
        new Set(
          ((locRows as { location_id: string | null }[] | null) ?? [])
            .map((r) => r.location_id)
            .filter((id): id is string => !!id)
        )
      );

      if (locationIds.length === 0) {
        setEvents([]);
        return;
      }

      const { data: courtsData, error: courtsErr } = await supabase
        .from("courts")
        .select("id,name,location_id")
        .in("location_id", locationIds);
      if (courtsErr) throw courtsErr;

      const courts = ((courtsData as Court[] | null) ?? []).filter((c) => c?.id);
      const courtById = courts.reduce<Record<string, Court>>((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {});

      const courtIds = courts.map((c) => c.id);
      if (courtIds.length === 0) {
        setEvents([]);
        return;
      }

      const fromIso = toIsoSafe(start);
      const toIso = toIsoSafe(end);

      const { data: classRows, error: classErr } = await supabase
        .from("class_sessions")
        .select("id,date,type,capacity,coach_id,court_id,status,attendance_pending")
        .in("court_id", courtIds)
        .gte("date", fromIso)
        .lte("date", toIso)
        .neq("status", "cancelled")
        .order("date", { ascending: true });
      if (classErr) throw classErr;

      const classes = (classRows as ClassSession[] | null) ?? [];
      const classIds = classes.map((c) => c.id);

      // Ocupación por slot (día+hora) para modo disponibilidad
      {
        const next: Record<string, string[]> = {};
        const totals: Record<string, number> = {};
        for (const cls of classes) {
          if (!cls?.date) continue;
          if (!cls?.court_id) continue;
          const d = new Date(cls.date);
          const day = toYmd(d);
          const hh = pad2(d.getHours());
          const key = `${day}:${hh}`;
          const prev = next[key] ?? [];
          if (!prev.includes(cls.court_id)) prev.push(cls.court_id);
          next[key] = prev;

          totals[day] = (totals[day] ?? 0) + 1;
        }
        setOccupiedCourtsBySlot(next);
        setDayTotalClasses(totals);
      }

      let bookingsCountByClassId: Record<string, number> = {};
      if (classIds.length > 0) {
        const { data: bRows, error: bErr } = await supabase
          .from("bookings")
          .select("id,class_id,student_id")
          .in("class_id", classIds);
        if (!bErr) {
          bookingsCountByClassId = ((bRows as BookingRow[] | null) ?? []).reduce<Record<string, number>>((acc, b) => {
            const cid = b.class_id;
            if (!cid) return acc;
            acc[cid] = (acc[cid] ?? 0) + 1;
            return acc;
          }, {});
        }
      }

      const coachIds = Array.from(
        new Set(classes.map((c) => c.coach_id).filter((id): id is string => !!id))
      );

      let coachNameByCoachId: Record<string, string | null> = {};
      if (coachIds.length > 0) {
        const { data: coachRows, error: coachErr } = await supabase
          .from("coaches")
          .select("id,user_id")
          .in("id", coachIds);
        if (!coachErr) {
          const coaches = (coachRows as Coach[] | null) ?? [];
          const userIds = Array.from(new Set(coaches.map((c) => c.user_id).filter((x): x is string => !!x)));
          let fullNameByUserId: Record<string, string | null> = {};
          if (userIds.length > 0) {
            const { data: profileRows, error: profErr } = await supabase
              .from("profiles")
              .select("id,full_name")
              .in("id", userIds);
            if (!profErr) {
              fullNameByUserId = ((profileRows as { id: string; full_name: string | null }[] | null) ?? []).reduce<
                Record<string, string | null>
              >((acc, p) => {
                acc[p.id] = p.full_name;
                return acc;
              }, {});
            }
          }

          coachNameByCoachId = coaches.reduce<Record<string, string | null>>((acc, c) => {
            const name = c.user_id ? fullNameByUserId[c.user_id] ?? null : null;
            acc[c.id] = name;
            return acc;
          }, {});
        }
      }

      const nextEvents = classes
        .map((cls) => {
          const startDt = new Date(cls.date);
          const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
          const court = cls.court_id ? courtById[cls.court_id] : null;
          const coachName = cls.coach_id ? coachNameByCoachId[cls.coach_id] ?? null : null;
          const n = bookingsCountByClassId[cls.id] ?? 0;

          const titleParts: string[] = [];
          if (court?.name) titleParts.push(court.name);
          if (coachName) titleParts.push(coachName);
          if (n > 0) titleParts.push(`${n} alumno${n === 1 ? "" : "s"}`);

          return {
            id: cls.id,
            title: titleParts.length ? titleParts.join(" · ") : "Clase",
            start: startDt,
            end: endDt,
            backgroundColor: cls.attendance_pending ? "#f59e0b" : "#38AEB1",
            borderColor: cls.attendance_pending ? "#d97706" : "#2D9A9C",
            textColor: "#0f172a",
            extendedProps: {
              kind: "class_session",
              classSession: cls,
              courtName: court?.name ?? null,
              coachName,
              bookingsCount: n,
            },
          };
        })
        .filter(Boolean);

      // Manual events + blocks (por academia y rango; condición de solapamiento)
      const [manualRes, blocksRes] = await Promise.all([
        supabase
          .from("calendar_manual_events")
          .select("id,academy_id,title,notes,starts_at,ends_at,location_id,court_id,coach_id")
          .eq("academy_id", selectedAcademyId)
          .lt("starts_at", toIso)
          .gt("ends_at", fromIso)
          .order("starts_at", { ascending: true }),
        supabase
          .from("calendar_blocks")
          .select("id,academy_id,kind,reason,starts_at,ends_at,location_id,court_id,coach_id")
          .eq("academy_id", selectedAcademyId)
          .lt("starts_at", toIso)
          .gt("ends_at", fromIso)
          .order("starts_at", { ascending: true }),
      ]);

      if (manualRes.error) throw manualRes.error;
      if (blocksRes.error) throw blocksRes.error;

      const manualRows = (manualRes.data as CalendarManualEventRow[] | null) ?? [];
      const blockRows = (blocksRes.data as CalendarBlockRow[] | null) ?? [];

      const manualEvents = manualRows.map((r) => {
        const startDt = new Date(r.starts_at);
        const endDt = new Date(r.ends_at);
        return {
          id: `manual:${r.id}`,
          title: r.title,
          start: startDt,
          end: endDt,
          backgroundColor: "#314260",
          borderColor: "#314260",
          textColor: "#ffffff",
          extendedProps: {
            kind: "manual_event",
            manualEvent: r,
          },
        };
      });

      const blockEvents = blockRows.map((r) => {
        const startDt = new Date(r.starts_at);
        const endDt = new Date(r.ends_at);
        const isHoliday = String(r.kind ?? "").toLowerCase() === "holiday";
        return {
          id: `block:${r.id}`,
          title: isHoliday ? "Feriado" : r.reason ? `Bloqueo · ${r.reason}` : "Bloqueo",
          start: startDt,
          end: endDt,
          display: "block",
          backgroundColor: isHoliday ? "rgba(49,66,96,0.12)" : "rgba(148,163,184,0.35)",
          borderColor: isHoliday ? "rgba(49,66,96,0.25)" : "rgba(148,163,184,0.55)",
          textColor: "#314260",
          extendedProps: {
            kind: "block",
            block: r,
          },
        };
      });

      setEvents([...blockEvents, ...manualEvents, ...nextEvents]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cargar el calendario.");
      setEvents([]);
      setOccupiedCourtsBySlot({});
      setDayTotalClasses({});
    } finally {
      setLoading(false);
    }
  };

  const monthMacroByDay = useMemo(() => {
    const totalCourts = allCourtIds.length;
    const peakByDay: Record<string, number> = {};

    for (const key of Object.keys(occupiedCourtsBySlot)) {
      const [day] = key.split(":");
      if (!day) continue;
      const n = (occupiedCourtsBySlot[key] ?? []).length;
      peakByDay[day] = Math.max(peakByDay[day] ?? 0, n);
    }

    return {
      totalCourts,
      peakByDay,
    };
  }, [occupiedCourtsBySlot, allCourtIds]);

  useEffect(() => {
    if (!availabilityMode) {
      setAvailabilityEvents([]);
      return;
    }

    const vr = visibleRangeRef.current;
    if (!vr) {
      setAvailabilityEvents([]);
      return;
    }

    if (currentViewType !== "timeGridDay" && currentViewType !== "timeGridWeek") {
      setAvailabilityEvents([]);
      return;
    }

    const total = allCourtIds.length;
    if (!total) {
      setAvailabilityEvents([]);
      setAvailabilityLegend("");
      return;
    }

    setAvailabilityLegend(`Huecos: libres/total`);

    const start = new Date(vr.start);
    const end = new Date(vr.end);
    const next: any[] = [];

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const day = toYmd(d);
      for (let h = 6; h <= 23; h++) {
        const hh = pad2(h);
        const key = `${day}:${hh}`;
        const occupied = new Set((occupiedCourtsBySlot[key] ?? []).filter(Boolean));
        const occupiedCount = occupied.size;
        const free = Math.max(0, total - occupiedCount);
        const ratio = total ? free / total : 0;

        let bg = "rgba(148,163,184,0.04)";
        if (free === 0) {
          bg = "rgba(239,68,68,0.06)";
        } else if (ratio >= 0.75) {
          bg = "rgba(34,197,94,0.07)";
        } else if (ratio >= 0.4) {
          bg = "rgba(34,197,94,0.05)";
        } else {
          bg = "rgba(245,158,11,0.05)";
        }

        const slotStart = new Date(`${day}T${hh}:00:00`);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
        next.push({
          id: `availability:${key}`,
          start: slotStart,
          end: slotEnd,
          display: "background",
          backgroundColor: bg,
          extendedProps: {
            kind: "availability",
            freeCount: free,
            totalCount: total,
            day,
            hour: hh,
          },
        });
      }
    }

    setAvailabilityEvents(next);
  }, [availabilityMode, occupiedCourtsBySlot, allCourtIds, currentViewType]);

  const onOpenDetails = (eventApi: any) => {
    const p = (eventApi?.extendedProps ?? {}) as any;
    setDetailsEvent({
      id: eventApi?.id ?? null,
      title: eventApi?.title ?? "",
      start: eventApi?.start ?? null,
      end: eventApi?.end ?? null,
      props: p,
    });
    setDetailsOpen(true);
    setRescheduleOpen(false);

    const startDt = eventApi?.start ? new Date(eventApi.start) : null;
    if (startDt) {
      setRescheduleDay(toYmd(startDt));
      setRescheduleTime(`${pad2(startDt.getHours())}:00`);
    } else {
      setRescheduleDay("");
      setRescheduleTime("");
    }
  };

  const onConfirmReschedule = async () => {
    const p = (detailsEvent?.props ?? {}) as any;
    if (p?.kind !== "class_session") return;
    const cls = p.classSession as ClassSession | undefined;
    if (!cls?.id) return;

    // Permisos: admin puede; coach solo su clase
    if (!role || role === "super_admin" || role === "student") return;
    if (role === "coach" && coachSelfId && cls.coach_id !== coachSelfId) {
      toast.error("No tenés permisos para modificar esta clase.");
      return;
    }

    if (!rescheduleDay || !rescheduleTime) {
      toast.error("Completa fecha y hora.");
      return;
    }

    const hour = Number(rescheduleTime.split(":")[0] ?? "NaN");
    if (Number.isNaN(hour) || hour < 6 || hour > 23) {
      toast.error("Horario inválido. Seleccioná una hora entre 06:00 y 23:00.");
      return;
    }

    const iso = new Date(`${rescheduleDay}T${rescheduleTime}:00`).toISOString();
    {
      const now = new Date();
      const classStart = new Date(iso);
      if (classStart.getTime() <= now.getTime()) {
        toast.error("No podés mover una clase a una fecha y hora que ya pasaron.");
        return;
      }
    }

    if (!cls.court_id) {
      toast.error("Esta clase no tiene cancha asignada.");
      return;
    }

    setRescheduling(true);
    try {
      const oldDateIso = cls.date;
      const oldCourtId = cls.court_id;
      const oldCoachId = cls.coach_id;

      const { data: clash, error: clashErr } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("court_id", cls.court_id)
        .eq("date", iso)
        .neq("id", cls.id)
        .neq("status", "cancelled")
        .limit(1);
      if (clashErr) throw clashErr;
      if ((clash ?? []).length > 0) {
        toast.error("Ese horario ya está ocupado en esa cancha. Elegí otra hora.");
        return;
      }

      if (cls.coach_id) {
        const { data: coachClash, error: coachClashErr } = await supabase
          .from("class_sessions")
          .select("id")
          .eq("coach_id", cls.coach_id)
          .eq("date", iso)
          .neq("status", "cancelled")
          .neq("id", cls.id)
          .limit(1);
        if (coachClashErr) {
          toast.error("No se pudo verificar la disponibilidad del profesor. Intenta nuevamente.");
          return;
        }
        if ((coachClash ?? []).length > 0) {
          toast.warning("El profesor ya tiene una clase en ese horario.");
        }
      }

      const { data: upd, error: updErr } = await supabase
        .from("class_sessions")
        .update({ date: iso })
        .eq("id", cls.id)
        .select("id,date")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!upd) throw new Error("No se pudo reprogramar la clase.");

      // Notificación (igual que /schedule)
      if (selectedAcademyId && userId && role) {
        try {
          const { data: bRows, error: bErr } = await supabase
            .from("bookings")
            .select("student_id")
            .eq("class_id", cls.id);
          if (bErr) throw bErr;
          const studentIds = Array.from(
            new Set(
              ((bRows as { student_id: string | null }[] | null) ?? [])
                .map((r) => r.student_id)
                .filter((x): x is string => !!x)
            )
          );

          const isRescheduled = oldDateIso !== iso;
          if (isRescheduled) {
            const res = await fetch("/api/push/class-rescheduled", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                classId: cls.id,
                academyId: selectedAcademyId,
                studentIds,
                coachId: cls.coach_id,
                oldDateIso,
                newDateIso: iso,
                oldCourtId,
                newCourtId: oldCourtId,
                oldCoachId,
                newCoachId: oldCoachId,
                rescheduledByRole: role,
                rescheduledByUserId: userId,
              }),
            });
            if (!res.ok) {
              const txt = await res.text().catch(() => "");
              console.error("Push class-rescheduled respondió con error", res.status, txt);
            }
          }
        } catch (pushErr) {
          console.error("Error enviando push de clase reprogramada", pushErr);
        }
      }

      toast.success("Clase reprogramada.");
      setDetailsOpen(false);
      setRescheduleOpen(false);

      const vr = visibleRangeRef.current;
      if (vr) await loadCalendarRange(vr.start, vr.end);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo reprogramar.");
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="agendo-calendar max-w-5xl mx-auto px-3 sm:px-4 pb-28 sm:pb-44 pt-4 sm:pt-6 relative z-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-[#38AEB1]" />
            <h1 className="text-2xl font-semibold text-[#314260]">Calendario</h1>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <AgendoLogo className="h-16 w-32" />
        </div>
      </div>

      {!selectedAcademyId && (
        <div className="mt-4 text-[11px] text-amber-700">
          Seleccioná una academia en Configuración para ver el calendario.
        </div>
      )}

      <div className="mt-3 h-6 flex items-center text-xs text-slate-500">{loading ? "Cargando..." : ""}</div>

      {canCreate && (
        <div className="mt-3">
          <Button type="button" className="h-9" onClick={() => openCreate()} disabled={!selectedAcademyId}>
            + Nueva clase
          </Button>
        </div>
      )}

      <div ref={calendarCardRef} className="mt-4 rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-3 border-b bg-white flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Calendario</div>
          <div className="flex items-center gap-2">
            {canToggleAvailability && (currentViewType === "timeGridDay" || currentViewType === "timeGridWeek") && (
              <Button
                type="button"
                variant={availabilityMode ? "default" : "outline"}
                className="h-8 px-2.5 text-xs"
                onClick={() => setAvailabilityMode((v) => !v)}
              >
                Huecos
              </Button>
            )}
            {availabilityMode && availabilityLegend ? (
              <div className="hidden sm:block text-[11px] text-slate-500">{availabilityLegend}</div>
            ) : null}
            <div className="text-xs text-slate-500">{role ? `Rol: ${role}` : ""}</div>
          </div>
        </div>

        {isMobile && (
          <div className="p-2 border-b bg-white">
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={mobileView === "timeGridDay" ? "default" : "outline"}
                className="h-9 text-xs"
                onClick={() => setMobileView("timeGridDay")}
              >
                Día
              </Button>
              <Button
                type="button"
                variant={mobileView === "timeGridWeek" ? "default" : "outline"}
                className="h-9 text-xs"
                onClick={() => setMobileView("timeGridWeek")}
              >
                Semana
              </Button>
              <Button
                type="button"
                variant={mobileView === "dayGridMonth" ? "default" : "outline"}
                className="h-9 text-xs"
                onClick={() => setMobileView("dayGridMonth")}
              >
                Mes
              </Button>
            </div>
          </div>
        )}

        <div className="p-2 sm:p-3">
          <FullCalendar
            key={isMobile ? "mobile" : "desktop"}
            ref={calendarRef as any}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={isMobile ? mobileView : "timeGridWeek"}
            height={isMobile ? mobileCalendarHeight ?? 520 : "auto"}
            expandRows={!isMobile}
            locale={esLocale as any}
            firstDay={1}
            nowIndicator
            weekends
            allDaySlot={!isMobile}
            eventDisplay="block"
            dayMaxEvents={isMobile && mobileView === "dayGridMonth" ? 3 : undefined}
            moreLinkText={(n) => `+${n} más`}
            selectable
            selectMirror
            buttonText={{
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
              list: "Lista",
            }}
            allDayText="Todo el día"
            noEventsText="No hay eventos para mostrar"
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            headerToolbar={
              isMobile
                ? { left: "prev,next today", center: "title", right: "" }
                : {
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                  }
            }
            views={
              isMobile
                ? {
                    timeGridDay: {
                      titleFormat: { year: "numeric", month: "short", day: "numeric" },
                    },
                    timeGridWeek: {
                      titleFormat: { year: "numeric", month: "short", day: "numeric" },
                    },
                    dayGridMonth: {
                      titleFormat: { year: "numeric", month: "long" },
                    },
                  }
                : undefined
            }
            dayHeaderFormat={isMobile ? { weekday: "short" } : undefined}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            scrollTime={isMobile ? mobileScrollTime : undefined}
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            slotLabelInterval={{ hours: 1 }}
            events={availabilityMode ? [...availabilityEvents, ...events] : events}
            dayCellContent={(arg) => {
              const viewType = String((arg.view as any)?.type ?? "");
              if (viewType !== "dayGridMonth") return undefined as any;

              const day = toYmd(arg.date);
              const total = dayTotalClasses[day] ?? 0;
              const peak = monthMacroByDay.peakByDay[day] ?? 0;
              const max = monthMacroByDay.totalCourts;

              const ratio = max > 0 ? peak / max : 0;
              const peakClassName =
                peak <= 0 || max <= 0
                  ? ""
                  : ratio >= 0.84
                    ? "text-red-600"
                    : ratio >= 0.5
                      ? "text-amber-600"
                      : "text-emerald-600";

              return (
                <div className="flex items-start justify-between gap-1">
                  <div className="fc-daygrid-day-number">{arg.dayNumberText}</div>
                  <div className="text-[10px] leading-3 text-slate-600 text-right">
                    <div>{total > 0 ? `clases: ${total}` : ""}</div>
                    <div className={peakClassName}>{peak > 0 && max > 0 ? `pico ${peak}/${max}` : ""}</div>
                  </div>
                </div>
              );
            }}
            eventOrder={(a: any, b: any) => {
              const aStart = a?.start ? new Date(a.start as any).getTime() : 0;
              const bStart = b?.start ? new Date(b.start as any).getTime() : 0;
              if (aStart !== bStart) return aStart - bStart;
              const ac = String((a?.extendedProps as any)?.courtName ?? "").toLowerCase();
              const bc = String((b?.extendedProps as any)?.courtName ?? "").toLowerCase();
              if (ac !== bc) return ac.localeCompare(bc);
              return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
            }}
            eventContent={(arg) => {
              const kind = String((arg.event.extendedProps as any)?.kind ?? "");
              const viewType = String((arg.view as any)?.type ?? "");
              if (viewType === "dayGridMonth") {
                if (kind === "block") {
                  return (
                    <div className="px-1.5 py-0.5">
                      <div className="text-[11px] font-semibold leading-4 truncate">{shortenName(arg.event.title, 22) || "Bloqueo"}</div>
                    </div>
                  );
                }
                if (kind === "manual_event") {
                  return (
                    <div className="px-1.5 py-0.5">
                      <div className="text-[11px] font-semibold leading-4 truncate">{shortenName(arg.event.title, 22) || "Evento"}</div>
                    </div>
                  );
                }

                const courtName = (arg.event.extendedProps as any)?.courtName as string | null | undefined;
                const coachName = (arg.event.extendedProps as any)?.coachName as string | null | undefined;
                const n = (arg.event.extendedProps as any)?.bookingsCount as number | null | undefined;

                const top = `${arg.timeText ? arg.timeText + " · " : ""}${courtName ? shortenName(courtName, 16) : "Clase"}`;
                const metaParts: string[] = [];
                if (coachName) metaParts.push(shortenName(coachName, 16));
                if (typeof n === "number" && n > 0) metaParts.push(`${n}`);
                const meta = metaParts.join(" · ");

                return (
                  <div className="px-1.5 py-0.5">
                    <div className="text-[11px] font-semibold leading-4 truncate">{top}</div>
                    {meta ? <div className="text-[10px] leading-3 opacity-90 truncate">{meta}</div> : null}
                  </div>
                );
              }

              if (viewType === "timeGridDay" || viewType === "timeGridWeek") {
                if (kind !== "class_session") return undefined as any;
                const courtName = (arg.event.extendedProps as any)?.courtName as string | null | undefined;
                const coachName = (arg.event.extendedProps as any)?.coachName as string | null | undefined;
                const n = (arg.event.extendedProps as any)?.bookingsCount as number | null | undefined;

                const top = courtName ? shortenName(courtName, 20) : "Clase";
                const metaParts: string[] = [];
                if (coachName) metaParts.push(shortenName(coachName, 20));
                if (typeof n === "number" && n > 0) metaParts.push(`${n} alumno${n === 1 ? "" : "s"}`);
                const meta = metaParts.join(" · ");

                return (
                  <div className="px-2 py-1">
                    <div className="text-[12px] font-semibold leading-4 truncate">{top}</div>
                    {meta ? <div className="text-[11px] leading-4 truncate">{meta}</div> : null}
                  </div>
                );
              }

              return undefined as any;
            }}
            eventClassNames={(arg) => {
              const classes: string[] = [];
              if (tappedEventId && arg.event.id === tappedEventId) classes.push("agendo-fc-tapped");
              return classes;
            }}
            eventDidMount={(info) => {
              const kind = String((info.event.extendedProps as any)?.kind ?? "");
              if (!availabilityMode) return;
              if (kind !== "availability") return;
              const viewType = String((info.view as any)?.type ?? "");
              if (viewType !== "timeGridDay" && viewType !== "timeGridWeek") return;

              const free = (info.event.extendedProps as any)?.freeCount as number | undefined;
              const total = (info.event.extendedProps as any)?.totalCount as number | undefined;
              if (typeof free !== "number" || typeof total !== "number" || total <= 0) return;

              const el = info.el as HTMLElement | null;
              if (!el) return;

              // Avoid duplicates
              if (el.querySelector("[data-agendo-availability-label='1']")) return;

              const label = document.createElement("div");
              label.setAttribute("data-agendo-availability-label", "1");
              label.textContent = `${free}/${total}`;
              label.style.position = "absolute";
              label.style.right = "6px";
              label.style.top = "2px";
              label.style.fontSize = "10px";
              label.style.lineHeight = "12px";
              label.style.fontWeight = "600";
              label.style.color = "rgba(15, 23, 42, 0.55)";
              label.style.pointerEvents = "none";
              label.style.userSelect = "none";
              label.style.textShadow = "0 1px 0 rgba(255,255,255,0.7)";

              // Ensure container can position children
              if (getComputedStyle(el).position === "static") {
                el.style.position = "relative";
              }

              el.appendChild(label);
            }}
            datesSet={(arg) => {
              const viewType = String((arg.view as any)?.type ?? "");
              visibleRangeRef.current = { start: arg.start, end: arg.end };

              const run = () => {
                setCurrentViewType(viewType);
                void loadCalendarRange(arg.start, arg.end);
              };

              try {
                if (typeof queueMicrotask === "function") queueMicrotask(run);
                else window.setTimeout(run, 0);
              } catch {
                window.setTimeout(run, 0);
              }
            }}
            dateClick={(arg) => {
              if (!arg?.date) return;
              const viewType = String((arg.view as any)?.type ?? "");
              if ((arg as any).allDay) {
                if (!canCreate) return;
                openCreate({ day: toYmd(arg.date) });
                return;
              }
              const d = arg.date;
              const hh = pad2(d.getHours());
              const day = toYmd(d);
              const time = `${hh}:00`;

              if (availabilityMode && (viewType === "timeGridDay" || viewType === "timeGridWeek")) {
                const x = (arg as any)?.jsEvent?.clientX ?? 0;
                const y = (arg as any)?.jsEvent?.clientY ?? 0;
                openAvailabilityPopup({ day, time, x, y });
                return;
              }

              if (!canCreate) return;
              openCreate({ day, time });
            }}
            eventClick={(info) => {
              setTappedEventId(info.event.id);
              window.setTimeout(() => setTappedEventId((cur) => (cur === info.event.id ? null : cur)), 300);
              onOpenDetails(info.event);
            }}
          />
        </div>
      </div>

      {availabilityPopupOpen && availabilityMode && (currentViewType === "timeGridDay" || currentViewType === "timeGridWeek") && (
        <div
          ref={availabilityPopupRef}
          className="fixed z-[60] w-[280px] rounded-lg border bg-white shadow-lg p-3"
          style={{ left: availabilityPopupX, top: availabilityPopupY }}
        >
          {(() => {
            const freeIds = availabilityPopupDay && availabilityPopupTime ? getFreeCourtIdsForSlot(availabilityPopupDay, availabilityPopupTime) : [];
            const total = allCourtIds.length;
            const free = freeIds.length;
            const freeNames = freeIds
              .map((id) => courts.find((c) => c.id === id)?.name ?? null)
              .filter((x): x is string => !!x);
            const shown = freeNames.slice(0, 8);
            const rest = Math.max(0, freeNames.length - shown.length);

            return (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Huecos</div>
                    <div className="text-[12px] text-slate-600">
                      {availabilityPopupDay} · {availabilityPopupTime}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={closeAvailabilityPopup}>
                    Cerrar
                  </Button>
                </div>

                <div className="text-sm text-slate-800">
                  <span className="font-semibold">Libres:</span> {free}/{total}
                </div>

                <div className="text-[12px] text-slate-600">
                  {shown.length > 0 ? (
                    <div>
                      <div className="font-medium text-slate-700">Canchas libres</div>
                      <div className="mt-1">
                        {shown.join(", ")}
                        {rest > 0 ? ` (+${rest} más)` : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="font-medium text-slate-700">No hay canchas libres en este horario.</div>
                  )}
                </div>

                {canCreate && free > 0 && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      className="h-9 w-full"
                      onClick={() => {
                        closeAvailabilityPopup();
                        openCreate({ day: availabilityPopupDay, time: availabilityPopupTime });
                      }}
                    >
                      Crear clase aquí
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setRescheduleOpen(false);
            resetEditForm();
            resetAttendance();
            setDetailsEvent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#0f172a]">Detalle</DialogTitle>
            <DialogDescription>
              {detailsEvent?.props?.kind === "class_session" ? "Clase" : "Evento"}
            </DialogDescription>
          </DialogHeader>

          {detailsEvent?.props?.kind === "class_session" ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-800">{detailsEvent?.title || "Clase"}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {detailsEvent?.start ? new Date(detailsEvent.start).toLocaleString("es-PY") : ""}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <div className="text-[11px] text-slate-500">Cancha</div>
                    <div className="font-medium">{detailsEvent?.props?.courtName ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Profesor</div>
                    <div className="font-medium">{detailsEvent?.props?.coachName ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Reservas</div>
                    <div className="font-medium">{String(detailsEvent?.props?.bookingsCount ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Duración</div>
                    <div className="font-medium">60 min</div>
                  </div>
                </div>
              </div>

              {editOpen && (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold text-slate-800">Editar</div>

                  <div className="mt-3 grid gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Complejo</label>
                      <select
                        value={editLocationId}
                        onChange={(e) => {
                          setEditLocationId(e.target.value);
                          setEditCourtId("");
                        }}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40"
                      >
                        <option value="">Selecciona un complejo</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name ?? l.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Cancha</label>
                      <select
                        value={editCourtId}
                        onChange={(e) => setEditCourtId(e.target.value)}
                        disabled={!editLocationId}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40 disabled:opacity-50"
                      >
                        <option value="">
                          {editLocationId ? "Selecciona una cancha" : "Selecciona un complejo primero"}
                        </option>
                        {(editLocationId ? courts.filter((c) => c.location_id === editLocationId) : courts).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Fecha</label>
                        <input
                          type="date"
                          value={editDay}
                          onChange={(e) => setEditDay(e.target.value)}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Hora disponible</label>
                        <select
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          disabled={!editCourtId || !editDay || editAvailableTimes.length === 0}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40 disabled:opacity-50"
                        >
                          <option value="">
                            {!editCourtId
                              ? "Selecciona una cancha"
                              : !editDay
                              ? "Selecciona una fecha"
                              : editAvailableTimes.length
                              ? "Selecciona una hora"
                              : "Sin horarios"}
                          </option>
                          {editAvailableTimes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1 text-[11px] text-slate-500">Rango permitido: 06:00 a 23:00</div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Profesor</label>
                      <select
                        value={editCoachId}
                        onChange={(e) => setEditCoachId(e.target.value)}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40"
                      >
                        <option value="">Selecciona un profesor</option>
                        {coaches.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name ?? c.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Alumnos (1 a 4)</label>
                      <Popover open={editStudentsPopoverOpen} onOpenChange={setEditStudentsPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full justify-between text-sm font-normal">
                            <span className="truncate mr-2">
                              {editSelectedStudents.length === 0
                                ? "Selecciona hasta 4 alumnos"
                                : editSelectedStudents.length === 1
                                ? "1 alumno seleccionado"
                                : `${editSelectedStudents.length} alumnos seleccionados`}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3" align="start">
                          <div className="space-y-2">
                            <Input
                              type="text"
                              placeholder="Buscar alumnos..."
                              value={editStudentQuery}
                              onChange={(e) => setEditStudentQuery(e.target.value)}
                              className="h-11 text-base"
                            />
                            <div className="max-h-52 overflow-auto border rounded-md divide-y">
                              {(() => {
                                const filtered = students.filter((s) => {
                                  const t = (editStudentQuery || "").toLowerCase();
                                  if (!t) return true;
                                  const label = `${s.full_name ?? ""} ${s.notes ?? ""} ${s.level ?? ""} ${s.id}`;
                                  return label.toLowerCase().includes(t);
                                });
                                const limited = filtered.slice(0, 50);
                                if (students.length === 0) {
                                  return <div className="px-2 py-1.5 text-xs text-gray-500">No hay alumnos.</div>;
                                }
                                if (filtered.length === 0) {
                                  return (
                                    <div className="px-2 py-1.5 text-xs text-gray-500">
                                      No se encontraron alumnos con ese criterio.
                                    </div>
                                  );
                                }
                                return (
                                  <>
                                    {limited.map((s) => {
                                      const id = s.id;
                                      const checked = editSelectedStudents.includes(id);
                                      const remaining = remainingByStudent[id];
                                      const toggle = () => {
                                        if (!checked && editSelectedStudents.length >= 4) {
                                          toast.error("Máximo 4 alumnos por clase");
                                          return;
                                        }
                                        setEditSelectedStudents((prev) => (checked ? prev.filter((x) => x !== id) : [...prev, id]));
                                      };
                                      return (
                                        <button
                                          key={id}
                                          type="button"
                                          onClick={toggle}
                                          className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                        >
                                          <span className="truncate mr-2">
                                            {s.full_name ?? s.notes ?? s.level ?? s.id}
                                            <span
                                              className={
                                                "ml-1 tabular-nums " +
                                                (remaining === undefined
                                                  ? "text-gray-400"
                                                  : remaining > 0
                                                  ? "text-emerald-600"
                                                  : "text-red-600")
                                              }
                                            >
                                              ({remaining === undefined ? (remainingLoading ? "…" : "…") : remaining})
                                            </span>
                                          </span>
                                          <input
                                            type="checkbox"
                                            readOnly
                                            checked={checked}
                                            className="h-3.5 w-3.5 rounded border-gray-300"
                                          />
                                        </button>
                                      );
                                    })}
                                    {filtered.length > limited.length && (
                                      <div className="px-2 py-1.5 text-[11px] text-gray-500 bg-slate-50">
                                        Mostrando los primeros {limited.length} alumnos.
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <p className="text-[11px] text-gray-500">Se actualizarán las reservas según los alumnos seleccionados.</p>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              )}

              {attendanceOpen && (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold text-slate-800">Asistencia</div>
                  <div className="mt-3 space-y-2">
                    {attendanceLoading ? (
                      <div className="text-xs text-slate-500">Cargando...</div>
                    ) : attendanceList.length === 0 ? (
                      <div className="text-xs text-slate-500">No hay alumnos para marcar.</div>
                    ) : (
                      <div className="space-y-2">
                        {attendanceList.map((r) => (
                          <button
                            key={r.student_id}
                            type="button"
                            onClick={() =>
                              setAttendanceList((prev) =>
                                prev.map((x) => (x.student_id === r.student_id ? { ...x, present: !x.present } : x))
                              )
                            }
                            className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            <span className="truncate mr-2">{r.label}</span>
                            <input
                              type="checkbox"
                              readOnly
                              checked={r.present}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-600">Sin detalles.</div>
          )}

          <DialogFooter className="sticky bottom-0 bg-white border-t pt-3 pb-4">
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDetailsOpen(false);
                }}
              >
                Cerrar
              </Button>

              {detailsEvent?.props?.kind === "class_session" && (
                <div className="flex items-center gap-2">
                  {(role === "admin" ||
                    (role === "coach" &&
                      coachSelfId &&
                      (detailsEvent?.props?.classSession?.coach_id as string | null | undefined) === coachSelfId)) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={onConfirmCancel}
                      disabled={cancelling || rescheduling}
                    >
                      {cancelling ? "Cancelando..." : "Cancelar"}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant={editOpen ? "default" : "outline"}
                    onClick={() => {
                      if (editOpen) resetEditForm();
                      else void onStartEdit();
                    }}
                    disabled={savingEdit || cancelling || role === "super_admin" || role === "student"}
                  >
                    Editar
                  </Button>
                  {editOpen && (
                    <Button type="button" onClick={onSaveEdit} disabled={savingEdit || cancelling}>
                      {savingEdit ? "Guardando..." : "Guardar"}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant={attendanceOpen ? "default" : "outline"}
                    onClick={() => {
                      if (attendanceOpen) resetAttendance();
                      else void openAttendance();
                    }}
                    disabled={attendanceSaving || attendanceLoading || role === "super_admin" || role === "student"}
                  >
                    Asistencia
                  </Button>
                  {attendanceOpen && (
                    <Button type="button" onClick={onSaveAttendance} disabled={attendanceSaving || attendanceLoading || cancelling}>
                      {attendanceSaving ? "Guardando..." : "Guardar asistencia"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pastWarningOpen}
        onOpenChange={(open) => {
          setPastWarningOpen(open);
          if (!open) {
            setPastWarningLabel("");
            setPastWarningAllowPast(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md w-[calc(100vw-1.5rem)] sm:w-full max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#0f172a]">Clase en el pasado</DialogTitle>
            <DialogDescription>
              Estás por crear una clase para <strong>{pastWarningLabel || "(fecha/hora)"}</strong>. ¿Querés continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sticky bottom-0 bg-white border-t pt-3 pb-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setPastWarningOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                setPastWarningOpen(false);
                if (pastWarningAllowPast) await onConfirmCreateInternal(true);
              }}
              disabled={creating}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#0f172a]">Nueva clase</DialogTitle>
            <DialogDescription>Duración fija: 60 minutos</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <label className="block text-sm mb-1">Complejo</label>
              <select
                value={createLocationId}
                onChange={(e) => {
                  setCreateLocationId(e.target.value);
                  setCreateCourtId("");
                }}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40"
              >
                <option value="">Selecciona un complejo</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name ?? l.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Cancha</label>
              <select
                value={createCourtId}
                onChange={(e) => setCreateCourtId(e.target.value)}
                disabled={!createLocationId}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40 disabled:opacity-50"
              >
                <option value="">
                  {createLocationId ? "Selecciona una cancha" : "Selecciona un complejo primero"}
                </option>
                {(() => {
                  const list = (createLocationId ? courts.filter((c) => c.location_id === createLocationId) : courts) ?? [];
                  const dayOk = !!createDay;
                  const timeOk = !!createTime;
                  const free = dayOk && timeOk ? new Set(getFreeCourtIdsForSlot(createDay, createTime)) : null;
                  return list.map((c) => {
                    const isFree = !free || free.has(c.id);
                    return (
                      <option key={c.id} value={c.id} disabled={!isFree}>
                        {c.name}{!isFree ? " (ocupada)" : ""}
                      </option>
                    );
                  });
                })()}
              </select>
              {availabilityMode && createDay && createTime && (
                <div className="mt-1 text-[11px] text-slate-500">
                  Libres: {getFreeCourtIdsForSlot(createDay, createTime).length}/{allCourtIds.length}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm mb-1">Fecha</label>
                <input
                  type="date"
                  value={createDay}
                  onChange={(e) => setCreateDay(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Hora disponible</label>
                <select
                  value={createTime}
                  onChange={(e) => setCreateTime(e.target.value)}
                  disabled={!createCourtId || !createDay || availableTimes.length === 0}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40 disabled:opacity-50"
                >
                  <option value="">
                    {!createCourtId
                      ? "Selecciona una cancha"
                      : !createDay
                      ? "Selecciona una fecha"
                      : availableTimes.length
                      ? "Selecciona una hora"
                      : "Sin horarios"}
                  </option>
                  {availableTimes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Profesor</label>
              {role === "coach" ? (
                <div className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-700">
                  {coaches.find((c) => c.id === coachSelfId)?.full_name ?? "Tu cuenta"}
                </div>
              ) : (
                <select
                  value={createCoachId}
                  onChange={(e) => setCreateCoachId(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#38AEB1]/40"
                >
                  <option value="">Selecciona un profesor</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name ?? c.id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm mb-1">Alumnos (1 a 4)</label>
              <Popover open={studentsPopoverOpen} onOpenChange={setStudentsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between text-sm font-normal">
                    <span className="truncate mr-2">
                      {createSelectedStudents.length === 0
                        ? "Selecciona hasta 4 alumnos"
                        : createSelectedStudents.length === 1
                        ? "1 alumno seleccionado"
                        : `${createSelectedStudents.length} alumnos seleccionados`}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-3" align="start">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar alumnos..."
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      className="h-11 text-base"
                    />
                    <div className="max-h-52 overflow-auto border rounded-md divide-y">
                      {(() => {
                        const filtered = students.filter((s) => {
                          const t = (studentQuery || "").toLowerCase();
                          if (!t) return true;
                          const label = `${s.full_name ?? ""} ${s.notes ?? ""} ${s.level ?? ""} ${s.id}`;
                          return label.toLowerCase().includes(t);
                        });
                        const limited = filtered.slice(0, 50);
                        if (students.length === 0) {
                          return <div className="px-2 py-1.5 text-xs text-gray-500">No hay alumnos.</div>;
                        }
                        if (filtered.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              No se encontraron alumnos con ese criterio.
                            </div>
                          );
                        }
                        return (
                          <>
                            {limited.map((s) => {
                              const id = s.id;
                              const checked = createSelectedStudents.includes(id);
                              const remaining = remainingByStudent[id];
                              const toggle = () => {
                                if (!checked && createSelectedStudents.length >= 4) {
                                  toast.error("Máximo 4 alumnos por clase");
                                  return;
                                }
                                setCreateSelectedStudents((prev) =>
                                  checked ? prev.filter((x) => x !== id) : [...prev, id]
                                );
                              };
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={toggle}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <span className="truncate mr-2">
                                    {s.full_name ?? s.notes ?? s.level ?? s.id}
                                    <span
                                      className={
                                        "ml-1 tabular-nums " +
                                        (remaining === undefined
                                          ? "text-gray-400"
                                          : remaining > 0
                                          ? "text-emerald-600"
                                          : "text-red-600")
                                      }
                                    >
                                      ({remaining === undefined ? (remainingLoading ? "…" : "…") : remaining})
                                    </span>
                                  </span>
                                  <input
                                    type="checkbox"
                                    readOnly
                                    checked={checked}
                                    className="h-3.5 w-3.5 rounded border-gray-300"
                                  />
                                </button>
                              );
                            })}
                            {filtered.length > limited.length && (
                              <div className="px-2 py-1.5 text-[11px] text-gray-500 bg-slate-50">
                                Mostrando los primeros {limited.length} alumnos.
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Se crearán reservas para los alumnos seleccionados.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-white border-t pt-3 pb-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirmCreate} disabled={creating}>
              {creating ? "Creando..." : "Crear clase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
