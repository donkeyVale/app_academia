"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
  const [allStudentsForLabels, setAllStudentsForLabels] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [bookingsCount, setBookingsCount] = useState<Record<string, number>>({});
  const [studentsByClass, setStudentsByClass] = useState<Record<string, string[]>>({});
  const [attendanceMarkedByClass, setAttendanceMarkedByClass] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'super_admin' | 'admin' | 'coach' | 'student' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [academyLocationIds, setAcademyLocationIds] = useState<Set<string>>(new Set());
  const [currentStudentFullName, setCurrentStudentFullName] = useState<string | null>(null);

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
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([]);
  const [recurringTimesByWeekday, setRecurringTimesByWeekday] = useState<Record<number, string>>({});

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

  // Cargar rol del usuario actual y, si es alumno, su studentId
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id as string | undefined;
        if (!userId) {
          setRole(null);
          setCurrentUserId(null);
          setStudentId(null);
          return;
        }

        setCurrentUserId(userId);

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', userId)
          .maybeSingle();
        if (profErr) {
          console.error('Error cargando perfil en Agenda', profErr);
          setRole(null);
        } else {
          const r = (profile?.role as 'super_admin' | 'admin' | 'coach' | 'student' | null) ?? null;
          setRole(r === 'super_admin' || r === 'admin' || r === 'coach' || r === 'student' ? r : null);
        }

        if (profile?.role === 'student') {
          const { data: studentRow, error: studErr } = await supabase
            .from('students')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (studErr) {
            console.error('Error obteniendo studentId en Agenda', studErr);
            setStudentId(null);
          } else {
            setStudentId((studentRow?.id as string | undefined) ?? null);
            setCurrentStudentFullName((profile as any)?.full_name ?? null);
          }
        } else {
          setStudentId(null);
          setCurrentStudentFullName(null);
        }
      } catch (e) {
        console.error('Error inicializando rol en Agenda', e);
        setRole(null);
        setStudentId(null);
      }
    })();
  }, [supabase]);

  // Cargar academia seleccionada desde localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('selectedAcademyId');
    setSelectedAcademyId(stored && stored.trim() ? stored : null);
  }, []);

  // Cargar locations vinculadas a la academia seleccionada
  useEffect(() => {
    if (!selectedAcademyId) {
      setAcademyLocationIds(new Set());
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('academy_locations')
          .select('location_id')
          .eq('academy_id', selectedAcademyId);
        if (error) {
          console.error('Error cargando academy_locations en Agenda', error);
          setAcademyLocationIds(new Set());
          return;
        }
        const ids = new Set(
          (data as { location_id: string | null }[] | null ?? [])
            .map((row) => row.location_id)
            .filter((id): id is string => !!id)
        );
        setAcademyLocationIds(ids);
      } catch (e) {
        console.error('Error cargando academy_locations en Agenda', e);
        setAcademyLocationIds(new Set());
      }
    })();
  }, [selectedAcademyId, supabase]);

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
      const allLocations = (locs ?? []) as Location[];
      const filteredLocations =
        selectedAcademyId && academyLocationIds.size > 0
          ? allLocations.filter((l) => academyLocationIds.has(l.id))
          : allLocations;
      setLocations(filteredLocations);

      // Load all courts (filtered client-side by location, but we'll also use them to map clases -> sedes)
      const { data: courtsData, error: e1 } = await supabase
        .from('courts')
        .select('id,name,location_id')
        .order('name');
      if (e1) setError(e1.message);
      const courtsArray: Court[] = (courtsData as any[])?.map((c) => ({ id: c.id, name: c.name, location_id: c.location_id })) ?? [];
      setCourts(courtsArray);
      const courtLocationMap = new Map(courtsArray.map((c) => [c.id, c.location_id]));

      // Load coaches and try to get names from profiles
      const { data: coachesData, error: e2 } = await supabase
        .from('coaches')
        .select('id,user_id,specialty');
      if (e2) setError(e2.message);

      let enrichedCoaches: Coach[] = coachesData ?? [];
      if (coachesData && coachesData.length) {
        const userIds = coachesData.map((c) => c.user_id).filter(Boolean) as string[];
        if (userIds.length) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          const nameMap = new Map((profilesData ?? []).map((p) => [p.id, p.full_name]));
          enrichedCoaches = coachesData.map((c) => ({ ...c, full_name: c.user_id ? nameMap.get(c.user_id) ?? null : null }));
        }
      }

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

      // Siempre guardamos todos los alumnos enriquecidos para poder resolver nombres
      // en studentsMap, independientemente de la academia seleccionada.
      setAllStudentsForLabels(enrichedStudents);

      // Si hay academia seleccionada, filtramos coaches y alumnos por user_academies.
      let finalCoaches = enrichedCoaches;
      let finalStudents = enrichedStudents;
      if (selectedAcademyId) {
        const { data: uaRows } = await supabase
          .from('user_academies')
          .select('user_id, role')
          .eq('academy_id', selectedAcademyId);

        const rows = (uaRows as { user_id: string | null; role: string }[] | null) ?? [];

        const coachUserIds = new Set(
          rows
            .filter((r) => r.role === 'coach' && r.user_id)
            .map((r) => r.user_id as string)
        );

        const studentUserIds = new Set(
          rows
            .filter((r) => r.role === 'student' && r.user_id)
            .map((r) => r.user_id as string)
        );

        if (coachUserIds.size > 0) {
          finalCoaches = enrichedCoaches.filter((c) => c.user_id && coachUserIds.has(c.user_id));
        } else {
          finalCoaches = [];
        }

        if (studentUserIds.size > 0) {
          finalStudents = enrichedStudents.filter((s) => s.user_id && studentUserIds.has(s.user_id));
        } else {
          finalStudents = [];
        }
      }

      setCoaches(finalCoaches);
      setStudents(finalStudents);

      // Load classes in a safe window (from last 24h to next 90 days) para poder ver varias clases recurrentes futuras
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const { data: clsData, error: e3 } = await supabase
        .from('class_sessions')
        .select('*')
        .gte('date', from.toISOString())
        .lte('date', to.toISOString())
        .order('date', { ascending: true })
        .limit(500);
      if (e3) setError(e3.message);

      let finalClasses: ClassSession[] = (clsData as ClassSession[]) ?? [];
      if (selectedAcademyId && academyLocationIds.size > 0 && finalClasses.length > 0) {
        finalClasses = finalClasses.filter((cls) => {
          if (!cls.court_id) return false;
          const locId = courtLocationMap.get(cls.court_id) ?? null;
          return !!locId && academyLocationIds.has(locId);
        });
      }

      setClasses(finalClasses);
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

        const { data: attRows, error: attErr } = await supabase
          .from('attendance')
          .select('class_id')
          .in('class_id', classIds);
        if (!attErr) {
          const marked: Record<string, boolean> = {};
          (attRows ?? []).forEach((r: any) => {
            const cid = r.class_id as string | null;
            if (cid) marked[cid] = true;
          });
          setAttendanceMarkedByClass(marked);
        }
      } else {
        setBookingsCount({});
        setStudentsByClass({});
        setAttendanceMarkedByClass({});
      }
      setLoading(false);
    })();
  }, [supabase, selectedAcademyId, academyLocationIds]);

  // Compute available time slots for selected court and day (60 min slots)
  useEffect(() => {
    (async () => {
      if (!courtId || !day) {
        setAvailableTimes([]);
        setTime('');
        return;
      }
      // Candidate hours 06:00 - 23:00 inclusive
      const candidates: string[] = [];
      for (let h = 6; h <= 23; h++) {
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

  const recurringTimeCandidates = useMemo(() => {
    const candidates: string[] = [];
    for (let h = 6; h <= 23; h++) {
      const hh = String(h).padStart(2, '0');
      candidates.push(`${hh}:00`);
    }
    return candidates;
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!courtId || !coachId || !day) {
        const msg = 'Completa cancha, fecha y profesor';
        toast.error(msg);
        setSaving(false);
        return;
      }

      let baseTime = time;
      if (recurringEnabled) {
        if (recurringWeekdays.length === 0) {
          toast.error('Seleccioná al menos un día de la semana para las clases recurrentes.');
          setSaving(false);
          return;
        }

        const missingTimes = recurringWeekdays.filter((wd) => !recurringTimesByWeekday[wd]);
        if (missingTimes.length > 0) {
          toast.error('Seleccioná una hora para cada día de la semana marcado.');
          setSaving(false);
          return;
        }

        // validar rango horario permitido (06:00 a 23:00) para cada weekday
        for (const wd of recurringWeekdays) {
          const t = recurringTimesByWeekday[wd];
          const hour = Number((t || '').split(':')[0] ?? 'NaN');
          if (Number.isNaN(hour) || hour < 6 || hour > 23) {
            toast.error('Horario inválido. Seleccioná una hora entre 06:00 y 23:00.');
            setSaving(false);
            return;
          }
        }

        const baseDate = new Date(`${day}T00:00:00`);
        const baseWd = baseDate.getDay();
        baseTime = recurringTimesByWeekday[baseWd] || '';
        if (!baseTime) {
          toast.error('La fecha seleccionada debe tener una hora asignada en la recurrencia.');
          setSaving(false);
          return;
        }
      } else {
        if (!time) {
          const msg = 'Completa cancha, fecha, hora y profesor';
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

      // Validar rango horario permitido (06:00 a 23:00)
      {
        const hour = Number(baseTime.split(':')[0] ?? 'NaN');
        if (Number.isNaN(hour) || hour < 6 || hour > 23) {
          toast.error('Horario inválido. Seleccioná una hora entre 06:00 y 23:00.');
          setSaving(false);
          return;
        }
      }
      const iso = new Date(`${day}T${baseTime}:00`).toISOString();

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

      // V1: no permitir crear clases en el pasado
      {
        const now = new Date();
        const classStart = new Date(iso);
        if (classStart.getTime() <= now.getTime()) {
          const msg = 'No podés crear una clase en una fecha y hora que ya pasaron.';
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

      if (selectedStudents.length < 1) {
        const msg = 'Selecciona al menos 1 alumno (máximo 4).';
        toast.error(msg);
        setSaving(false);
        return;
      }
      if (selectedStudents.length > 4) {
        const msg = 'Máximo 4 alumnos por clase.';
        toast.error(msg);
        setSaving(false);
        return;
      }

      // V4: Validar que el profesor no tenga otra clase en el mismo horario (en cualquier sede/cancha)
      {
        const { data: coachClash, error: coachClashErr } = await supabase
          .from('class_sessions')
          .select('id')
          .eq('coach_id', coachId)
          .eq('date', iso)
          .limit(1);
        if (coachClashErr) {
          const msg = 'No se pudo verificar la disponibilidad del profesor. Intenta nuevamente.';
          toast.error(msg);
          setSaving(false);
          return;
        }
        if ((coachClash ?? []).length > 0) {
          const coachName = coachesMap[coachId]?.full_name ?? 'el profesor seleccionado';
          const msg = `${coachName} ya tiene una clase en ese horario.`;
          toast.warning(msg);
        }
      }

      // Validar que cada alumno tenga saldo disponible en su plan antes de crear la clase
      const planForStudent: Record<string, string> = {};
      const remainingForStudent: Record<string, number> = {};
      for (const sid of selectedStudents) {
        const { data: plans, error: planErr } = await supabase
          .from('student_plans')
          .select('id, remaining_classes, purchased_at')
          .eq('student_id', sid)
          .order('purchased_at', { ascending: true });

        if (planErr) {
          const msg = 'No se pudo verificar el plan del alumno. Intenta nuevamente.';
          toast.error(msg);
          setSaving(false);
          return;
        }

        if (!plans || plans.length === 0) {
          const msg = 'El alumno seleccionado no tiene un plan con clases disponibles.';
          toast.error(msg);
          setSaving(false);
          return;
        }

        let chosenPlan: any = null;
        let chosenPlanRemaining: number | null = null;
        for (const p of plans as any[]) {
          const { count: usedCount, error: usageCountErr } = await supabase
            .from('plan_usages')
            .select('id', { count: 'exact', head: true })
            .eq('student_plan_id', p.id)
            .eq('student_id', sid);
          if (usageCountErr) {
            const msg = 'No se pudo verificar el uso de clases del plan.';
            toast.error(msg);
            setSaving(false);
            return;
          }
          const used = usedCount ?? 0;
          const totalFromPlan = (p.remaining_classes as number) ?? 0;
          const remaining = Math.max(0, totalFromPlan - used);
          if (remaining > 0) {
            chosenPlan = p;
            chosenPlanRemaining = remaining;
            break;
          }
        }

        if (!chosenPlan) {
          const msg = 'El alumno seleccionado ya no tiene clases disponibles en su plan.';
          toast.error(msg);
          setSaving(false);
          return;
        }

        if (chosenPlanRemaining == null) {
          const msg = 'No se pudo determinar el saldo del plan del alumno.';
          toast.error(msg);
          setSaving(false);
          return;
        }

        // V3: limitar cantidad de clases futuras reservadas al total de clases del plan
        const totalFromPlan = (chosenPlan.remaining_classes as number) ?? 0;
        if (totalFromPlan > 0) {
          const nowIso = new Date().toISOString();
          const { data: futureBookings, error: futureErr } = await supabase
            .from('bookings')
            .select('id, class_sessions!inner(id,date)')
            .eq('student_id', sid)
            .gt('class_sessions.date', nowIso);

          if (futureErr) {
            const msg = 'No se pudo verificar las clases futuras del alumno. Intenta nuevamente.';
            toast.error(msg);
            setSaving(false);
            return;
          }

          const futureCount = (futureBookings ?? []).length;
          if (futureCount >= totalFromPlan) {
            const label = getStudentLabel(sid);
            const msg = `El alumno ${label} ya tiene ${futureCount} clases futuras reservadas, que es el máximo permitido por su plan.`;
            toast.error(msg);
            setSaving(false);
            return;
          }
        }

        planForStudent[sid] = chosenPlan.id as string;
        remainingForStudent[sid] = chosenPlanRemaining;
      }

      // V4: Validar que ningún alumno tenga otra clase en el mismo horario (en cualquier sede/cancha)
      {
        const { data: conflicts, error: conflictsErr } = await supabase
          .from('bookings')
          .select('student_id, class_sessions!inner(id,date)')
          .in('student_id', selectedStudents)
          .eq('class_sessions.date', iso);

        if (conflictsErr) {
          const msg = 'No se pudo verificar la disponibilidad de los alumnos. Intenta nuevamente.';
          toast.error(msg);
          setSaving(false);
          return;
        }

        if ((conflicts ?? []).length > 0) {
          const conflictIds = Array.from(
            new Set((conflicts ?? []).map((c: any) => c.student_id as string))
          );
          const labels = conflictIds.map((sid) => getStudentLabel(sid));
          const msg =
            conflictIds.length === 1
              ? `El alumno ${labels[0]} ya tiene una clase en ese horario.`
              : `Los siguientes alumnos ya tienen una clase en ese horario: ${labels.join(', ')}.`;
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

      const weekdaysSet = new Set(recurringWeekdays);
      const maxRemaining = Math.max(...Object.values(remainingForStudent));
      const desiredTotalSessions = recurringEnabled ? maxRemaining : 1;

      const createdClassIds: string[] = [];
      const createdClassDates: string[] = [];
      const createdBookingsByStudent: Record<string, number> = {};
      let skippedCourt = 0;
      let skippedStudents = 0;
      let searchCursor = new Date(`${day}T00:00:00`);
      let summaryToastShown = false;

      const createOneSession = async (sessionIso: string, sessionIndex: number) => {
        const studentsToBook = selectedStudents.filter((sid) => (remainingForStudent[sid] ?? 0) >= sessionIndex + 1);
        if (studentsToBook.length === 0) return;

        // Anti-race: misma cancha y misma hora
        {
          const { data: clash, error: clashErr } = await supabase
            .from('class_sessions')
            .select('id')
            .eq('court_id', courtId)
            .eq('date', sessionIso)
            .limit(1);
          if (clashErr) throw clashErr;
          if ((clash ?? []).length > 0) {
            skippedCourt += 1;
            return;
          }
        }

        // Warning: coach con clase en mismo horario
        {
          const { data: coachClash, error: coachClashErr } = await supabase
            .from('class_sessions')
            .select('id')
            .eq('coach_id', coachId)
            .eq('date', sessionIso)
            .limit(1);
          if (coachClashErr) throw coachClashErr;
          if ((coachClash ?? []).length > 0) {
            const coachName = coachesMap[coachId]?.full_name ?? 'el profesor seleccionado';
            toast.warning(`${coachName} ya tiene una clase en ese horario.`);
          }
        }

        // Bloqueo: alumnos con clase en el mismo horario
        {
          const { data: conflicts, error: conflictsErr } = await supabase
            .from('bookings')
            .select('student_id, class_sessions!inner(id,date)')
            .in('student_id', studentsToBook)
            .eq('class_sessions.date', sessionIso);

          if (conflictsErr) throw conflictsErr;
          if ((conflicts ?? []).length > 0) {
            skippedStudents += 1;
            return;
          }
        }

        const capacityForSession = studentsToBook.length;
        const typeForSession: 'individual' | 'grupal' = capacityForSession === 1 ? 'individual' : 'grupal';

        const { data: inserted, error: insErr } = await supabase
          .from('class_sessions')
          .insert({
            date: sessionIso,
            court_id: courtId,
            coach_id: coachId,
            capacity: capacityForSession,
            type: typeForSession,
            // price_cents y currency pueden tener defaults en la DB; si no, se agregan luego.
          })
          .select('*')
          .maybeSingle();
        if (insErr) throw insErr;
        if (!inserted) throw new Error('No se pudo crear la clase (verifica permisos RLS para INSERT).');

        const createdClassId = (inserted as any).id as string;
        createdClassIds.push(createdClassId);
        createdClassDates.push((inserted as any).date as string);

        // bookings
        const bookingRows = studentsToBook.map((sid) => ({
          class_id: createdClassId,
          student_id: sid,
          status: 'reserved',
        }));
        const { error: bookingsErr } = await supabase.from('bookings').insert(bookingRows);
        if (bookingsErr) throw bookingsErr;

        for (const sid of studentsToBook) {
          createdBookingsByStudent[sid] = (createdBookingsByStudent[sid] ?? 0) + 1;
        }

        // plan_usages
        for (const sid of studentsToBook) {
          const planId = planForStudent[sid];
          if (!planId) continue;
          const { error: usageUpsertErr } = await supabase.from('plan_usages').upsert(
            {
              student_plan_id: planId,
              class_id: createdClassId,
              student_id: sid,
            },
            { onConflict: 'student_id,class_id' }
          );
          if (usageUpsertErr) {
            console.error('Error registrando plan_usages en Agenda (create)', usageUpsertErr.message);
          }
        }

        await logAudit('create', 'class_session', createdClassId, {
          date: sessionIso,
          court_id: courtId,
          coach_id: coachId,
          capacity: capacityForSession,
          type: typeForSession,
          students: [...studentsToBook],
          recurring_enabled: recurringEnabled,
        });

        // UI sync
        const newClass = inserted as unknown as ClassSession;
        setClasses((prev) => [...prev, newClass].sort((a, b) => a.date.localeCompare(b.date)));
        setBookingsCount((prev) => ({ ...prev, [createdClassId]: studentsToBook.length }));
        setStudentsByClass((prev) => ({
          ...prev,
          [createdClassId]: [...studentsToBook],
        }));

        // Push solo para la primera clase creada
        if (sessionIndex === 0 && selectedAcademyId) {
          try {
            await fetch('/api/push/class-created', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                classId: createdClassId,
                coachId,
                studentIds: [...studentsToBook],
                dateIso: sessionIso,
                academyId: selectedAcademyId,
              }),
            });
          } catch (pushErr) {
            console.error('Error enviando notificación de clase creada', pushErr);
          }
        }
      };

      // Crear la primera clase (siempre)
      await createOneSession(iso, 0);
      if (createdClassIds.length === 0) {
        toast.error('No se pudo crear la clase. Verificá disponibilidad y reintentá.');
        setSaving(false);
        return;
      }

      // Crear clases recurrentes adicionales
      if (recurringEnabled && desiredTotalSessions > 1) {
        const targetTotal = desiredTotalSessions;
        const maxSearchDays = 730;
        let searchedDays = 0;

        // arrancamos desde el día siguiente al de la primera clase
        searchCursor = new Date(searchCursor.getTime() + 24 * 60 * 60 * 1000);

        while (createdClassIds.length < targetTotal && searchedDays < maxSearchDays) {
          const wd = searchCursor.getDay();
          if (weekdaysSet.has(wd)) {
            const yyyy = searchCursor.getFullYear();
            const mm = String(searchCursor.getMonth() + 1).padStart(2, '0');
            const dd = String(searchCursor.getDate()).padStart(2, '0');
            const wdTime = recurringTimesByWeekday[wd];
            if (!wdTime) {
              searchCursor = new Date(searchCursor.getTime() + 24 * 60 * 60 * 1000);
              searchedDays += 1;
              continue;
            }
            const isoCandidate = new Date(`${yyyy}-${mm}-${dd}T${wdTime}:00`).toISOString();
            try {
              await createOneSession(isoCandidate, createdClassIds.length);
            } catch (recErr: any) {
              const msg = recErr?.message || 'Error creando clases recurrentes.';
              console.error('Error creando clase recurrente', msg);
              toast.error(msg);
              setSaving(false);
              return;
            }
          }
          searchCursor = new Date(searchCursor.getTime() + 24 * 60 * 60 * 1000);
          searchedDays += 1;
        }

        if (searchedDays >= maxSearchDays && createdClassIds.length < targetTotal) {
          toast.warning('No se pudieron generar todas las clases recurrentes por falta de fechas disponibles.');
        }
      }

      if (recurringEnabled) {
        const perStudent = selectedStudents
          .map((sid) => {
            const label = getStudentLabel(sid);
            const count = createdBookingsByStudent[sid] ?? 0;
            return { sid, label, count };
          })
          .filter((x) => x.count > 0);

        const perStudentTxt = perStudent.length
          ? ` Reservas: ${perStudent.map((x) => `${x.label}: ${x.count}`).join(' | ')}.`
          : '';

        const skippedMsgParts: string[] = [];
        if (skippedCourt > 0) skippedMsgParts.push(`${skippedCourt} por cancha ocupada`);
        if (skippedStudents > 0) skippedMsgParts.push(`${skippedStudents} por alumnos ocupados`);
        const skippedTxt = skippedMsgParts.length ? ` (omitidas: ${skippedMsgParts.join(', ')})` : '';

        toast.success(`Se crearon ${createdClassIds.length} clases${skippedTxt}.${perStudentTxt}`);
        summaryToastShown = true;
      }

      setDay('');
      setTime('');
      setLocationId('');
      setCourtId('');
      setCoachId('');
      setSelectedStudents([]);
      setNotes('');
      setRecurringEnabled(false);
      setRecurringWeekdays([]);
      setRecurringTimesByWeekday({});
      if (!summaryToastShown) {
        toast.success('Clase creada correctamente');
      }
    } catch (err: any) {
      const msg = err.message || 'Error creando la clase';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const locationsMap = useMemo(() => Object.fromEntries(locations.map((x) => [x.id, x] as const)), [locations]);
  const courtsMap = useMemo(() => Object.fromEntries(courts.map((x) => [x.id, x] as const)), [courts]);
  const coachesMap = useMemo(() => Object.fromEntries(coaches.map((x) => [x.id, x] as const)), [coaches]);
  const studentsMap = useMemo(
    () => Object.fromEntries(allStudentsForLabels.map((x) => [x.id, x] as const)),
    [allStudentsForLabels]
  );
  const getStudentLabel = (sid: string) => {
    const s = studentsMap[sid] as Student | undefined;
    if (s?.full_name) return s.full_name;
    if (currentStudentFullName && sid === studentId) return currentStudentFullName;
    if (s?.notes) return s.notes;
    if (s?.level) return s.level;
    return sid;
  };
  const filteredClasses = useMemo(() => {
    const now = new Date();
    return classes.filter((cls) => {
      // ocultar clases que ya terminaron: asumimos duración fija 60 minutos
      const startTs = new Date(cls.date).getTime();
      const endTs = startTs + 60 * 60 * 1000;
      if (endTs < now.getTime()) return false;

      const countForClass = bookingsCount[cls.id] ?? 0;

      // Si es alumno, ocultar clases sin alumnos (por ejemplo, cuando el único alumno canceló)
      // y además solo mostrar clases donde tiene reserva.
      if (role === 'student' && studentId) {
        if (countForClass <= 0) return false;
        const studentsForClass = studentsByClass[cls.id] ?? [];
        if (!studentsForClass.includes(studentId)) return false;
      }

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
    bookingsCount,
    role,
    studentId,
    filterLocationId,
    filterCourtId,
    filterCoachId,
    filterStudentId,
    filterFrom,
    filterTo,
  ]);

  // Clases recientes (últimas 24h) que ya terminaron, para poder marcar asistencia aunque pasaron los 60 minutos
  const recentClasses = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return classes.filter((cls) => {
      const startTs = new Date(cls.date).getTime();
      const endTs = startTs + 60 * 60 * 1000;
      // ya terminadas
      if (endTs >= now.getTime()) return false;
      // solo últimas 24h
      if (startTs < cutoff.getTime()) return false;
      if (attendanceMarkedByClass[cls.id]) return false;
      return true;
    });
  }, [classes, attendanceMarkedByClass]);

  const studentPastClasses = useMemo(() => {
    if (role !== 'student' || !studentId) return [];
    const now = new Date();

    // Mapa rápido de court_id -> location_id para poder filtrar por academia
    const courtLocationMap = new Map<string, string | null>();
    courts.forEach((c) => {
      courtLocationMap.set(c.id, c.location_id);
    });

    return classes
      .filter((cls) => {
        const startTs = new Date(cls.date).getTime();
        // Consideramos "pasada" cualquier clase que ya haya comenzado
        if (startTs >= now.getTime()) return false;

        // Filtrar por academia seleccionada si aplica
        if (selectedAcademyId && academyLocationIds.size > 0) {
          const courtLocId = cls.court_id ? courtLocationMap.get(cls.court_id) ?? null : null;
          if (!courtLocId || !academyLocationIds.has(courtLocId)) return false;
        }

        const studentsForClass = studentsByClass[cls.id] ?? [];
        return studentsForClass.includes(studentId);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [classes, studentsByClass, role, studentId, selectedAcademyId, academyLocationIds, courts]);

  // Modal simple para ver los alumnos de una clase
  const [studentsModalClass, setStudentsModalClass] = useState<ClassSession | null>(null);

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
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showUpcomingSection, setShowUpcomingSection] = useState(false);
  const [showRecentSection, setShowRecentSection] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllStudentHistory, setShowAllStudentHistory] = useState(false);

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

      const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
      setFilterFrom(toLocalInput(start));
      // No limitamos "Hasta" a hoy, porque si no se ocultan las clases de mañana.
      // El filtro "Desde" sirve para enfocarse en clases de hoy en adelante.
      setFilterTo('');
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
    // Usamos una copia para forzar un nuevo reference y que el efecto que carga bookings
    // se ejecute incluso si se edita la misma clase varias veces seguidas.
    const copy: ClassSession = { ...cls };
    setEditing(copy);
    setEditCourtId(copy.court_id || '');
    const d = new Date(copy.date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = '00';
    setEditDay(`${yyyy}-${mm}-${dd}`);
    setEditTime(`${hh}:${min}`);
    setEditCoachId(copy.coach_id || '');
    // @ts-ignore
    setEditNotes((copy as any).notes || '');
    setEditStudentQuery('');
    setEditSelectedStudents([]);
    setEditExistingStudents([]);
  };

  // Load existing bookings for editing class
  useEffect(() => {
    (async () => {
      if (!editing) return;

      // Preferimos el estado en memoria de alumnos por clase si existe,
      // porque se mantiene en sync al crear/editar clases.
      const fromState = studentsByClass[editing.id];
      if (fromState && fromState.length > 0) {
        const unique = Array.from(new Set(fromState));
        setEditExistingStudents(unique);
        setEditSelectedStudents(unique);
        return;
      }

      const { data: bData } = await supabase
        .from('bookings')
        .select('student_id')
        .eq('class_id', editing.id);
      const current = (bData ?? []).map((b: any) => b.student_id as string);
      setEditExistingStudents(current);
      setEditSelectedStudents(current);
    })();
  }, [supabase, editing, studentsByClass]);

  const openAttendance = async (cls: ClassSession) => {
    setAttendanceClass(cls);
    setAttendanceLoading(true);
    setError(null);
    try {
      // Cargar reservas para esta clase (para fallback si aún no tenemos studentsByClass actualizado)
      const { data: bookingsData, error: bErr } = await supabase
        .from('bookings')
        .select('student_id')
        .eq('class_id', cls.id);
      if (bErr) throw bErr;

      const { data: attData, error: aErr } = await supabase
        .from('attendance')
        .select('student_id, present')
        .eq('class_id', cls.id);
      if (aErr) throw aErr;

      const attMap = new Map((attData ?? []).map((a: any) => [a.student_id as string, !!a.present]));

      // Usamos primero el mapa en memoria de alumnos por clase (studentsByClass),
      // que se mantiene en sync al crear/editar clases. Si no hay entrada, usamos bookings.
      const fromState = studentsByClass[cls.id];
      const bookingIds = (bookingsData ?? []).map((b: any) => b.student_id as string);
      const baseIds = (fromState && fromState.length > 0) ? fromState : bookingIds;

      const list = baseIds.map((sid) => {
        const s = studentsMap[sid] as Student | undefined;
        const label =
          (s?.full_name || '') ||
          (s?.notes || '') ||
          (s?.level || '') ||
          s?.id ||
          sid;
        return {
          student_id: sid,
          present: attMap.get(sid) ?? false,
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

        await logAudit('attendance_update', 'class_session', attendanceClass.id, {
          attendance: rows,
        });
      }

      setAttendanceMarkedByClass((prev) => ({
        ...prev,
        [attendanceClass.id]: true,
      }));
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
      for (let h = 6; h <= 23; h++) candidates.push(`${String(h).padStart(2, '0')}:00`);
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
      toast.error('Completa cancha, fecha, hora y profesor');
      return;
    }

    // Validar rango horario permitido (06:00 a 23:00)
    {
      const hour = Number(editTime.split(':')[0] ?? 'NaN');
      if (Number.isNaN(hour) || hour < 6 || hour > 23) {
        toast.error('Horario inválido. Seleccioná una hora entre 06:00 y 23:00.');
        return;
      }
    }
    if (editSelectedStudents.length < 1) {
      toast.error('Selecciona al menos 1 alumno (máximo 4).');
      return;
    }
    if (editSelectedStudents.length > 4) {
      toast.error('Máximo 4 alumnos por clase.');
      return;
    }
    setSaving(true);
    try {
      const oldDateIso = editing.date;
      const oldCourtId = editing.court_id;
      const oldCoachId = editing.coach_id;

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
        toast.error('Ese horario ya fue ocupado recientemente. Elegí otra hora.');
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

      // V1: no permitir mover una clase a una fecha/hora en el pasado
      {
        const now = new Date();
        const classStart = new Date(iso);
        if (classStart.getTime() <= now.getTime()) {
          toast.error('No podés mover una clase a una fecha y hora que ya pasaron.');
          setSaving(false);
          return;
        }
      }

      // Validar saldo de plan solo para los alumnos nuevos que se agregan a la clase
      const planForStudentEdit: Record<string, string> = {};
      const before = new Set(editExistingStudents);
      const after = new Set(editSelectedStudents);
      const toAdd = Array.from(after).filter((id) => !before.has(id));
      const toRemove = Array.from(before).filter((id) => !after.has(id));

      if (toAdd.length) {
        for (const sid of toAdd) {
          const { data: plans, error: planErr } = await supabase
            .from('student_plans')
            .select('id, remaining_classes, purchased_at')
            .eq('student_id', sid)
            .order('purchased_at', { ascending: true });

          if (planErr) {
            toast.error('No se pudo verificar el plan del alumno. Intenta nuevamente.');
            setSaving(false);
            return;
          }

          if (!plans || plans.length === 0) {
            toast.error('Uno de los alumnos seleccionados no tiene un plan con clases disponibles.');
            setSaving(false);
            return;
          }

          let chosenPlan: any = null;
          for (const p of plans as any[]) {
            const { count: usedCount, error: usageCountErr } = await supabase
              .from('plan_usages')
              .select('id', { count: 'exact', head: true })
              .eq('student_plan_id', p.id)
              .eq('student_id', sid);
            if (usageCountErr) {
              toast.error('No se pudo verificar el uso de clases del plan.');
              setSaving(false);
              return;
            }
            const used = usedCount ?? 0;
            if (used < (p.remaining_classes as number)) {
              chosenPlan = p;
              break;
            }
          }

          if (!chosenPlan) {
            toast.error('Uno de los alumnos seleccionados ya no tiene clases disponibles en su plan.');
            setSaving(false);
            return;
          }

          // V3: limitar cantidad de clases futuras reservadas al total de clases del plan
          const totalFromPlan = (chosenPlan.remaining_classes as number) ?? 0;
          if (totalFromPlan > 0) {
            const nowIso = new Date().toISOString();
            const { data: futureBookings, error: futureErr } = await supabase
              .from('bookings')
              .select('id, class_sessions!inner(id,date)')
              .eq('student_id', sid)
              .gt('class_sessions.date', nowIso);

            if (futureErr) {
              toast.error('No se pudo verificar las clases futuras del alumno. Intenta nuevamente.');
              setSaving(false);
              return;
            }

            const futureCount = (futureBookings ?? []).length;
            if (futureCount >= totalFromPlan) {
              const label = getStudentLabel(sid);
              toast.error(
                `El alumno ${label} ya tiene ${futureCount} clases futuras reservadas, que es el máximo permitido por su plan.`
              );
              setSaving(false);
              return;
            }
          }

          planForStudentEdit[sid] = chosenPlan.id as string;
        }
      }

      // V4: Validar que el profesor no tenga otra clase en el mismo horario (en cualquier sede/cancha), excluyendo esta clase
      {
        const { data: coachClash, error: coachClashErr } = await supabase
          .from('class_sessions')
          .select('id')
          .eq('coach_id', editCoachId)
          .eq('date', iso)
          .neq('id', editing.id)
          .limit(1);
        if (coachClashErr) {
          toast.error('No se pudo verificar la disponibilidad del profesor. Intenta nuevamente.');
          setSaving(false);
          return;
        }
        if ((coachClash ?? []).length > 0) {
          const coachName = coachesMap[editCoachId]?.full_name ?? 'el profesor seleccionado';
          toast.warning(`${coachName} ya tiene una clase en ese horario.`);
        }
      }

      // V4b: Validar que los alumnos nuevos no tengan otra clase en el mismo horario, excluyendo esta clase
      {
        const { data: conflicts, error: conflictsErr } = await supabase
          .from('bookings')
          .select('student_id, class_sessions!inner(id,date)')
          .in('student_id', toAdd)
          .eq('class_sessions.date', iso)
          .neq('class_sessions.id', editing.id);

        if (conflictsErr) {
          const msg = 'No se pudo verificar la disponibilidad de los alumnos. Intenta nuevamente.';
          toast.error(msg);
          setSaving(false);
          return;
        }

        if ((conflicts ?? []).length > 0) {
          const conflictIds = Array.from(
            new Set((conflicts ?? []).map((c: any) => c.student_id as string))
          );
          const labels = conflictIds.map((sid) => getStudentLabel(sid));
          const msg =
            conflictIds.length === 1
              ? `El alumno ${labels[0]} ya tiene una clase en ese horario.`
              : `Los siguientes alumnos ya tienen una clase en ese horario: ${labels.join(', ')}.`;
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

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
      if (toAdd.length) {
        const rows = toAdd.map((sid) => ({ class_id: editing.id, student_id: sid, status: 'reserved' }));
        const { error: addErr } = await supabase.from('bookings').insert(rows);
        if (addErr) throw addErr;

        // crear usos de plan para nuevos alumnos usando el plan previamente validado
        for (const sid of toAdd) {
          const planId = planForStudentEdit[sid];
          if (!planId) continue;
          const { error: usageUpsertErr } = await supabase.from('plan_usages').upsert(
            {
              student_plan_id: planId,
              class_id: editing.id,
              student_id: sid,
            },
            { onConflict: 'student_id,class_id' }
          );
          if (usageUpsertErr) {
            console.error('Error registrando plan_usages en Agenda (edit)', usageUpsertErr.message);
          }
        }
      }
      if (toRemove.length) {
        const { error: delErr } = await supabase
          .from('bookings')
          .delete()
          .eq('class_id', editing.id)
          .in('student_id', toRemove);
        if (delErr) throw delErr;

        // devolver clases al plan eliminando usos para los alumnos quitados
        const { error: delUsageErr } = await supabase
          .from('plan_usages')
          .delete()
          .eq('class_id', editing.id)
          .in('student_id', toRemove);
        if (delUsageErr) throw delUsageErr;
      }

      await logAudit('update', 'class_session', editing.id, { ...updates, add_students: toAdd, remove_students: toRemove });

      const updated = upd as unknown as ClassSession;
      setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.date.localeCompare(b.date)));
      setBookingsCount((prev) => ({ ...prev, [editing.id]: editSelectedStudents.length }));
      // Mantener en sync el mapa de alumnos por clase para que la UI muestre los nombres correctos tras editar
      setStudentsByClass((prev) => ({
        ...prev,
        [editing.id]: [...editSelectedStudents],
      }));

      const isRescheduled = oldDateIso !== iso || oldCourtId !== editCourtId || oldCoachId !== editCoachId;
      let academyIdToUse: string | null = selectedAcademyId;
      if (!academyIdToUse && typeof window !== 'undefined') {
        try {
          academyIdToUse = window.localStorage.getItem('selectedAcademyId');
        } catch {
          academyIdToUse = null;
        }
      }

      if (isRescheduled && academyIdToUse) {
        try {
          const res = await fetch('/api/push/class-rescheduled', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              classId: editing.id,
              academyId: academyIdToUse,
              studentIds: [...editSelectedStudents],
              coachId: editCoachId,
              oldDateIso,
              newDateIso: iso,
              oldCourtId,
              newCourtId: editCourtId,
              oldCoachId,
              newCoachId: editCoachId,
              rescheduledByRole: role,
              rescheduledByUserId: currentUserId,
            }),
          });

          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            console.error('Push class-rescheduled respondió con error', res.status, txt);
          }
        } catch (pushErr) {
          console.error('Error enviando push de clase reprogramada', pushErr);
        }
      }

      toast.success('Clase actualizada correctamente');
      setEditing(null);
    } catch (e: any) {
      const msg = e.message || 'Error guardando cambios de la clase';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const roleResolved = role === 'super_admin' || role === 'admin' || role === 'coach' || role === 'student';

  if (!roleResolved) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1d3b4f] to-[#3cadaf] text-white">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-24 w-24 rounded-full bg-white/10 border border-white/40 flex items-center justify-center overflow-hidden animate-spin"
            style={{ animationDuration: '1.5s' }}
          >
            <Image
              src="/icons/LogoAgendo1024.png"
              alt="Icono de la app"
              width={128}
              height={128}
              className="object-cover"
            />
          </div>
          <div className="text-center">
            <div className="text-xs text-white/80 mt-1">Cargando tu agenda.....</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4 overflow-x-hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-[#3cadaf]" />
          <h1 className="text-2xl font-semibold text-[#31435d]">Agenda</h1>
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

      {role !== 'student' && (
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
                  disabled={recurringEnabled || !courtId || !day || availableTimes.length === 0}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue
                      placeholder={
                        recurringEnabled
                          ? 'En recurrencia se define hora por día'
                          : !courtId
                          ? 'Selecciona una cancha'
                          : !day
                          ? 'Selecciona una fecha'
                          : availableTimes.length
                          ? 'Selecciona una hora'
                          : 'Sin horarios disponibles'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                                    toast.error('Máximo 4 alumnos por clase');
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
              {/* Recurrencia de clases (Fase 3) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="recurring-enabled"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={recurringEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setRecurringEnabled(enabled);
                      if (enabled) {
                        if (day) {
                          const baseDate = new Date(`${day}T00:00:00`);
                          const wd = baseDate.getDay();
                          setRecurringWeekdays((prev) => (prev.includes(wd) ? prev : [wd]));
                          if (time) {
                            setRecurringTimesByWeekday((prev) => (prev[wd] ? prev : { ...prev, [wd]: time }));
                          }
                        }
                      } else {
                        setRecurringWeekdays([]);
                        setRecurringTimesByWeekday({});
                      }
                    }}
                  />
                  <label htmlFor="recurring-enabled" className="text-sm font-medium">
                    Clases recurrentes (hasta agotar el plan)
                  </label>
                </div>
                {recurringEnabled && (
                  <div className="space-y-2 border rounded-md p-2 bg-slate-50">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-gray-600 mr-1">Días de la semana:</span>
                      {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((label, idx) => {
                        const wd = idx; // 0=Domingo
                        const active = recurringWeekdays.includes(wd);
                        return (
                          <button
                            key={wd}
                            type="button"
                            onClick={() => {
                              setRecurringWeekdays((prev) =>
                                prev.includes(wd) ? prev.filter((x) => x !== wd) : [...prev, wd]
                              );
                              setRecurringTimesByWeekday((prev) => {
                                if (active) {
                                  const next = { ...prev };
                                  delete next[wd];
                                  return next;
                                }
                                const suggested = time || prev[wd] || recurringTimeCandidates[0] || '06:00';
                                return { ...prev, [wd]: suggested };
                              });
                            }}
                            className={`px-2 py-1 rounded text-xs border transition-colors ${
                              active
                                ? 'bg-[#3cadaf] text-white border-[#3cadaf]'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-100'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      {recurringWeekdays
                        .slice()
                        .sort((a, b) => a - b)
                        .map((wd) => (
                          <div key={`wd-time-${wd}`} className="flex items-center gap-2">
                            <span className="text-xs text-gray-700 w-6">
                              {['D', 'L', 'M', 'X', 'J', 'V', 'S'][wd]}
                            </span>
                            <Select
                              value={recurringTimesByWeekday[wd] || ''}
                              onValueChange={(val) =>
                                setRecurringTimesByWeekday((prev) => ({
                                  ...prev,
                                  [wd]: val,
                                }))
                              }
                            >
                              <SelectTrigger className="w-full text-sm h-9">
                                <SelectValue placeholder="Hora" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 overflow-y-auto">
                                {recurringTimeCandidates.map((t) => (
                                  <SelectItem key={`wd-${wd}-${t}`} value={t}>
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Se creará primero la clase seleccionada y luego se intentarán crear más clases en los días
                      marcados, respetando el saldo de los planes y evitando superposiciones de horario.
                    </p>
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50" disabled={saving}>
                {saving ? 'Creando...' : 'Crear clase'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
        </div>
      )}

      {role === 'student' && studentPastClasses.length > 0 && (
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
            onClick={() => setShowRecentSection((v) => !v)}
          >
            <span className="inline-flex items-center gap-2 text-[#31435d]">
              <CalendarDays className="h-4 w-4 text-violet-500" />
              Tus clases pasadas
            </span>
            <span className="text-xs text-gray-500">{showRecentSection ? '▼' : '▲'}</span>
          </button>
          <AnimatePresence initial={false}>
            {showRecentSection && (
              <motion.div
                key="student-history-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="p-4 space-y-4 origin-top"
              >
                <p className="text-xs text-gray-500">
                  Historial de tus clases que ya se dictaron.
                </p>
                <ul className="space-y-3">
                  {(showAllStudentHistory ? studentPastClasses : studentPastClasses.slice(0, 5)).map((cls) => {
                    const d = new Date(cls.date);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const hh = String(d.getHours()).padStart(2, '0');
                    const min = String(d.getMinutes()).padStart(2, '0');
                    const court = cls.court_id ? courtsMap[cls.court_id] : undefined;
                    const location = court ? locationsMap[court.location_id] : undefined;
                    const alumnos = bookingsCount[cls.id] ?? 0;

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
                                {location?.name ?? 'Sede sin asignar'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-0.5">
                              <p className="truncate">
                                <span className="font-semibold text-slate-700">Cancha:</span> {court?.name ?? '-'}
                              </p>
                              <p className="truncate">
                                <span className="font-semibold text-slate-700">Profesor:</span>{' '}
                                {coachesMap[cls.coach_id || '']?.full_name ?? 'Coach'}
                              </p>
                              <p className="truncate">
                                <span className="font-semibold text-slate-700">Alumnos en clase:</span> {alumnos}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {studentPastClasses.length > 5 && (
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    {!showAllStudentHistory && <p>Mostrando tus 5 clases pasadas más recientes.</p>}
                    <button
                      type="button"
                      className="text-[#3cadaf] hover:underline"
                      onClick={() => setShowAllStudentHistory((v) => !v)}
                    >
                      {showAllStudentHistory ? 'Ver menos' : 'Ver más'}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
                      {role !== 'student' && <SelectItem value="alumno">Alumno</SelectItem>}
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
            {filterMode === 'alumno' && role !== 'student' && (
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

              const now = new Date();
              const startTs = d.getTime();
              const hoursUntilClass = (startTs - now.getTime()) / (1000 * 60 * 60);
              const canStudentCancel = !!studentId && hoursUntilClass > 12;

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
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 text-[11px] font-medium hover:bg-slate-100"
                            onClick={() => setStudentsModalClass(cls)}
                          >
                            {alumnos}/{cls.capacity} alumnos
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
                      {role === 'student' ? (
                        <button
                          className="text-[11px] sm:text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!canStudentCancel}
                          onClick={async () => {
                            if (!studentId) return;
                            if (!canStudentCancel) return;
                            if (!confirm('¿Cancelar tu reserva para esta clase?')) return;

                            // Verificamos si esta clase tenía solo a este alumno reservado (para actualizar el estado local)
                            const currentStudents = studentsByClass[cls.id] ?? [];
                            const wasSingleStudent = currentStudents.length <= 1;

                            if (wasSingleStudent) {
                              setClasses((prev) => prev.filter((c) => c.id !== cls.id));
                              setBookingsCount((prev) => {
                                const n = { ...prev };
                                delete n[cls.id];
                                return n;
                              });
                              setStudentsByClass((prev) => {
                                const n = { ...prev };
                                delete n[cls.id];
                                return n;
                              });
                            } else {
                              setBookingsCount((prev) => {
                                const current = prev[cls.id] ?? 0;
                                return { ...prev, [cls.id]: Math.max(0, current - 1) };
                              });
                              setStudentsByClass((prev) => {
                                const arr = prev[cls.id] ?? [];
                                const nextArr = arr.filter((sid) => sid !== studentId);
                                return { ...prev, [cls.id]: nextArr };
                              });
                            }

                            // Delegamos el borrado real (booking, plan_usage y posible clase vacía) al backend con supabaseAdmin
                            try {
                              const res = await fetch('/api/classes/cancel-single-student', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ classId: cls.id, studentId }),
                              });
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                const msg = data?.error || 'No se pudo cancelar la reserva en el servidor.';
                                toast.error(msg);
                              }
                            } catch (apiErr) {
                              console.error('Error llamando a /api/classes/cancel-single-student', apiErr);
                              toast.error('No se pudo cancelar la reserva en el servidor.');
                            }

                            if (selectedAcademyId && currentUserId) {
                              try {
                                await fetch('/api/push/class-cancelled', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    classId: cls.id,
                                    coachId: cls.coach_id,
                                    studentIds: [studentId],
                                    dateIso: cls.date,
                                    academyId: selectedAcademyId,
                                    cancelledByRole: 'student',
                                    cancelledByStudentId: studentId,
                                    cancelledByUserId: currentUserId,
                                  }),
                                });
                              } catch (pushErr) {
                                console.error('Error enviando notificación de cancelación de reserva', pushErr);
                              }
                            }

                            toast.success('Reserva cancelada correctamente. Se devolvió 1 clase a tu plan.');
                          }}
                        >
                          {canStudentCancel ? 'Cancelar reserva' : 'No se puede cancelar (menos de 12h)'}
                        </button>
                      ) : (
                        <>
                          <button
                            className="text-[11px] sm:text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              const nowInner = new Date();
                              if (startTs <= nowInner.getTime()) {
                                toast.error('No se puede cancelar una clase que ya comenzó.');
                                return;
                              }

                              if (!confirm('¿Cancelar y eliminar esta clase? Se eliminarán reservas, asistencias y usos de plan asociados.')) return;

                              const { error: delUsageErr } = await supabase
                                .from('plan_usages')
                                .delete()
                                .eq('class_id', cls.id);
                              if (delUsageErr) {
                                toast.error('Error al devolver clases de los planes: ' + delUsageErr.message);
                                return;
                              }

                              const { error: delErr } = await supabase
                                .from('class_sessions')
                                .delete()
                                .eq('id', cls.id);
                              if (delErr) {
                                toast.error('Error al cancelar: ' + delErr.message);
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
                              setStudentsByClass((prev) => {
                                const n = { ...prev };
                                delete n[cls.id];
                                return n;
                              });
                              if (selectedAcademyId && currentUserId && role) {
                                try {
                                  await fetch('/api/push/class-cancelled', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      classId: cls.id,
                                      coachId: cls.coach_id,
                                      studentIds: studentsByClass[cls.id] ?? [],
                                      dateIso: cls.date,
                                      academyId: selectedAcademyId,
                                      cancelledByRole: role,
                                      cancelledByCoachId: role === 'coach' ? cls.coach_id : null,
                                      cancelledByUserId: currentUserId,
                                    }),
                                  });
                                } catch (pushErr) {
                                  console.error('Error enviando notificación de clase cancelada', pushErr);
                                }
                              }
                              toast.success('Clase cancelada correctamente y clases devueltas a los planes.');
                            }}
                          >
                            Cancelar
                          </button>
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
                        </>
                      )}
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

      {role !== 'student' && (
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
                  Usá esta lista para marcar asistencia en clases que ya terminaron pero aún son recientes (últimas 24 horas).
                </p>
                {recentClasses.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No hay clases recientes para marcar asistencia.
                  </p>
                ) : (
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
                )}
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
                          placeholder={'Selecciona una cancha'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedAcademyId && academyLocationIds.size > 0
                          ? courts.filter((c) => academyLocationIds.has(c.location_id))
                          : courts
                        ).map((c) => (
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
                    <Select
                      value={editTime}
                      onValueChange={(val) => setEditTime(val)}
                      disabled={!editCourtId || !editDay || editAvailableTimes.length === 0}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue
                          placeholder={
                            !editCourtId
                              ? 'Selecciona una cancha'
                              : !editDay
                              ? 'Selecciona una fecha'
                              : editAvailableTimes.length
                              ? 'Selecciona una hora'
                              : 'Sin horarios disponibles'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {editAvailableTimes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

      {studentsModalClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b px-4 pt-4 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-[#31435d]">Alumnos de la clase</h3>
                <p className="text-xs text-gray-500">
                  Clase del {new Date(studentsModalClass.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {" "}a las{" "}
                  {new Date(studentsModalClass.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                onClick={() => setStudentsModalClass(null)}
              >
                Cerrar
              </button>
            </div>
            <div className="px-4 py-3 text-sm overflow-y-auto">
              {(() => {
                const ids = studentsByClass[studentsModalClass.id] ?? [];
                if (!ids.length) {
                  return <p className="text-xs text-gray-600">No hay alumnos reservados para esta clase.</p>;
                }
                const uniqueIds = Array.from(new Set(ids));
                const items = uniqueIds.map((sid) => {
                  const s = studentsMap[sid];
                  const label = s?.full_name ?? s?.notes ?? s?.level ?? sid;
                  return { id: sid, label };
                });
                return (
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                      >
                        <span className="truncate mr-2">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
