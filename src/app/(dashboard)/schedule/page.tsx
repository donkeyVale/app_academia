"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, CalendarDays } from 'lucide-react';

const iconColor = "#3cadaf";

const IconCalendar = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-5 h-5"
    {...props}
  >
    <rect x="3" y="4" width="18" height="17" rx="2" ry="2" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M3 9h18" stroke={iconColor} strokeWidth="1.6" />
    <path d="M9 3v4" stroke={iconColor} strokeWidth="1.6" />
    <path d="M15 3v4" stroke={iconColor} strokeWidth="1.6" />
  </svg>
);

// Utilidades para manejar fechas en formato yyyy-mm-dd
function parseYmd(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date | null): string {
  if (!date) return 'Selecciona una fecha';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
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
          <span className={selectedDate ? '' : 'text-gray-400'}>
            {formatDisplay(selectedDate)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate ?? undefined}
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

type Court = { id: string; name: string; location_id: string };
type Location = { id: string; name: string };
type Coach = { id: string; user_id: string | null; specialty: string | null; full_name?: string | null };
type ClassSession = {
  id: string;
  date: string;
  type: string;
  capacity: number;
  coach_id: string | null;
  court_id: string | null;
  price_cents: number;
  currency: string;
};
type Student = {
  id: string;
  user_id: string | null;
  level: string | null;
  notes: string | null;
  full_name?: string | null;
};

export default function SchedulePage() {
  const supabase = createClientBrowser();
  const [locations, setLocations] = useState<Location[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [bookingsCount, setBookingsCount] = useState<Record<string, number>>({});
  const [studentsByClass, setStudentsByClass] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [day, setDay] = useState<string>(''); // yyyy-mm-dd
  const [time, setTime] = useState<string>(''); // HH:mm
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  // Tipo y cupo ahora se derivan de la cantidad de alumnos seleccionados
  // type = 'individual' si hay 1 alumno, 'grupal' si 2-4
  const [locationId, setLocationId] = useState<string>('');
  const [courtId, setCourtId] = useState<string>('');
  const [coachId, setCoachId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentQuery, setStudentQuery] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Filters for list
  const [filterLocationId, setFilterLocationId] = useState<string>('');
  const [filterCourtId, setFilterCourtId] = useState<string>('');
  const [filterCoachId, setFilterCoachId] = useState<string>('');
  const [filterStudentId, setFilterStudentId] = useState<string>('');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'none' | 'sede' | 'profesor' | 'alumno' | 'fecha'>('none');
  // Search text inside filter dropdowns (to avoid listas muy largas)
  const [locationFilterSearch, setLocationFilterSearch] = useState('');
  const [courtFilterSearch, setCourtFilterSearch] = useState('');
  const [coachFilterSearch, setCoachFilterSearch] = useState('');
  const [studentFilterSearch, setStudentFilterSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      // Load locations
      const { data: locs, error: eLoc } = await supabase
        .from('locations')
        .select('id,name')
        .order('name');
      if (eLoc) setError(eLoc.message);
      setLocations(locs ?? []);

      // Load all courts (filtered client-side by location)
      const { data: courtsData, error: e1 } = await supabase
        .from('courts')
        .select('id,name,location_id')
        .order('name');
      if (e1) setError(e1.message);
      setCourts((courtsData as any[])?.map((c) => ({ id: c.id, name: c.name, location_id: c.location_id })) ?? []);

      // Load coaches and try to get names from profiles
      const { data: coachesData, error: e2 } = await supabase
        .from('coaches')
        .select('id,user_id,specialty');
      if (e2) setError(e2.message);

      let enriched: Coach[] = coachesData ?? [];
      if (coachesData && coachesData.length) {
        const userIds = coachesData.map((c) => c.user_id).filter(Boolean) as string[];
        if (userIds.length) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          const nameMap = new Map((profilesData ?? []).map((p) => [p.id, p.full_name]));
          enriched = coachesData.map((c) => ({ ...c, full_name: c.user_id ? nameMap.get(c.user_id) ?? null : null }));
        }
      }
      setCoaches(enriched);

      // Load students (for selection)
      const { data: studs, error: eS } = await supabase
        .from('students')
        .select('id, user_id, level, notes')
        .order('created_at', { ascending: false });
      if (eS) setError(eS.message);

      let enrichedStudents: Student[] = (studs as Student[]) ?? [];
      if (enrichedStudents.length > 0) {
        const userIds = Array.from(
          new Set(
            enrichedStudents
              .map((s) => s.user_id)
              .filter((id): id is string => !!id)
          )
        );

        if (userIds.length > 0) {
          const { data: profilesData, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

          if (!profErr && profilesData) {
            const profilesMap = (profilesData as { id: string; full_name: string | null }[]).reduce<Record<string, string | null>>(
              (acc, p) => {
                acc[p.id] = p.full_name;
                return acc;
              },
              {}
            );

            enrichedStudents = enrichedStudents.map((s) => ({
              ...s,
              full_name: s.user_id ? profilesMap[s.user_id] ?? null : null,
            }));
          }
        }
      }

      setStudents(enrichedStudents);

      // Load classes in a safe window (from last 24h to next 14 days) to evitar problemas de zona horaria
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const { data: clsData, error: e3 } = await supabase
        .from('class_sessions')
        .select('*')
        .gte('date', from.toISOString())
        .lte('date', to.toISOString())
        .order('date', { ascending: true })
        .limit(100);
      if (e3) setError(e3.message);
      setClasses(clsData ?? []);
      // Fetch bookings for these classes to compute alumnos count y mapear alumnos por clase
      if ((clsData ?? []).length) {
        const classIds = (clsData ?? []).map((c) => c.id);
        const { data: bData, error: bErr } = await supabase
          .from('bookings')
          .select('id,class_id,student_id')
          .in('class_id', classIds);
        if (!bErr) {
          const map: Record<string, number> = {};
          const byClass: Record<string, string[]> = {};
          (bData ?? []).forEach((b: any) => {
            const cid = b.class_id as string;
            const sid = b.student_id as string;
            map[cid] = (map[cid] || 0) + 1;
            if (!byClass[cid]) byClass[cid] = [];
            if (sid) byClass[cid].push(sid);
          });
          setBookingsCount(map);
          setStudentsByClass(byClass);
        }
      } else {
        setBookingsCount({});
        setStudentsByClass({});
      }
      setLoading(false);
    })();
  }, [supabase]);

  // Compute available time slots for selected court and day (60 min slots)
  useEffect(() => {
    (async () => {
      if (!courtId || !day) {
        setAvailableTimes([]);
        setTime('');
        return;
      }
      // Candidate hours 06:00 - 22:00 inclusive
      const candidates: string[] = [];
      for (let h = 6; h <= 22; h++) {
        const hh = String(h).padStart(2, '0');
        candidates.push(`${hh}:00`);
      }
      const dayStart = new Date(`${day}T00:00:00`);
      const dayEnd = new Date(`${day}T23:59:59`);
      const { data: dayClasses, error } = await supabase
        .from('class_sessions')
        .select('id,date')
        .eq('court_id', courtId)
        .gte('date', dayStart.toISOString())
        .lte('date', dayEnd.toISOString());
      if (error) {
        setError(error.message);
        setAvailableTimes(candidates);
        return;
      }
      const occupied = new Set<string>();
      (dayClasses ?? []).forEach((c) => {
        const d = new Date(c.date);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = '00';
        occupied.add(`${hh}:${mm}`);
      });
      const free = candidates.filter((t) => !occupied.has(t));
      setAvailableTimes(free);
      if (!free.includes(time)) {
        setTime(free[0] || '');
      }
    })();
  }, [supabase, courtId, day]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!courtId || !coachId || !day || !time) {
        setError('Completa cancha, fecha y hora, y profesor');
        setSaving(false);
        return;
      }
      const iso = new Date(`${day}T${time}:00`).toISOString();

      // Revalidar disponibilidad (anti carrera): misma cancha y misma hora
      {
        const { data: clash, error: clashErr } = await supabase
          .from('class_sessions')
          .select('id')
          .eq('court_id', courtId)
          .eq('date', iso)
          .limit(1);
        if (clashErr) {
          setError(clashErr.message);
          setSaving(false);
          return;
        }
        if ((clash ?? []).length > 0) {
          setError('Ese horario ya fue ocupado recientemente. Elegí otra hora.');
          setSaving(false);
          return;
        }
      }

      if (selectedStudents.length < 1) {
        setError('Selecciona al menos 1 alumno (máximo 4).');
        setSaving(false);
        return;
      }
      if (selectedStudents.length > 4) {
        setError('Máximo 4 alumnos por clase.');
        setSaving(false);
        return;
      }

      const derivedCapacity = selectedStudents.length;
      const derivedType: 'individual' | 'grupal' = derivedCapacity === 1 ? 'individual' : 'grupal';

      const { error: insError, data } = await supabase
        .from('class_sessions')
        .insert({
          date: iso,
          type: derivedType,
          capacity: derivedCapacity,
          coach_id: coachId,
          court_id: courtId,
          price_cents: 0,
          currency: 'PYG',
          // NOTE: requiere columna 'notes' en class_sessions. Si no existe aún, quitar esta línea o agregar columna en SQL.
          // @ts-ignore
          notes,
        })
        .select('*')
        .single();
      if (insError) throw insError;
      const createdClass = data as unknown as ClassSession;
      setClasses((prev) => [...prev, createdClass].sort((a, b) => a.date.localeCompare(b.date)));
      await logAudit('create', 'class_session', createdClass.id, {
        date: createdClass.date,
        court_id: createdClass.court_id,
        coach_id: createdClass.coach_id,
        capacity: createdClass.capacity,
        price_cents: createdClass.price_cents,
        currency: createdClass.currency,
        students: selectedStudents,
      });

      // Create bookings for selected students
      if (selectedStudents.length) {
        const rows = selectedStudents.map((sid) => ({ class_id: createdClass.id, student_id: sid, status: 'reserved' }));
        const { error: bErr } = await supabase.from('bookings').insert(rows);
        if (bErr) throw bErr;
        setBookingsCount((prev) => ({ ...prev, [createdClass.id]: selectedStudents.length }));
      }
      // reset full form for next class
      setDay('');
      setTime('');
      // tipo y cupo se recalcularán según alumnos en el próximo uso
      setLocationId('');
      setCourtId('');
      setCoachId('');
      setSelectedStudents([]);
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'Error creando la clase');
    } finally {
      setSaving(false);
    }
  };

  const locationsMap = useMemo(() => Object.fromEntries(locations.map((x) => [x.id, x] as const)), [locations]);
  const courtsMap = useMemo(() => Object.fromEntries(courts.map((x) => [x.id, x] as const)), [courts]);
  const coachesMap = useMemo(() => Object.fromEntries(coaches.map((x) => [x.id, x] as const)), [coaches]);
  const studentsMap = useMemo(() => Object.fromEntries(students.map((x) => [x.id, x] as const)), [students]);
  const filteredClasses = useMemo(() => {
    const now = new Date();
    return classes.filter((cls) => {
      // ocultar clases que ya terminaron: asumimos duración fija 60 minutos
      const startTs = new Date(cls.date).getTime();
      const endTs = startTs + 60 * 60 * 1000;
      if (endTs < now.getTime()) return false;
      if (filterLocationId) {
        const court = courtsMap[cls.court_id || ''];
        if (!court || court.location_id !== filterLocationId) return false;
      }
      if (filterCourtId && cls.court_id !== filterCourtId) return false;
      if (filterCoachId && cls.coach_id !== filterCoachId) return false;
      if (filterStudentId) {
        const studentsForClass = studentsByClass[cls.id] ?? [];
        if (!studentsForClass.includes(filterStudentId)) return false;
      }
      if (filterFrom) {
        const fromTs = new Date(filterFrom).getTime();
        if (new Date(cls.date).getTime() < fromTs) return false;
      }
      if (filterTo) {
        const toTs = new Date(filterTo).getTime();
        if (new Date(cls.date).getTime() > toTs) return false;
      }
      return true;
    });
  }, [
    classes,
    courtsMap,
    studentsByClass,
    filterLocationId,
    filterCourtId,
    filterCoachId,
    filterStudentId,
    filterFrom,
    filterTo,
  ]);

  // Clases recientes (últimas 6h) que ya terminaron, para poder marcar asistencia aunque pasaron los 60 minutos
  const recentClasses = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    return classes.filter((cls) => {
      const startTs = new Date(cls.date).getTime();
      const endTs = startTs + 60 * 60 * 1000;
      // ya terminadas
      if (endTs >= now.getTime()) return false;
      // solo últimas 24h
      if (startTs < cutoff.getTime()) return false;
      return true;
    });
  }, [classes]);

  // Edit modal state
  const [editing, setEditing] = useState<ClassSession | null>(null);
  const [editCourtId, setEditCourtId] = useState<string>('');
  const [editDay, setEditDay] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [editAvailableTimes, setEditAvailableTimes] = useState<string[]>([]);
  const [editCoachId, setEditCoachId] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStudentQuery, setEditStudentQuery] = useState<string>('');
  const [editSelectedStudents, setEditSelectedStudents] = useState<string[]>([]);
  const [editExistingStudents, setEditExistingStudents] = useState<string[]>([]);

  // Attendance modal state
  const [attendanceClass, setAttendanceClass] = useState<ClassSession | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceList, setAttendanceList] = useState<{
    student_id: string;
    present: boolean;
    label: string;
  }[]>([]);

  // UI: secciones plegables para reducir scroll
  const [showCreateSection, setShowCreateSection] = useState(true);
  const [showUpcomingSection, setShowUpcomingSection] = useState(false);
  const [showRecentSection, setShowRecentSection] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  // Aplicar filtros iniciales según scope=today|week en la URL (lado cliente)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const scope = params.get('scope');
    if (!scope) return;

    const now = new Date();

    if (scope === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
      setFilterFrom(toLocalInput(start));
      setFilterTo(toLocalInput(end));
      setShowUpcomingSection(true);
    } else if (scope === 'week') {
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay(); // 0=Domingo
      const diffToMonday = (dayOfWeek + 6) % 7; // lunes como inicio
      weekStart.setDate(weekStart.getDate() - diffToMonday);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
      setFilterFrom(toLocalInput(weekStart));
      setFilterTo(toLocalInput(weekEnd));
      setShowUpcomingSection(true);
    }
  }, []);

  // Open edit with prefill
  const openEdit = (cls: ClassSession) => {
    setEditing(cls);
    setEditCourtId(cls.court_id || '');
    const d = new Date(cls.date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = '00';
    setEditDay(`${yyyy}-${mm}-${dd}`);
    setEditTime(`${hh}:${min}`);
    setEditCoachId(cls.coach_id || '');
    // @ts-ignore
    setEditNotes((cls as any).notes || '');
    setEditStudentQuery('');
    setEditSelectedStudents([]);
    setEditExistingStudents([]);
  };

  // Load existing bookings for editing class
  useEffect(() => {
    (async () => {
      if (!editing) return;
      const { data: bData } = await supabase
        .from('bookings')
        .select('student_id')
        .eq('class_id', editing.id);
      const current = (bData ?? []).map((b: any) => b.student_id as string);
      setEditExistingStudents(current);
      setEditSelectedStudents(current);
    })();
  }, [supabase, editing]);

  const openAttendance = async (cls: ClassSession) => {
    setAttendanceClass(cls);
    setAttendanceLoading(true);
    setError(null);
    try {
      // Load bookings with basic student info
      const { data: bookingsData, error: bErr } = await supabase
        .from('bookings')
        .select('student_id, students(id, level, notes)')
        .eq('class_id', cls.id);
      if (bErr) throw bErr;

      const { data: attData, error: aErr } = await supabase
        .from('attendance')
        .select('student_id, present')
        .eq('class_id', cls.id);
      if (aErr) throw aErr;

      const attMap = new Map((attData ?? []).map((a: any) => [a.student_id as string, !!a.present]));

      const list = (bookingsData ?? []).map((b: any) => {
        const s = b.students;
        const studentInfo = students.find((stu) => stu.id === b.student_id);
        const label =
          (studentInfo?.full_name || '') ||
          (s?.notes || '') ||
          (s?.level || '') ||
          s?.id ||
          b.student_id;
        return {
          student_id: b.student_id as string,
          present: attMap.get(b.student_id) ?? false,
          label,
        };
      });

      setAttendanceList(list);
    } catch (e: any) {
      setError(e.message || 'Error cargando asistencia');
      setAttendanceList([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const onSaveAttendance = async () => {
    if (!attendanceClass) return;
    setAttendanceSaving(true);
    setError(null);
    try {
      // Validar que cada alumno presente tenga un plan con saldo disponible
      const presentRows = attendanceList.filter((r) => r.present);
      const planByStudent: Record<string, string> = {};
      for (const row of presentRows) {
        const { data: plans, error: planErr } = await supabase
          .from('student_plans')
          .select('id, remaining_classes, purchased_at')
          .eq('student_id', row.student_id)
          .gt('remaining_classes', 0)
          .order('purchased_at', { ascending: true })
          .limit(1);
        if (planErr) throw planErr;
        if (!plans || plans.length === 0) {
          throw new Error(`El alumno no tiene clases disponibles en sus planes. (${row.label})`);
        }
        const plan = plans[0];

        // Verificar cuántas clases ya usó de ese plan
        const { data: usageData, error: usageCountErr } = await supabase
          .from('plan_usages')
          .select('id', { count: 'exact', head: true })
          .eq('student_plan_id', plan.id);
        if (usageCountErr) throw usageCountErr;
        const used = (usageData as any)?.length ?? 0;
        if (used >= (plan.remaining_classes as number)) {
          throw new Error(`El alumno ya utilizó todas las clases de su plan. (${row.label})`);
        }

        planByStudent[row.student_id] = plan.id as string;
      }

      // Simple approach: remove previous attendance for this class and insert fresh snapshot
      const { error: delErr } = await supabase
        .from('attendance')
        .delete()
        .eq('class_id', attendanceClass.id);
      if (delErr) throw delErr;

      if (attendanceList.length) {
        const rows = attendanceList.map((row) => ({
          class_id: attendanceClass.id,
          student_id: row.student_id,
          present: row.present,
        }));
        const { error: insErr } = await supabase.from('attendance').insert(rows);
        if (insErr) throw insErr;

        // Sincronizar plan_usages: upsert para presentes y eliminar para ausentes
        if (presentRows.length) {
          const usageRows = presentRows.map((row) => ({
            student_plan_id: planByStudent[row.student_id],
            class_id: attendanceClass.id,
            student_id: row.student_id,
          }));
          const { error: usageErr } = await supabase
            .from('plan_usages')
            .upsert(usageRows, { onConflict: 'student_id,class_id' });
          if (usageErr) throw usageErr;
        }
        const absentRows = attendanceList.filter((r) => !r.present);
        if (absentRows.length) {
          const absentIds = absentRows.map((r) => r.student_id);
          const { error: delUsageErr } = await supabase
            .from('plan_usages')
            .delete()
            .eq('class_id', attendanceClass.id)
            .in('student_id', absentIds);
          if (delUsageErr) throw delUsageErr;
        }

        await logAudit('attendance_update', 'class_session', attendanceClass.id, {
          attendance: rows,
        });
      }

      setAttendanceClass(null);
    } catch (e: any) {
      setError(e.message || 'Error guardando asistencia');
    } finally {
      setAttendanceSaving(false);
    }
  };

  // Compute available time slots for edit (exclude current class id from occupied)
  useEffect(() => {
    (async () => {
      if (!editing || !editCourtId || !editDay) {
        setEditAvailableTimes([]);
        return;
      }
      const candidates: string[] = [];
      for (let h = 6; h <= 22; h++) candidates.push(`${String(h).padStart(2, '0')}:00`);
      const dayStart = new Date(`${editDay}T00:00:00`);
      const dayEnd = new Date(`${editDay}T23:59:59`);
      const { data: dayClasses, error } = await supabase
        .from('class_sessions')
        .select('id,date')
        .eq('court_id', editCourtId)
        .gte('date', dayStart.toISOString())
        .lte('date', dayEnd.toISOString());
      if (error) {
        setError(error.message);
        setEditAvailableTimes(candidates);
        return;
      }
      const occupied = new Set<string>();
      (dayClasses ?? []).forEach((c) => {
        if (c.id === editing.id) return; // permitir su propio horario
        const d = new Date(c.date);
        const hh = String(d.getHours()).padStart(2, '0');
        occupied.add(`${hh}:00`);
      });
      const free = candidates.filter((t) => !occupied.has(t));
      setEditAvailableTimes(free);
      if (!free.includes(editTime)) {
        setEditTime(free[0] || '');
      }
    })();
  }, [supabase, editing, editCourtId, editDay]);

  const onSaveEdit = async () => {
    if (!editing) return;
    if (!editCourtId || !editCoachId || !editDay || !editTime) {
      setError('Completa cancha, fecha, hora y profesor');
      return;
    }
    if (editSelectedStudents.length < 1) {
      setError('Selecciona al menos 1 alumno (máximo 4).');
      return;
    }
    if (editSelectedStudents.length > 4) {
      setError('Máximo 4 alumnos por clase.');
      return;
    }
    setSaving(true);
    try {
      const iso = new Date(`${editDay}T${editTime}:00`).toISOString();
      // anti-race: ensure no other class at same time/court
      const { data: clash, error: clashErr } = await supabase
        .from('class_sessions')
        .select('id')
        .eq('court_id', editCourtId)
        .eq('date', iso)
        .neq('id', editing.id)
        .limit(1);
      if (clashErr) throw clashErr;
      if ((clash ?? []).length > 0) {
        setError('Ese horario ya fue ocupado recientemente. Elegí otra hora.');
        setSaving(false);
        return;
      }

      const derivedCapacity = editSelectedStudents.length;
      const derivedType: 'individual' | 'grupal' = derivedCapacity === 1 ? 'individual' : 'grupal';

      const updates: any = {
        date: iso,
        court_id: editCourtId,
        coach_id: editCoachId,
        capacity: derivedCapacity,
        type: derivedType,
      };
      // @ts-ignore
      updates.notes = editNotes;

      const { data: upd, error: updErr } = await supabase
        .from('class_sessions')
        .update(updates)
        .eq('id', editing.id)
        .select('*')
        .maybeSingle();
      if (updErr) throw updErr;
      if (!upd) {
        throw new Error('No se pudo actualizar la clase (verifica permisos RLS para UPDATE)');
      }

      // Compute bookings diff
      const before = new Set(editExistingStudents);
      const after = new Set(editSelectedStudents);
      const toAdd = Array.from(after).filter((id) => !before.has(id));
      const toRemove = Array.from(before).filter((id) => !after.has(id));

      if (toAdd.length) {
        const rows = toAdd.map((sid) => ({ class_id: editing.id, student_id: sid, status: 'reserved' }));
        const { error: addErr } = await supabase.from('bookings').insert(rows);
        if (addErr) throw addErr;
      }
      if (toRemove.length) {
        const { error: delErr } = await supabase
          .from('bookings')
          .delete()
          .eq('class_id', editing.id)
          .in('student_id', toRemove);
        if (delErr) throw delErr;
      }

      await logAudit('update', 'class_session', editing.id, { ...updates, add_students: toAdd, remove_students: toRemove });

      const updated = upd as unknown as ClassSession;
      setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.date.localeCompare(b.date)));
      setBookingsCount((prev) => ({ ...prev, [editing.id]: editSelectedStudents.length }));
      setEditing(null);
    } catch (e: any) {
      setError(e.message || 'Error guardando cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4 overflow-x-hidden">
      <div className="flex items-center gap-2">
        <IconCalendar />
        <h1 className="text-2xl font-semibold text-[#31435d]">Agenda</h1>
      </div>

      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowCreateSection((v) => !v)}
        >
          <span className="inline-flex items-center gap-2 text-[#31435d]">
            <Clock className="w-4 h-4 text-emerald-500" />
            Crear nueva clase
          </span>
          <span className="text-xs text-gray-500">{showCreateSection ? '▼' : '▲'}</span>
        </button>
        <AnimatePresence initial={false}>
          {showCreateSection && (
            <motion.form
              key="create-class-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onSubmit={onCreate}
              className="grid gap-3 max-w-xl p-4 origin-top"
            >
              <div>
                <label className="block text-sm mb-1">Complejo</label>
                <Select
                  value={locationId}
                  onValueChange={(val) => {
                    setLocationId(val);
                    setCourtId('');
                  }}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Selecciona un complejo" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Primero: Cancha */}
              <div>
                <label className="block text-sm mb-1">Cancha</label>
                <Select
                  value={courtId}
                  onValueChange={(val) => setCourtId(val)}
                  disabled={!locationId}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder={locationId ? 'Selecciona una cancha' : 'Selecciona un complejo primero'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(locationId ? courts.filter((c) => c.location_id === locationId) : courts).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Luego: Fecha y Hora disponible */}
              <div>
                <label className="block text-sm mb-1">Fecha</label>
                <DatePickerField value={day} onChange={setDay} />
                <p className="text-xs text-gray-500 mt-1">Duración fija: 60 minutos</p>
              </div>
              <div>
                <label className="block text-sm mb-1">Hora disponible</label>
                <Select
                  value={time}
                  onValueChange={(val) => setTime(val)}
                  disabled={!courtId || !day || availableTimes.length === 0}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue
                      placeholder={
                        !courtId
                          ? 'Selecciona una cancha'
                          : !day
                          ? 'Selecciona una fecha'
                          : availableTimes.length
                          ? 'Selecciona una hora'
                          : 'Sin horarios disponibles'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {courtId && day && availableTimes.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    No hay horarios disponibles para esta cancha en el día seleccionado.
                  </p>
                )}
              </div>
              {/* Tipo y cupo ahora se derivan de la cantidad de alumnos seleccionados (1-4) */}
              <div>
                <label className="block text-sm mb-1">Profesor</label>
                <Select
                  value={coachId}
                  onValueChange={(val) => setCoachId(val)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Selecciona un profesor" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name ?? 'Coach'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm mb-1">Notas / Descripción</label>
                <textarea
                  className="border rounded p-2 w-full h-20"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej.: Clase grupal nivel intermedio"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Alumnos (selección múltiple)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between text-sm font-normal"
                    >
                      <span className="truncate mr-2">
                        {selectedStudents.length === 0
                          ? 'Selecciona hasta 4 alumnos'
                          : selectedStudents.length === 1
                          ? '1 alumno seleccionado'
                          : `${selectedStudents.length} alumnos seleccionados`}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
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
                            const t = (studentQuery || '').toLowerCase();
                            if (!t) return true;
                            const label =
                              (s.full_name || '') +
                              ' ' +
                              (s.notes || '') +
                              ' ' +
                              (s.level || '') +
                              ' ' +
                              s.id;
                            return label.toLowerCase().includes(t);
                          });
                          const limited = filtered.slice(0, 50);
                          if (students.length === 0) {
                            return (
                              <div className="px-2 py-1.5 text-xs text-gray-500">
                                No hay alumnos cargados.
                              </div>
                            );
                          }
                          if (filtered.length === 0) {
                            return (
                              <div className="px-2 py-1.5 text-xs text-gray-500">
                                No se encontraron alumnos con ese criterio de búsqueda.
                              </div>
                            );
                          }
                          return (
                            <>
                              {limited.map((s) => {
                                const id = s.id;
                                const checked = selectedStudents.includes(id);
                                const toggle = () => {
                                  if (!checked && selectedStudents.length >= 4) {
                                    alert('Máximo 4 alumnos por clase');
                                    return;
                                  }
                                  setSelectedStudents((prev) =>
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
                                  Mostrando los primeros {limited.length} alumnos. Refiná la búsqueda para ver otros.
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Podés seleccionar entre 1 y 4 alumnos. Se crearán reservas para los alumnos
                        seleccionados.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50" disabled={saving}>
          {saving ? 'Creando...' : 'Crear clase'}
        </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowUpcomingSection((v) => !v)}
        >
          <span className="inline-flex items-center gap-2 text-[#31435d]">
            <CalendarDays className="w-4 h-4 text-sky-500" />
            Próximas clases programadas
          </span>
          <span className="text-xs text-gray-500">{showUpcomingSection ? '▼' : '▲'}</span>
        </button>
        {showUpcomingSection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-6 p-4 origin-top"
          >
            <div className="space-y-1 max-w-full">
              <h2 className="text-lg font-semibold text-[#31435d]">Próximas clases programadas</h2>
              <p className="text-xs text-gray-600">
                Revisá y filtrá las clases que aún no se dictaron para organizar tu agenda.
              </p>
            </div>
            <div className="space-y-2 p-3 border rounded-lg bg-[#f0f9fb] max-w-full w-full overflow-hidden">
              <div className="grid gap-2 md:grid-cols-5 items-end w-full max-w-full">
                <div>
                  <label className="block text-xs mb-1 font-semibold">Filtrar por</label>
                  <Select
                    value={filterMode}
                    onValueChange={(mode) => {
                      const typed = mode as typeof filterMode;
                      setFilterMode(typed);
                      setFilterLocationId('');
                      setFilterCourtId('');
                      setFilterCoachId('');
                      setFilterStudentId('');
                      setFilterFrom('');
                      setFilterTo('');
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Sin filtro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin filtro</SelectItem>
                      <SelectItem value="sede">Sede / Cancha</SelectItem>
                      <SelectItem value="profesor">Profesor</SelectItem>
                      <SelectItem value="alumno">Alumno</SelectItem>
                      <SelectItem value="fecha">Fecha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            {filterMode === 'sede' && (
              <>
                <div>
                  <label className="block text-xs mb-1">Sede</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between h-9 px-2 text-xs font-normal"
                      >
                        <span className="truncate mr-2">
                          {filterLocationId
                            ? locations.find((l) => l.id === filterLocationId)?.name || 'Sede seleccionada'
                            : 'Todas las sedes'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Buscar sede..."
                          value={locationFilterSearch}
                          onChange={(e) => setLocationFilterSearch(e.target.value)}
                          className="h-10 text-base"
                        />
                        <div className="max-h-52 overflow-auto border rounded-md divide-y text-sm">
                          <button
                            type="button"
                            onClick={() => {
                              setFilterLocationId('');
                              setFilterCourtId('');
                            }}
                            className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                          >
                            Todas las sedes
                          </button>
                          {locations
                            .filter((l) =>
                              !locationFilterSearch
                                ? true
                                : l.name.toLowerCase().includes(locationFilterSearch.toLowerCase())
                            )
                            .map((l) => (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => setFilterLocationId(l.id)}
                                className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                              >
                                {l.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="block text-xs mb-1">Cancha</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between h-9 px-2 text-xs font-normal"
                        disabled={!filterLocationId}
                      >
                        <span className="truncate mr-2">
                          {filterCourtId
                            ? courts.find((c) => c.id === filterCourtId)?.name || 'Cancha seleccionada'
                            : 'Todas las canchas'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Buscar cancha..."
                          value={courtFilterSearch}
                          onChange={(e) => setCourtFilterSearch(e.target.value)}
                          className="h-10 text-base"
                        />
                        <div className="max-h-52 overflow-auto border rounded-md divide-y text-sm">
                          <button
                            type="button"
                            onClick={() => setFilterCourtId('')}
                            className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                          >
                            Todas las canchas
                          </button>
                          {courts
                            .filter((c) => !filterLocationId || c.location_id === filterLocationId)
                            .filter((c) =>
                              !courtFilterSearch
                                ? true
                                : c.name.toLowerCase().includes(courtFilterSearch.toLowerCase())
                            )
                            .map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setFilterCourtId(c.id)}
                                className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                              >
                                {c.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
            {filterMode === 'profesor' && (
              <div>
                <label className="block text-xs mb-1">Profesor</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between h-9 px-2 text-xs font-normal"
                    >
                      <span className="truncate mr-2">
                        {filterCoachId
                          ? coaches.find((c) => c.id === filterCoachId)?.full_name || 'Profesor seleccionado'
                          : 'Todos los profesores'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Buscar profesor..."
                        value={coachFilterSearch}
                        onChange={(e) => setCoachFilterSearch(e.target.value)}
                        className="h-10 text-base"
                      />
                      <div className="max-h-52 overflow-auto border rounded-md divide-y text-xs">
                        <button
                          type="button"
                          onClick={() => setFilterCoachId('')}
                          className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                        >
                          Todos los profesores
                        </button>
                        {coaches
                          .filter((c) => {
                            if (!coachFilterSearch) return true;
                            const label = (c.full_name || 'Coach').toLowerCase();
                            return label.includes(coachFilterSearch.toLowerCase());
                          })
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setFilterCoachId(c.id)}
                              className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                            >
                              {c.full_name ?? 'Coach'}
                            </button>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {filterMode === 'alumno' && (
              <div>
                <label className="block text-xs mb-1">Alumno</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between h-9 px-2 text-xs font-normal"
                    >
                      <span className="truncate mr-2">
                        {filterStudentId
                          ? students.find((s) => s.id === filterStudentId)?.full_name || 'Alumno seleccionado'
                          : 'Todos los alumnos'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Buscar alumno..."
                        value={studentFilterSearch}
                        onChange={(e) => setStudentFilterSearch(e.target.value)}
                        className="h-10 text-base"
                      />
                      <div className="max-h-52 overflow-auto border rounded-md divide-y text-xs">
                        <button
                          type="button"
                          onClick={() => setFilterStudentId('')}
                          className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                        >
                          Todos los alumnos
                        </button>
                        {students
                          .filter((s) => {
                            if (!studentFilterSearch) return true;
                            const label =
                              (s.full_name || '') +
                              ' ' +
                              (s.notes || '') +
                              ' ' +
                              (s.level || '') +
                              ' ' +
                              s.id;
                            return label.toLowerCase().includes(studentFilterSearch.toLowerCase());
                          })
                          .map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setFilterStudentId(s.id)}
                              className="w-full px-2 py-1.5 text-left hover:bg-slate-50"
                            >
                              {s.full_name ?? s.notes ?? s.level ?? s.id}
                            </button>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {filterMode === 'fecha' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs mb-1">Rápido</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-[#3cadaf] text-[#3cadaf] hover:bg-[#e6f5f6]"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(now);
                        end.setHours(23, 59, 59, 999);
                        const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
                        setFilterFrom(toLocalInput(start));
                        setFilterTo(toLocalInput(end));
                      }}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-[#3cadaf] text-[#3cadaf] hover:bg-[#e6f5f6]"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(now);
                        end.setDate(end.getDate() + 7);
                        end.setHours(23, 59, 59, 999);
                        const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
                        setFilterFrom(toLocalInput(start));
                        setFilterTo(toLocalInput(end));
                      }}
                    >
                      Próximos 7 días
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      onClick={() => {
                        setFilterFrom('');
                        setFilterTo('');
                      }}
                    >
                      Quitar rango
                    </button>
                  </div>
                </div>
                <div className="min-w-0 w-full pr-1">
                  <label className="block text-xs mb-1">Desde</label>
                  <DatePickerField
                    value={filterFrom ? filterFrom.slice(0, 10) : ''}
                    onChange={(value) => {
                      if (!value) {
                        setFilterFrom('');
                        return;
                      }
                      // Usamos inicio de día para el filtro "Desde"
                      setFilterFrom(`${value}T00:00`);
                    }}
                  />
                </div>
                <div className="min-w-0 w-full pr-1">
                  <label className="block text-xs mb-1">Hasta</label>
                  <DatePickerField
                    value={filterTo ? filterTo.slice(0, 10) : ''}
                    onChange={(value) => {
                      if (!value) {
                        setFilterTo('');
                        return;
                      }
                      // Usamos fin de día para el filtro "Hasta"
                      setFilterTo(`${value}T23:59`);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-gray-600">Cargando clases...</p>
        ) : filteredClasses.length === 0 ? (
          <p className="text-sm text-gray-600">
            No hay clases programadas para los filtros seleccionados. Probá quitar o cambiar los filtros.
          </p>
        ) : (
          <>
          <ul className="space-y-3 max-w-full">
            {(showAllUpcoming ? filteredClasses : filteredClasses.slice(0, 5)).map((cls) => {
              const court = courtsMap[cls.court_id || ''];
              const location = court ? locationsMap[court.location_id] : undefined;
              const coach = coachesMap[cls.coach_id || ''];
              const alumnos = bookingsCount[cls.id] ?? 0;

              const d = new Date(cls.date);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const hh = String(d.getHours()).padStart(2, '0');
              const min = String(d.getMinutes()).padStart(2, '0');

              const tipoLabel = cls.type === 'individual' ? 'Individual' : 'Grupal';

              return (
                <li
                  key={cls.id}
                  className="text-sm border rounded-lg p-3 bg-white shadow-sm max-w-full overflow-hidden transition hover:shadow-md hover:border-[#dbeafe]"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 max-w-full">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-medium text-[#075985]">
                          {dd}/{mm}/{yyyy} • {hh}:{min}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {location?.name ?? 'Sede sin asignar'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p className="truncate">
                          <span className="font-semibold text-slate-700">Cancha:</span> {court?.name ?? '-'}
                        </p>
                        <p className="truncate">
                          <span className="font-semibold text-slate-700">Profesor:</span> {coach?.full_name ?? 'Coach'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " +
                              (cls.type === 'individual'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-100')
                            }
                          >
                            {tipoLabel}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 text-[11px] font-medium">
                            {alumnos}/{cls.capacity} alumnos
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
                      <button
                        className="text-[11px] sm:text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                        onClick={async () => {
                          if (!confirm('¿Cancelar y eliminar esta clase? Se eliminarán reservas y asistencias asociadas.')) return;
                          const { error: delErr } = await supabase.from('class_sessions').delete().eq('id', cls.id);
                          if (delErr) {
                            alert('Error al cancelar: ' + delErr.message);
                            return;
                          }
                          await logAudit('delete', 'class_session', cls.id, {
                            date: cls.date,
                            court_id: cls.court_id,
                            coach_id: cls.coach_id,
                            capacity: cls.capacity,
                            price_cents: cls.price_cents,
                            currency: cls.currency,
                          });
                          setClasses((prev) => prev.filter((c) => c.id !== cls.id));
                          setBookingsCount((prev) => {
                            const n = { ...prev };
                            delete n[cls.id];
                            return n;
                          });
                        }}
                      >Cancelar</button>
                      <button
                        className="text-[11px] sm:text-xs px-3 py-1 rounded border border-[#3cadaf] text-[#3cadaf] hover:bg-[#e6f5f6]"
                        onClick={() => openAttendance(cls)}
                      >
                        Asistencia
                      </button>
                      <button
                        className="text-[11px] sm:text-xs px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                        onClick={() => openEdit(cls)}
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {filteredClasses.length > 5 && (
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              {!showAllUpcoming && (
                <p>Mostrando las 5 próximas clases filtradas.</p>
              )}
              <button
                type="button"
                className="text-[#3cadaf] hover:underline"
                onClick={() => setShowAllUpcoming((v) => !v)}
              >
                {showAllUpcoming ? 'Ver menos' : 'Ver todas'}
              </button>
            </div>
          )}
          </>
        )}
          </motion.div>
        )}
      </div>

      {recentClasses.length > 0 && (
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
            onClick={() => setShowRecentSection((v) => !v)}
          >
            <span className="inline-flex items-center gap-2 text-[#31435d]">
              <CalendarDays className="h-4 w-4 text-violet-500" />
              Clases recientes para asistencia
            </span>
            <span className="text-xs text-gray-500">{showRecentSection ? '▼' : '▲'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showRecentSection && (
              <motion.div
                key="recent-classes-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="p-4 space-y-4 origin-top"
              >
                <p className="text-xs text-gray-500">
                  Usá esta lista para marcar asistencia en clases que ya terminaron pero aún son recientes (últimas 6 horas).
                </p>
                <ul className="space-y-3">
                {(showAllRecent ? recentClasses : recentClasses.slice(0, 5)).map((cls) => {
                  const d = new Date(cls.date);
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  const hh = String(d.getHours()).padStart(2, '0');
                  const min = String(d.getMinutes()).padStart(2, '0');
                  const court = cls.court_id ? courtsMap[cls.court_id] : undefined;
                  const studentIds = studentsByClass[cls.id] ?? [];
                  const studentsCountLabel = studentIds.length === 0 ? '-' : `${studentIds.length}`;
                  return (
                    <li
                      key={cls.id}
                      className="max-w-full overflow-hidden rounded-lg border bg-white p-3 text-xs shadow-sm transition hover:border-[#dbeafe] hover:shadow-md sm:text-sm"
                    >
                      <div className="flex max-w-full flex-col items-start justify-between gap-2 sm:flex-row">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-medium text-[#075985]">
                              {dd}/{mm}/{yyyy} • {hh}:{min}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                              Cancha: {court?.name ?? '-'}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                              Alumnos: {studentsCountLabel}
                            </span>
                          </div>
                        </div>
                        <div className="flex w-full items-center justify-start gap-2 sm:w-auto sm:justify-end">
                          <button
                            type="button"
                            className="text-[11px] px-3 py-1 rounded bg-[#3cadaf] text-white hover:bg-[#31435d] sm:text-xs"
                            onClick={() => openAttendance(cls)}
                          >
                            Asistencia
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {recentClasses.length > 5 && (
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  {!showAllRecent && <p>Mostrando las 5 clases recientes más cercanas.</p>}
                  <button
                    type="button"
                    className="text-[#3cadaf] hover:underline"
                    onClick={() => setShowAllRecent((v) => !v)}
                  >
                    {showAllRecent ? 'Ver menos' : 'Ver más'}
                  </button>
                </div>
              )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b px-4 pt-4 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-[#31435d]">Editar clase</h3>
                {editing && (
                  <p className="text-xs text-gray-500">
                    Clase del {new Date(editing.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {" "}a las{" "}
                    {new Date(editing.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                onClick={() => setEditing(null)}
              >
                Cerrar
              </button>
            </div>
            <div className="px-4 py-3 overflow-y-auto text-sm">
              <div className="grid gap-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Cancha</label>
                    <Select
                      value={editCourtId}
                      onValueChange={(val) => setEditCourtId(val)}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue
                          placeholder={locationId ? 'Selecciona una cancha' : 'Selecciona un complejo primero'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(locationId ? courts.filter((c) => c.location_id === locationId) : courts).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Profesor</label>
                    <Select
                      value={editCoachId}
                      onValueChange={(val) => setEditCoachId(val)}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Selecciona un profesor" />
                      </SelectTrigger>
                      <SelectContent>
                        {coaches.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name ?? 'Coach'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Fecha</label>
                    <div className="w-full">
                      <DatePickerField value={editDay} onChange={setEditDay} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Hora disponible</label>
                    <select
                      className="w-full rounded border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/50"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      disabled={!editCourtId || !editDay}
                    >
                      <option value="" disabled>
                        {!editCourtId
                          ? 'Selecciona una cancha'
                          : !editDay
                          ? 'Selecciona una fecha'
                          : editAvailableTimes.length
                          ? 'Selecciona una hora'
                          : 'Sin horarios disponibles'}
                      </option>
                      {editAvailableTimes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {editCourtId && editDay && editAvailableTimes.length === 0 && (
                      <p className="mt-1 text-xs text-red-600">
                        No hay horarios disponibles para esta cancha en el día seleccionado.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Notas / Descripción</label>
                  <textarea
                    className="h-20 w-full resize-none rounded border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/50"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Alumnos (selección múltiple)</label>
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar alumnos..."
                      value={editStudentQuery}
                      onChange={(e) => setEditStudentQuery(e.target.value)}
                      className="h-10 text-base"
                    />
                    <div className="max-h-40 overflow-auto rounded-md border text-xs">
                      {students
                        .filter((s) => {
                          const t = (editStudentQuery || '').toLowerCase();
                          if (!t) return true;
                          const label =
                            (s.full_name || '') +
                            ' ' +
                            (s.notes || '') +
                            ' ' +
                            (s.level || '') +
                            ' ' +
                            s.id;
                          return label.toLowerCase().includes(t);
                        })
                        .map((s) => {
                          const id = s.id;
                          const checked = editSelectedStudents.includes(id);
                          const toggle = () => {
                            setEditSelectedStudents((prev) => {
                              if (!checked && prev.length >= 4) {
                                alert('Máximo 4 alumnos por clase');
                                return prev;
                              }
                              return checked
                                ? prev.filter((x) => x !== id)
                                : [...prev, id];
                            });
                          };
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={toggle}
                              className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                            >
                              <span className="mr-2 truncate">
                                {s.full_name ?? s.notes ?? s.level ?? s.id}
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
                      {students.length === 0 && (
                        <div className="px-2 py-1.5 text-[11px] text-gray-500">
                          No hay alumnos cargados.
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Se crearán/eliminarán reservas según los cambios. Máximo 4 alumnos por clase.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t bg-white px-4 py-3 text-sm">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-[#3cadaf] px-3 py-2 text-xs font-medium text-white hover:bg-[#31435d] disabled:opacity-50"
                disabled={saving}
                onClick={onSaveEdit}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {attendanceClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b px-4 pt-4 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-[#31435d]">Asistencia</h3>
                {attendanceClass && (
                  <p className="text-xs text-gray-500">
                    Clase del {new Date(attendanceClass.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {" "}a las{" "}
                    {new Date(attendanceClass.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                onClick={() => setAttendanceClass(null)}
              >
                Cerrar
              </button>
            </div>
            <div className="px-4 py-3 text-sm overflow-y-auto">
              {attendanceLoading ? (
                <p className="text-sm text-gray-600">Cargando alumnos...</p>
              ) : attendanceList.length === 0 ? (
                <p className="text-sm text-gray-600">No hay alumnos reservados para esta clase.</p>
              ) : (
                <ul className="space-y-2">
                  {attendanceList.map((row, idx) => (
                    <li
                      key={row.student_id}
                      className="flex max-w-full flex-row flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="max-w-full break-words font-medium text-slate-800">
                        {row.label}
                      </span>
                      <button
                        type="button"
                        className={
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium border " +
                          (row.present
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-white text-slate-600 border-slate-300")
                        }
                        onClick={() => {
                          setAttendanceList((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], present: !copy[idx].present };
                            return copy;
                          });
                        }}
                      >
                        <span
                          className={
                            "h-2.5 w-2.5 rounded-full " +
                            (row.present ? "bg-emerald-500" : "bg-slate-300")
                          }
                        />
                        <span>{row.present ? "Presente" : "Ausente"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t bg-white px-4 py-3 text-sm">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setAttendanceClass(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-[#3cadaf] px-3 py-2 text-xs font-medium text-white hover:bg-[#31435d] disabled:opacity-50"
                disabled={attendanceSaving}
                onClick={onSaveAttendance}
              >
                {attendanceSaving ? "Guardando..." : "Guardar asistencia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
