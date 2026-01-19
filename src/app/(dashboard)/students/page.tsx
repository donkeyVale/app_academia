"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History, Users, StickyNote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { createClientBrowser } from '@/lib/supabase';
import { formatPyg } from '@/lib/formatters';
import { toast } from 'sonner';

const iconColor = '#3cadaf';

const IconStudents = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-5 h-5"
  >
    <circle cx="9" cy="8" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <circle cx="17" cy="9" r="2.5" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M4 18c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke={iconColor} strokeWidth="1.6" fill="none" />
    <path d="M14 18c.3-1.6 1.7-3 3.5-3S21 16.4 21 18" stroke={iconColor} strokeWidth="1.6" fill="none" />
  </svg>
);

type StudentRow = {
  id: string;
  user_id: string | null;
  level: string | null;
  notes: string | null;
};

type StudentPlanRow = {
  id: string;
  student_id: string;
  plan_id: string | null;
  academy_id?: string | null;
  purchased_at?: string | null;
  remaining_classes: number;
  base_price?: number | null;
  final_price?: number | null;
  total_classes?: number | null;
  used_classes?: number | null;
  total_paid?: number | null;
  total_price?: number | null;
  balance_pending?: number | null;
  plans?: { name: string | null } | null;
};

type StudentPayment = {
  id: string;
  amount: number;
  currency: string;
  payment_date: string;
  method: string;
  status: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export default function StudentsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClientBrowser(), []);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'super_admin' | 'admin' | 'coach' | 'student' | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [plansByStudent, setPlansByStudent] = useState<Record<string, StudentPlanRow | undefined>>({});
  const [planNamesById, setPlanNamesById] = useState<Record<string, string>>({});
  const [profilesByUser, setProfilesByUser] = useState<Record<string, ProfileRow | undefined>>({});
  const [studentPayments, setStudentPayments] = useState<StudentPayment[]>([]);
  const [historyStudent, setHistoryStudent] = useState<{ id: string; name: string } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<
    {
      id: string;
      date: string;
      courtName: string | null;
      coachName: string | null;
      studentPlanId: string | null;
      planName: string | null;
      planPurchasedAt: string | null;
      usageStatus: 'pending' | 'confirmed';
      attendancePresent: boolean | null;
      attendanceMarkedAt: string | null;
      attendanceMarkedByName: string | null;
    }[]
  >([]);
  const [showOnlyMyStudents, setShowOnlyMyStudents] = useState(false);
  const [myStudentIds, setMyStudentIds] = useState<string[]>([]);
  const [nextClassByStudent, setNextClassByStudent] = useState<Record<string, string | null>>({});
  const [classNotesByClass, setClassNotesByClass] = useState<
    Record<
      string,
      {
        id: string;
        note: string;
        coach_id: string | null;
        visible_to_student: boolean | null;
        visible_to_coach: boolean | null;
      }[]
    >
  >({});
  const [studentsWithNotes, setStudentsWithNotes] = useState<string[]>([]);
  const [editingNote, setEditingNote] = useState<
    | {
        classId: string;
        draft: string;
        visibleToStudent: boolean;
        visibleToCoach: boolean;
      }
    | null
  >(null);
  const [savingNote, setSavingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [coachIdForNotes, setCoachIdForNotes] = useState<string | null>(null);

  const roleResolved = role === 'super_admin' || role === 'admin' || role === 'coach' || role === 'student';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/login');
        return;
      }

      const userId = data.user.id as string;

      let roleFromProfile: 'super_admin' | 'admin' | 'coach' | 'student' | null = null;
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (!profErr) {
        const r = (profile?.role as 'super_admin' | 'admin' | 'coach' | 'student' | null) ?? null;
        roleFromProfile = r === 'super_admin' || r === 'admin' || r === 'coach' || r === 'student' ? r : null;
        setRole(roleFromProfile);
        if (roleFromProfile === 'coach') {
          setShowOnlyMyStudents(true);
        }
      }

      setChecking(false);
      setLoading(true);
      setError(null);

      try {
        const [studentsRes, studentPlansRes] = await Promise.all([
          supabase.from('students').select('id, user_id, level, notes'),
          supabase
            .from('student_plans')
            .select('id, student_id, plan_id, remaining_classes, base_price, final_price, academy_id, purchased_at, plans(name)'),
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (studentPlansRes.error) throw studentPlansRes.error;

        const studentsData = (studentsRes.data ?? []) as StudentRow[];

        let effectiveStudents: StudentRow[] = studentsData;
        let effectiveRawPlans: any[] = (studentPlansRes.data ?? []) as any[];

        const isAdminLike = roleFromProfile === 'admin' || roleFromProfile === 'super_admin';
        let selectedAcademyId: string | null = null;
        if ((isAdminLike || roleFromProfile === 'coach') && typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('selectedAcademyId');
          selectedAcademyId = stored && stored.trim() ? stored : null;
        }

        // Para admin/super_admin: alumnos y planes se limitan estrictamente a la academia seleccionada
        if (isAdminLike) {
          if (!selectedAcademyId) {
            effectiveStudents = [];
            effectiveRawPlans = [];
          } else {
            const { data: uaRows, error: uaErr } = await supabase
              .from('user_academies')
              .select('user_id, role, academy_id')
              .eq('academy_id', selectedAcademyId);
            if (uaErr) throw uaErr;

            const rows = (uaRows as { user_id: string | null; role: string; academy_id: string | null }[] | null) ?? [];
            const studentUserIds = new Set(
              rows
                .filter((r) => r.role === 'student' && r.user_id)
                .map((r) => r.user_id as string)
            );

            effectiveStudents = studentsData.filter((s) => s.user_id && studentUserIds.has(s.user_id));

            effectiveRawPlans = effectiveRawPlans.filter((p) => p.academy_id === selectedAcademyId);
          }
        }

        // Para coach: la grilla de alumnos también debe respetar la academia seleccionada.
        // 1) Tomamos alumnos que tienen al menos un plan con academy_id = selectedAcademyId.
        // 2) Y además, que sigan asignados a esa academia vía user_academies (cuando tengan user vinculado).
        if (roleFromProfile === 'coach' && selectedAcademyId) {
          const coachAcademyStudentIds = new Set(
            effectiveRawPlans
              .filter((p: any) => p.academy_id === selectedAcademyId)
              .map((p: any) => p.student_id as string)
          );

          if (coachAcademyStudentIds.size > 0) {
            // Limitar planes a la academia seleccionada
            effectiveRawPlans = effectiveRawPlans.filter((p: any) => p.academy_id === selectedAcademyId);

            // Adicionalmente, respetar asignaciones actuales en user_academies
            const { data: uaRowsForCoach, error: uaErrForCoach } = await supabase
              .from('user_academies')
              .select('user_id')
              .eq('academy_id', selectedAcademyId)
              .eq('role', 'student');

            let validUserIdsForAcademy: Set<string> | null = null;
            if (!uaErrForCoach && uaRowsForCoach) {
              const userIds = (uaRowsForCoach as { user_id: string | null }[])
                .map((r) => r.user_id)
                .filter((id): id is string => !!id);
              if (userIds.length > 0) {
                validUserIdsForAcademy = new Set(userIds);
              }
            }

            effectiveStudents = effectiveStudents.filter((s) => {
              if (!coachAcademyStudentIds.has(s.id)) return false;
              // Si no hay user vinculado o no pudimos leer user_academies, mantenemos el alumno.
              if (!s.user_id || !validUserIdsForAcademy) return true;
              // Si hay user vinculado, solo lo mostramos si sigue asignado a esta academia.
              return validUserIdsForAcademy.has(s.user_id);
            });
          } else {
            // Si no hay ningún plan asociado a esa academia, mostramos lista vacía para coach.
            effectiveStudents = [];
            effectiveRawPlans = [];
          }
        }

        console.log('StudentsPage load:', { roleFromProfile, studentsCount: effectiveStudents.length });

        const plansData: StudentPlanRow[] = effectiveRawPlans.map((p) => ({
          id: p.id as string,
          student_id: p.student_id as string,
          plan_id: (p.plan_id as string | null) ?? null,
          // remaining_classes aquí representa inicialmente las clases totales configuradas para el plan
          remaining_classes: (p.remaining_classes as number) ?? 0,
          total_classes: (p.remaining_classes as number | null) ?? null,
          used_classes: null,
          base_price: (p.base_price as number | null) ?? null,
          final_price: (p.final_price as number | null) ?? null,
          plans: p.plans
            ? {
                name: (Array.isArray(p.plans) ? p.plans[0]?.name : p.plans.name) ?? null,
              }
            : null,
          academy_id: (p.academy_id as string | null) ?? null,
          purchased_at: (p.purchased_at as string | null) ?? null,
        }));

        // Cargar perfiles para obtener el full_name de cada alumno (cuando tenga user vinculado)
        const userIds = Array.from(
          new Set(
            effectiveStudents
              .map((s) => s.user_id)
              .filter((id): id is string => !!id)
          )
        );

        let profilesMap: Record<string, ProfileRow> = {};
        if (userIds.length > 0) {
          const profilesRes = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

          if (profilesRes.error) throw profilesRes.error;

          const profilesData = (profilesRes.data ?? []) as ProfileRow[];
          profilesMap = profilesData.reduce<Record<string, ProfileRow>>((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {});
        }

        // Cargar usos de clases por plan para calcular clases restantes reales
        let usageCountsByPlan: Record<string, number> = {};
        if (plansData.length > 0) {
          const studentPlanIds = plansData.map((p) => p.id);
          const { data: usagesData, error: usagesErr } = await supabase
            .from('plan_usages')
            .select('student_plan_id')
            .in('student_plan_id', studentPlanIds)
            .in('status', ['pending', 'confirmed']);

          if (usagesErr) throw usagesErr;

          usageCountsByPlan = (usagesData ?? []).reduce<Record<string, number>>((acc, u: any) => {
            const pid = u.student_plan_id as string;
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
          }, {});
        }

        // Cargar pagos por plan para calcular saldo pendiente y elegir el plan activo
        let paidByPlan: Record<string, number> = {};
        if (plansData.length > 0) {
          const studentPlanIds = plansData.map((p) => p.id);
          const { data: payRows, error: payErr } = await supabase
            .from('payments')
            .select('student_plan_id, amount, status')
            .in('student_plan_id', studentPlanIds);

          if (payErr) throw payErr;

          paidByPlan = (payRows ?? []).reduce<Record<string, number>>((acc, p: any) => {
            const pid = p.student_plan_id as string | null | undefined;
            if (!pid) return acc;
            if (p.status !== 'pagado') return acc;
            const amt = Number(p.amount ?? 0);
            acc[pid] = (acc[pid] || 0) + (Number.isFinite(amt) ? amt : 0);
            return acc;
          }, {});
        }

        // Construir mapas de planes
        const plansMap: Record<string, StudentPlanRow> = {};

        const scorePlan = (plan: StudentPlanRow) => {
          const used = usageCountsByPlan[plan.id] || 0;
          const baseTotal = (plan.total_classes ?? plan.remaining_classes) ?? 0;
          const effectiveRemaining = Math.max(0, baseTotal - used);
          const totalPrice = Number(plan.final_price ?? plan.base_price ?? 0);
          const totalPaid = paidByPlan[plan.id] || 0;
          const balancePending = Math.max(0, totalPrice - totalPaid);
          const purchasedAtMs = plan.purchased_at ? new Date(plan.purchased_at).getTime() : 0;
          const isActive = effectiveRemaining > 0 || balancePending > 0;
          return {
            used,
            baseTotal,
            effectiveRemaining,
            totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
            totalPaid,
            balancePending,
            purchasedAtMs,
            isActive,
          };
        };

        const isBetterPlan = (candidate: StudentPlanRow, existing: StudentPlanRow) => {
          const c = scorePlan(candidate);
          const e = scorePlan(existing);
          if (c.isActive && !e.isActive) return true;
          if (!c.isActive && e.isActive) return false;
          if (c.purchasedAtMs !== e.purchasedAtMs) return c.purchasedAtMs > e.purchasedAtMs;
          return false;
        };

        for (const p of plansData) {
          const used = usageCountsByPlan[p.id] || 0;
          const baseTotal = (p.total_classes ?? p.remaining_classes) ?? 0;
          const effectiveRemaining = Math.max(0, baseTotal - used);
          const totalPrice = Number(p.final_price ?? p.base_price ?? 0);
          const totalPaid = paidByPlan[p.id] || 0;
          const balancePending = Math.max(0, totalPrice - totalPaid);
          const withEffective: StudentPlanRow = {
            ...p,
            remaining_classes: effectiveRemaining,
            total_classes: baseTotal,
            used_classes: used,
            total_price: Number.isFinite(totalPrice) ? totalPrice : 0,
            total_paid: totalPaid,
            balance_pending: balancePending,
          };
          const existing = plansMap[p.student_id];
          if (!existing) {
            plansMap[p.student_id] = withEffective;
          } else if (isBetterPlan(withEffective, existing)) {
            plansMap[p.student_id] = withEffective;
          }
        }

        let planNamesMap: Record<string, string> = {};
        {
          const plansRes = await supabase.from('plans').select('id, name');
          if (plansRes.error) throw plansRes.error;

          const plansRows = (plansRes.data ?? []) as { id: string; name: string }[];
          planNamesMap = plansRows.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.name;
            return acc;
          }, {});
        }

        setStudents(effectiveStudents);

        let selfRow: StudentRow | null = null;
        if (roleFromProfile === 'student') {
          selfRow = studentsData.find((s) => s.user_id === userId) ?? null;
          setCurrentStudentId(selfRow?.id ?? null);
        } else {
          setCurrentStudentId(null);
        }
        setPlansByStudent(plansMap);
        setPlanNamesById(planNamesMap);
        setProfilesByUser(profilesMap);

        // Pagos recientes del alumno actual para mostrar dentro de Mi cuenta
        let paymentsRows: StudentPayment[] = [];
        if (roleFromProfile === 'student' && selfRow) {
          const { data: payData, error: payErr } = await supabase
            .from('payments')
            .select('id,amount,currency,payment_date,method,status')
            .eq('student_id', selfRow.id)
            .order('payment_date', { ascending: false })
            .limit(10);

          if (payErr) throw payErr;
          paymentsRows = ((payData ?? []) as unknown as StudentPayment[]);
        }

        setStudentPayments(paymentsRows);

        // Construir listado de "mis alumnos" para coach (alumnos con clases futuras con este coach)
        let myIds: string[] = [];
        let nextByStudent: Record<string, string | null> = {};
        let studentsWithNotesList: string[] = [];
        if (roleFromProfile === 'coach' && userId) {
          const { data: coachRow, error: coachErr } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (coachErr) throw coachErr;
          const coachId = coachRow?.id as string | undefined;
          if (coachId) {
            setCoachIdForNotes(coachId);
          }

          if (coachId) {
            // Leer academia seleccionada para el coach desde localStorage
            let coachSelectedAcademyId: string | null = null;
            if (typeof window !== 'undefined') {
              const stored = window.localStorage.getItem('selectedAcademyId');
              coachSelectedAcademyId = stored && stored.trim() ? stored : null;
            }

            let locationIds: string[] | null = null;
            if (coachSelectedAcademyId) {
              const { data: locRows, error: locErr } = await supabase
                .from('academy_locations')
                .select('location_id')
                .eq('academy_id', coachSelectedAcademyId);
              if (locErr) throw locErr;
              locationIds = ((locRows as { location_id: string | null }[] | null) ?? [])
                .map((row) => row.location_id)
                .filter((id): id is string => !!id);
            }

            const futureFrom = new Date();
            const futureTo = new Date(futureFrom.getTime() + 14 * 24 * 60 * 60 * 1000);

            let classes: { id: string; date: string }[] = [];
            if (locationIds && locationIds.length > 0) {
              // Clases futuras del coach solo en las sedes de la academia seleccionada
              const { data: futureClasses, error: futureErr } = await supabase
                .from('class_sessions')
                .select('id,date,courts!inner(location_id)')
                .eq('coach_id', coachId)
                .gte('date', futureFrom.toISOString())
                .lte('date', futureTo.toISOString())
                .in('courts.location_id', locationIds);
              if (futureErr) throw futureErr;
              classes = (futureClasses ?? []) as { id: string; date: string }[];
            } else {
              // Sin academia seleccionada (o sin sedes vinculadas): fallback a todas las clases del coach
              const { data: futureClasses, error: futureErr } = await supabase
                .from('class_sessions')
                .select('id,date')
                .eq('coach_id', coachId)
                .gte('date', futureFrom.toISOString())
                .lte('date', futureTo.toISOString());
              if (futureErr) throw futureErr;
              classes = (futureClasses ?? []) as { id: string; date: string }[];
            }

            if (classes.length > 0) {
              const classIdMap: Record<string, string> = {};
              classes.forEach((c: any) => {
                classIdMap[c.id as string] = c.date as string;
              });

              const classIds = classes.map((c: any) => c.id as string);
              const { data: bookingsData, error: bookingsErr } = await supabase
                .from('bookings')
                .select('student_id,class_id')
                .in('class_id', classIds);
              if (bookingsErr) throw bookingsErr;

              const idSet = new Set<string>();
              const nextMap: Record<string, string | null> = {};
              (bookingsData ?? []).forEach((b: any) => {
                const sid = b.student_id as string;
                const cid = b.class_id as string;
                idSet.add(sid);
                const dateStr = classIdMap[cid];
                if (!dateStr) return;
                const prev = nextMap[sid];
                if (!prev || new Date(dateStr) < new Date(prev)) {
                  nextMap[sid] = dateStr;
                }
              });

              myIds = Array.from(idSet);
              nextByStudent = nextMap;
            }

            // Buscar alumnos que tengan al menos una nota cargada por este coach
            const { data: notesByStudent, error: notesByStudentErr } = await supabase
              .from('class_notes')
              .select('student_id')
              .eq('coach_id', coachId);
            if (notesByStudentErr) throw notesByStudentErr;
            const notesSet = new Set<string>();
            (notesByStudent ?? []).forEach((n: any) => {
              if (n.student_id) notesSet.add(n.student_id as string);
            });
            studentsWithNotesList = Array.from(notesSet);
          }
        }

        setMyStudentIds(myIds);
        setNextClassByStudent(nextByStudent);
        setStudentsWithNotes(studentsWithNotesList);
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando alumnos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  const openHistory = async (studentId: string, displayName: string) => {
    setHistoryStudent({ id: studentId, name: displayName });
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryItems([]);
    setClassNotesByClass({});
    setEditingNote(null);
    setNotesError(null);
    try {
      // Cargar clases confirmadas + pendientes (Opción A)
      const { data: usagesData, error: usagesErr } = await supabase
        .from('plan_usages')
        .select('class_id, student_plan_id, status, class_sessions!inner(id,date,court_id,coach_id)')
        .eq('student_id', studentId)
        .in('status', ['confirmed', 'pending'])
        .limit(50);

      if (usagesErr) throw usagesErr;

      const rawUsages = (usagesData ?? []) as any[];
      const byClassId: Record<
        string,
        {
          classId: string;
          studentPlanId: string | null;
          usageStatus: 'pending' | 'confirmed';
          classSession: { id: string; date: string; court_id: string | null; coach_id: string | null };
        }
      > = {};

      rawUsages.forEach((u: any) => {
        const cls = u.class_sessions as any;
        const classId = (u.class_id as string | null) ?? (cls?.id as string | null);
        if (!classId || !cls?.id) return;
        if (byClassId[classId]) return;
        byClassId[classId] = {
          classId,
          studentPlanId: (u.student_plan_id as string | null) ?? null,
          usageStatus: ((u.status as string | null) === 'pending' ? 'pending' : 'confirmed'),
          classSession: {
            id: cls.id as string,
            date: cls.date as string,
            court_id: (cls.court_id as string | null) ?? null,
            coach_id: (cls.coach_id as string | null) ?? null,
          },
        };
      });

      const classSessions = Object.values(byClassId);

      if (!classSessions.length) {
        setHistoryItems([]);
        return;
      }

      const courtIds = Array.from(
        new Set(
          classSessions
            .map((c) => c.classSession.court_id)
            .filter((id): id is string => !!id)
        )
      );
      const coachIds = Array.from(
        new Set(
          classSessions
            .map((c) => c.classSession.coach_id)
            .filter((id): id is string => !!id)
        )
      );

      const planIds = Array.from(
        new Set(
          classSessions
            .map((c) => c.studentPlanId)
            .filter((id): id is string => !!id)
        )
      );

      let planInfoById: Record<string, { name: string | null; purchased_at: string | null }> = {};
      if (planIds.length) {
        const { data: spRows, error: spErr } = await supabase
          .from('student_plans')
          .select('id, purchased_at, plans(name)')
          .in('id', planIds);
        if (spErr) throw spErr;

        planInfoById = (spRows ?? []).reduce<Record<string, { name: string | null; purchased_at: string | null }>>(
          (acc, row: any) => {
            const pid = row.id as string;
            const planName = ((row as any)?.plans?.name as string | undefined) ?? null;
            acc[pid] = {
              name: planName,
              purchased_at: (row.purchased_at as string | null) ?? null,
            };
            return acc;
          },
          {},
        );
      }

      let courtsMap: Record<string, { id: string; name: string }> = {};
      let coachesMap: Record<string, { id: string; user_id: string | null }> = {};
      let coachNamesMap: Record<string, string | null> = {};

      if (courtIds.length) {
        const { data: courtsData, error: courtsErr } = await supabase
          .from('courts')
          .select('id,name')
          .in('id', courtIds);
        if (courtsErr) throw courtsErr;
        courtsMap = (courtsData ?? []).reduce<Record<string, { id: string; name: string }>>((acc, c: any) => {
          acc[c.id] = { id: c.id, name: c.name };
          return acc;
        }, {});
      }

      if (coachIds.length) {
        const { data: coachesData, error: coachesErr } = await supabase
          .from('coaches')
          .select('id,user_id')
          .in('id', coachIds);
        if (coachesErr) throw coachesErr;
        coachesMap = (coachesData ?? []).reduce<Record<string, { id: string; user_id: string | null }>>(
          (acc, c: any) => {
            acc[c.id] = { id: c.id, user_id: c.user_id };
            return acc;
          },
          {}
        );

        const coachUserIds = Array.from(
          new Set(
            (coachesData ?? [])
              .map((c: any) => c.user_id)
              .filter((id: string | null): id is string => !!id)
          )
        );

        if (coachUserIds.length) {
          const { data: profilesData, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', coachUserIds);
          if (profErr) throw profErr;
          coachNamesMap = (profilesData ?? []).reduce<Record<string, string | null>>((acc, p: any) => {
            acc[p.id] = p.full_name;
            return acc;
          }, {});
        }
      }

      const items = classSessions.map((cls) => {
        const courtId = cls.classSession.court_id;
        const coachId = cls.classSession.coach_id;
        const court = courtId ? courtsMap[courtId] : undefined;
        const coach = coachId ? coachesMap[coachId] : undefined;
        const coachName = coach?.user_id ? coachNamesMap[coach.user_id] ?? null : null;
        const planInfo = cls.studentPlanId ? planInfoById[cls.studentPlanId] : undefined;
        return {
          id: cls.classSession.id,
          date: cls.classSession.date,
          courtName: court?.name ?? null,
          coachName: coachName,
          studentPlanId: cls.studentPlanId,
          planName: planInfo?.name ?? null,
          planPurchasedAt: planInfo?.purchased_at ?? null,
          usageStatus: cls.usageStatus,
          attendancePresent: null,
          attendanceMarkedAt: null,
          attendanceMarkedByName: null,
        };
      });

      // Ordenar por fecha descendente por si acaso
      items.sort((a, b) => b.date.localeCompare(a.date));

      // Cargar asistencia para estas clases (para mostrar Presente/Ausente/Sin marcar)
      const classIdsForAttendance = items.map((i) => i.id);
      const attendanceMap = new Map<
        string,
        { present: boolean | null; marked_at: string | null; marked_by_user_id: string | null }
      >();
      if (classIdsForAttendance.length) {
        const { data: attRows, error: attErr } = await supabase
          .from('attendance')
          .select('class_id,present,marked_at,marked_by_user_id')
          .eq('student_id', studentId)
          .in('class_id', classIdsForAttendance);
        if (attErr) throw attErr;
        (attRows ?? []).forEach((r: any) => {
          const cid = r.class_id as string | null;
          if (!cid) return;
          attendanceMap.set(cid, {
            present: (r.present as boolean | null) ?? null,
            marked_at: (r.marked_at as string | null) ?? null,
            marked_by_user_id: (r.marked_by_user_id as string | null) ?? null,
          });
        });
      }

      let markedByNameByUserId: Record<string, string | null> = {};
      const showMarkedBy = role === 'admin' || role === 'super_admin' || role === 'coach';
      if (showMarkedBy) {
        const markerUserIds = Array.from(
          new Set(
            Array.from(attendanceMap.values())
              .map((a) => a.marked_by_user_id)
              .filter((id): id is string => !!id)
          )
        );
        if (markerUserIds.length) {
          const { data: profRows, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', markerUserIds);
          if (profErr) throw profErr;
          markedByNameByUserId = (profRows ?? []).reduce<Record<string, string | null>>((acc, p: any) => {
            acc[p.id] = (p.full_name as string | null) ?? null;
            return acc;
          }, {});
        }
      }

      const merged = items.map((it) => {
        const att = attendanceMap.get(it.id);
        const markedByName =
          showMarkedBy && att?.marked_by_user_id ? markedByNameByUserId[att.marked_by_user_id] ?? null : null;
        return {
          ...it,
          attendancePresent: att ? (att.present ?? null) : null,
          attendanceMarkedAt: att ? (att.marked_at ?? null) : null,
          attendanceMarkedByName: markedByName,
        };
      });

      setHistoryItems(merged);

      // Cargar notas de clase para este alumno y estas clases
      const classIds = merged.map((i) => i.id);
      if (classIds.length) {
        let notesQuery = supabase
          .from('class_notes')
          .select('id,class_id,student_id,coach_id,note,visible_to_student,visible_to_coach')
          .eq('student_id', studentId)
          .in('class_id', classIds);

        // Visibilidad:
        // - student: solo lo visible al alumno
        // - coach: ve sus propias notas y las del admin que estén marcadas visibles para coach
        // - admin/super_admin: ve todo
        if (role === 'student') {
          notesQuery = notesQuery.eq('visible_to_student', true);
        }
        if (role === 'coach') {
          if (coachIdForNotes) {
            notesQuery = notesQuery.or(`coach_id.eq.${coachIdForNotes},visible_to_coach.eq.true`);
          } else {
            notesQuery = notesQuery.eq('visible_to_coach', true);
          }
        }

        const { data: notesData, error: notesErr } = await notesQuery;

        if (notesErr) {
          console.error('Error cargando notas de clases', notesErr.message);
        } else {
          const map: Record<
            string,
            {
              id: string;
              note: string;
              coach_id: string | null;
              visible_to_student: boolean | null;
              visible_to_coach: boolean | null;
            }[]
          > = {};
          (notesData ?? []).forEach((n: any) => {
            const cid = n.class_id as string;
            if (!map[cid]) map[cid] = [];
            map[cid].push({
              id: n.id as string,
              note: n.note as string,
              coach_id: (n.coach_id as string | null) ?? null,
              visible_to_student: (n.visible_to_student as boolean | null) ?? null,
              visible_to_coach: (n.visible_to_coach as boolean | null) ?? null,
            });
          });

          // Estabilizar cuál nota se usa como "primera" en UI
          // - coach: prioriza su propia nota (si existe) y luego la del admin
          if (role === 'coach' && coachIdForNotes) {
            Object.keys(map).forEach((cid) => {
              map[cid].sort((a, b) => {
                const aIsMine = a.coach_id === coachIdForNotes;
                const bIsMine = b.coach_id === coachIdForNotes;
                if (aIsMine !== bIsMine) return aIsMine ? -1 : 1;
                const aIsAdmin = !a.coach_id;
                const bIsAdmin = !b.coach_id;
                if (aIsAdmin !== bIsAdmin) return aIsAdmin ? -1 : 1;
                return 0;
              });
            });
          }

          setClassNotesByClass(map);
        }
      }
    } catch (err: any) {
      setHistoryError(err?.message ?? 'Error cargando historial de clases.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenSelfHistory = () => {
    if (!currentStudentId) return;
    const self = students.find((s) => s.id === currentStudentId) ?? null;
    if (!self) return;
    const profile = self.user_id ? profilesByUser[self.user_id] : undefined;
    const displayName = profile?.full_name || 'Mi historial de clases';
    openHistory(currentStudentId, displayName);
  };

  const handleStartEditNote = (classId: string, currentNote: string) => {
    const existing = (classNotesByClass[classId] ?? [])[0] ?? null;
    setEditingNote({
      classId,
      draft: currentNote,
      visibleToStudent: existing?.visible_to_student ?? false,
      visibleToCoach: existing?.visible_to_coach ?? true,
    });
    setNotesError(null);
  };

  const handleCancelEditNote = () => {
    setEditingNote(null);
    setNotesError(null);
  };

  const handleSaveNote = async () => {
    if (!editingNote || !historyStudent) return;
    if (role === 'coach' && !coachIdForNotes) {
      setNotesError('No se pudo identificar tu usuario como profesor para guardar la nota.');
      return;
    }

    const { classId, draft, visibleToStudent, visibleToCoach } = editingNote;
    const existing = (classNotesByClass[classId] ?? [])[0] ?? null;

    const isAdminLike = role === 'admin' || role === 'super_admin';
    const isCoach = role === 'coach';

    try {
      setSavingNote(true);
      setNotesError(null);

      if (existing) {
        const updatePayload: any = { note: draft };
        if (isAdminLike) {
          updatePayload.visible_to_student = visibleToStudent;
          updatePayload.visible_to_coach = visibleToCoach;
        } else if (isCoach) {
          updatePayload.visible_to_student = visibleToStudent;
          updatePayload.visible_to_coach = true;
        }

        const { error } = await supabase.from('class_notes').update(updatePayload).eq('id', existing.id);
        if (error) throw error;
        setClassNotesByClass((prev) => ({
          ...prev,
          [classId]: [
            {
              id: existing.id,
              note: draft,
              coach_id: existing.coach_id ?? null,
              visible_to_student: isAdminLike || isCoach ? visibleToStudent : existing.visible_to_student ?? null,
              visible_to_coach: isAdminLike ? visibleToCoach : true,
            },
          ],
        }));
      } else {
        const insertPayload: any = {
          class_id: classId,
          student_id: historyStudent.id,
          note: draft,
        };
        if (isAdminLike) {
          insertPayload.coach_id = null;
          insertPayload.visible_to_student = visibleToStudent;
          insertPayload.visible_to_coach = visibleToCoach;
        } else {
          insertPayload.coach_id = coachIdForNotes;
          insertPayload.visible_to_student = visibleToStudent;
          insertPayload.visible_to_coach = true;
        }

        const { data, error } = await supabase
          .from('class_notes')
          .insert(insertPayload)
          .select('id,note,coach_id,visible_to_student,visible_to_coach')
          .single();
        if (error) throw error;
        const newId = (data as any).id as string;
        const newNote = (data as any).note as string;
        const newCoachId = ((data as any).coach_id as string | null) ?? null;
        const newVisStudent = ((data as any).visible_to_student as boolean | null) ?? null;
        const newVisCoach = ((data as any).visible_to_coach as boolean | null) ?? null;
        setClassNotesByClass((prev) => ({
          ...prev,
          [classId]: [
            {
              id: newId,
              note: newNote,
              coach_id: newCoachId,
              visible_to_student: newVisStudent,
              visible_to_coach: newVisCoach,
            },
          ],
        }));
      }

      setEditingNote(null);
      toast.success('Nota guardada correctamente.');
    } catch (err: any) {
      setNotesError(err?.message ?? 'No se pudo guardar la nota.');
      toast.error(err?.message ?? 'No se pudo guardar la nota.');
    } finally {
      setSavingNote(false);
    }
  };

  if (!roleResolved) {
    return (
      <section className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1d3b4f] to-[#3cadaf] text-white">
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
            <div className="text-xs text-white/80 mt-1">Cargando tu cuenta.....</div>
          </div>
        </div>
      </section>
    );
  }

  if (checking) {
    return (
      <section className="mt-4 space-y-4 max-w-5xl mx-auto px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <Users className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
            <div className="space-y-0.5">
              <h1 className="text-2xl font-semibold text-[#31435d]">{role === 'student' ? 'Mi cuenta' : 'Alumnos'}</h1>
              <p className="text-sm text-gray-600">Cargando...</p>
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
      </section>
    );
  }

  const currentPlanInfo = currentStudentId ? plansByStudent[currentStudentId] : undefined;
  const planTotal = currentPlanInfo?.final_price ?? currentPlanInfo?.base_price ?? null;
  const totalPaid = studentPayments.reduce((acc, p) => (p.status === 'pagado' ? acc + (p.amount ?? 0) : acc), 0);

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Users className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">{role === 'student' ? 'Mi cuenta' : 'Alumnos'}</h1>
            {role === 'student' ? (
              <p className="text-sm text-gray-600">Resumen de tu plan y clases disponibles.</p>
            ) : (
              <p className="text-sm text-gray-600">
                Listado de alumnos con su plan activo y clases restantes (si corresponde).
              </p>
            )}
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

      {role === 'student' && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
            <p className="text-sm font-semibold text-[#31435d]">Tus pagos recientes</p>
            <div className="text-[11px] text-gray-600">
              {planTotal != null ? (
                <>
                  <span className="font-semibold text-[#31435d]">Pagado:</span>{' '}
                  {formatPyg(totalPaid)} / {formatPyg(planTotal)} PYG
                </>
              ) : (
                <span>Sin monto total definido para el plan.</span>
              )}
            </div>
          </div>
          <div className="px-4 py-3 text-sm">
            {loading ? (
              <p className="text-gray-600">Cargando pagos...</p>
            ) : studentPayments.length === 0 ? (
              <p className="text-gray-600">Todavía no registramos pagos a tu nombre.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-600">
                      <th className="py-2 px-2 text-left font-medium">Fecha</th>
                      <th className="py-2 px-2 text-left font-medium">Método</th>
                      <th className="py-2 px-2 text-right font-medium">Monto</th>
                      <th className="py-2 px-2 text-center font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPayments.map((p) => {
                      const d = new Date(p.payment_date);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const dd = String(d.getDate()).padStart(2, '0');
                      return (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="py-1.5 px-2">{`${dd}/${mm}/${yyyy}`}</td>
                          <td className="py-1.5 px-2 capitalize">{p.method}</td>
                          <td className="py-1.5 px-2 text-right">{formatPyg(p.amount)} {p.currency}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span
                              className={
                                'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
                                (p.status === 'pagado'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-100')
                              }
                            >
                              {p.status}
                            </span>
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
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
          <p className="text-sm font-semibold text-[#31435d]">
            {role === 'student' ? 'Resumen de tu cuenta' : 'Listado general'}
          </p>
          <div className="flex items-center gap-3">
            {(role === 'admin' || role === 'super_admin') && (
              <span className="text-xs text-gray-500">
                {loading ? 'Cargando...' : `${students.length} alumno${students.length === 1 ? '' : 's'}`}
              </span>
            )}
            {role === 'student' && (
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-[#3cadaf] hover:bg-[#31435d] text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-60"
                // Sin funcionalidad por ahora; se implementará cuando se integren pagos online
                disabled={loading}
              >
                Pagar ahora
              </button>
            )}
          </div>
        </div>
        <div className="px-4 py-3 space-y-3">
          {/* Vista para admin/super_admin: tabla completa */}
          {(role === 'admin' || role === 'super_admin') && (
            <>
              {!loading && students.length > 0 && (
                <div className="max-w-xs">
                  <label className="block text-xs mb-1 text-gray-600">Buscar alumno</label>
                  <Input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nombre o nota del alumno"
                    className="h-10 text-base"
                  />
                </div>
              )}
              {loading ? (
                <p className="text-sm text-gray-600">Cargando alumnos...</p>
              ) : students.length === 0 ? (
                <p className="text-sm text-gray-600">Todavía no hay alumnos registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[320px]">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-gray-600">
                        <th className="py-2 px-3 text-left font-medium">Alumno</th>
                        <th className="py-2 px-3 text-left font-medium">Plan</th>
                        <th className="py-2 px-3 text-center font-medium">Clases restantes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students
                        .filter((s) => {
                          const term = search.trim().toLowerCase();
                          if (!term) return true;
                          const profile = s.user_id ? profilesByUser[s.user_id] : undefined;
                          const name = profile?.full_name || '';
                          const notes = s.notes || '';
                          const level = s.level || '';
                          const combined = `${name} ${notes} ${level}`.toLowerCase();
                          return combined.includes(term);
                        })
                        .map((s) => {
                          const planInfo = plansByStudent[s.id];
                          const planId = planInfo?.plan_id ?? null;
                          const planNameRaw =
                            (planInfo?.plans && planInfo.plans.name) ||
                            (planId ? planNamesById[planId] ?? null : null);
                          const planName = planNameRaw && planNameRaw.trim().length > 0 ? planNameRaw : '-';
                          const remaining = planInfo?.remaining_classes ?? null;

                          const profile = s.user_id ? profilesByUser[s.user_id] : undefined;
                          const displayName = profile?.full_name || '(Sin nombre vinculado)';

                          return (
                            <tr
                              key={s.id}
                              className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer transition-colors"
                              onClick={() => openHistory(s.id, displayName)}
                            >
                              <td className="py-2 px-3">
                                <span className="block font-medium text-slate-800 truncate">{displayName}</span>
                                {s.notes && (
                                  <span className="mt-0.5 block text-xs text-gray-500 truncate">{s.notes}</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                                  {planName}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={
                                    "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                                    (remaining !== null && remaining > 0
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                      : remaining === 0
                                      ? "bg-amber-50 text-amber-700 border border-amber-100"
                                      : "bg-slate-50 text-slate-500 border border-slate-200")
                                  }
                                >
                                  {remaining !== null ? remaining : '-'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Vista para coach: cards de alumnos */}
          {role === 'coach' && (
            <>
              {students.length === 0 ? (
                <p className="text-sm text-gray-600">Todavía no hay alumnos registrados.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] text-slate-700">
                      <span className="font-semibold">{students.length}</span>
                      <span>alumnos totales</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowOnlyMyStudents(true)}
                        className={
                          "px-3 py-1 text-xs rounded-full border text-sm font-medium " +
                          (showOnlyMyStudents
                            ? "bg-[#3cadaf] border-[#3cadaf] text-white"
                            : "bg-white border-slate-200 text-slate-700")
                        }
                      >
                        Solo mis alumnos
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowOnlyMyStudents(false)}
                        className={
                          "px-3 py-1 text-xs rounded-full border text-sm font-medium " +
                          (!showOnlyMyStudents
                            ? "bg-[#3cadaf] border-[#3cadaf] text-white"
                            : "bg-white border-slate-200 text-slate-700")
                        }
                      >
                        Todos los alumnos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {(() => {
                      const mySet = new Set(myStudentIds);
                      const withNotesSet = new Set(studentsWithNotes);
                      return students
                        .filter((s) => {
                          if (showOnlyMyStudents && !mySet.has(s.id)) return false;
                          const term = search.trim().toLowerCase();
                          if (!term) return true;
                          const profile = s.user_id ? profilesByUser[s.user_id] : undefined;
                          const name = profile?.full_name || '';
                          const notes = s.notes || '';
                          const level = s.level || '';
                          const combined = `${name} ${notes} ${level}`.toLowerCase();
                          return combined.includes(term);
                        })
                        .map((s) => {
                          const planInfo = plansByStudent[s.id];
                          const planId = planInfo?.plan_id ?? null;
                          const planNameRaw =
                            (planInfo?.plans && planInfo.plans.name) ||
                            (planId ? planNamesById[planId] ?? null : null);
                          const planName = planNameRaw && planNameRaw.trim().length > 0 ? planNameRaw : '-';
                          const remaining = planInfo?.remaining_classes ?? null;

                          const profile = s.user_id ? profilesByUser[s.user_id] : undefined;
                          const displayName = profile?.full_name || '(Sin nombre vinculado)';

                          const nextClassDate = nextClassByStudent[s.id] ?? null;
                          let nextLabel = 'Sin próximas clases con vos.';
                          if (nextClassDate) {
                            const d = new Date(nextClassDate);
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            const hh = String(d.getHours()).padStart(2, '0');
                            const min = String(d.getMinutes()).padStart(2, '0');
                            nextLabel = `Próxima clase con vos: ${dd}/${mm}/${yyyy} ${hh}:${min} hs`;
                          }

                          const hasNotes = withNotesSet.has(s.id);

                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => openHistory(s.id, displayName)}
                              className="border rounded-2xl p-4 bg-white shadow-sm text-left hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                                  {s.level && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">Nivel: {s.level}</p>
                                  )}
                                  {s.notes && (
                                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{s.notes}</p>
                                  )}
                                </div>
                                {hasNotes && (
                                  <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    Con notas
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                                  Plan: {planName}
                                </span>
                                <span
                                  className={
                                    "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                                    (remaining !== null && remaining > 0
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                      : remaining === 0
                                      ? "bg-amber-50 text-amber-700 border-amber-100 border"
                                      : "bg-slate-50 text-slate-500 border border-slate-200")
                                  }
                                >
                                  Clases restantes: {remaining !== null ? remaining : '-'}
                                </span>
                              </div>
                              <p className="mt-2 text-[11px] text-slate-500">{nextLabel}</p>
                            </button>
                          );
                        });
                    })()}
                  </div>
                </>
              )}
            </>
          )}

          {/* Vista para student: resumen propio */}
          {role === 'student' && !loading && currentPlanInfo && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="font-semibold text-[#31435d]">Clases totales:</span>{' '}
                  {currentPlanInfo.total_classes != null ? currentPlanInfo.total_classes : '-'}
                </div>
                <div>
                  <span className="font-semibold text-[#31435d]">Usadas:</span>{' '}
                  {currentPlanInfo.used_classes != null ? currentPlanInfo.used_classes : '-'}
                </div>
                <div>
                  <span className="font-semibold text-[#31435d]">Restantes:</span>{' '}
                  {currentPlanInfo.remaining_classes != null ? currentPlanInfo.remaining_classes : '-'}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleOpenSelfHistory}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ver historial de clases
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {historyStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b px-4 pt-4 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[#3cadaf]" />
                  <h2 className="text-base font-semibold text-[#31435d]">Historial de clases</h2>
                </div>
                <p className="text-xs text-gray-500">{historyStudent.name}</p>
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                onClick={() => {
                  setHistoryStudent(null);
                  setHistoryItems([]);
                  setHistoryError(null);
                }}
              >
                Cerrar
              </button>
            </div>
            <div className="px-4 py-3 overflow-y-auto text-sm">
              {historyLoading && <p className="text-sm text-gray-600">Cargando historial...</p>}
              {historyError && <p className="mb-2 text-sm text-red-600">{historyError}</p>}
              {!historyLoading && !historyError && historyItems.length === 0 && (
                <p className="text-sm text-gray-600">Este alumno aún no tiene clases registradas.</p>
              )}
              {!historyLoading && !historyError && historyItems.length > 0 && (
                <div className="space-y-4">
                  {(() => {
                    const showMarkedBy = role === 'admin' || role === 'super_admin' || role === 'coach';
                    const confirmed = historyItems.filter((x) => x.usageStatus === 'confirmed');
                    const pending = historyItems.filter((x) => x.usageStatus === 'pending');

                    const renderSection = (title: string, itemsInSection: typeof historyItems) => {
                      if (!itemsInSection.length) return null;

                      const groups: Record<string, typeof historyItems> = {};
                      itemsInSection.forEach((it) => {
                        const key = it.studentPlanId ?? 'unknown';
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(it);
                      });

                      const groupKeys = Object.keys(groups).sort((a, b) => {
                        const aItem = groups[a]?.[0] ?? null;
                        const bItem = groups[b]?.[0] ?? null;
                        const aMs = aItem?.planPurchasedAt ? new Date(aItem.planPurchasedAt).getTime() : 0;
                        const bMs = bItem?.planPurchasedAt ? new Date(bItem.planPurchasedAt).getTime() : 0;
                        if (aMs !== bMs) return bMs - aMs;
                        return a.localeCompare(b);
                      });

                      return (
                        <div className="space-y-2">
                          <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px] border-collapse text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50 text-xs text-gray-600">
                                  <th className="py-1.5 px-2 text-left font-medium">Fecha</th>
                                  <th className="py-1.5 px-2 text-left font-medium">Hora</th>
                                  <th className="py-1.5 px-2 text-left font-medium">Cancha</th>
                                  <th className="py-1.5 px-2 text-left font-medium">Profesor</th>
                                  <th className="py-1.5 px-2 text-left font-medium">Asistencia</th>
                                  <th className="py-1.5 px-2 text-left font-medium">Marcado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupKeys.flatMap((key) => {
                                  const items = groups[key] ?? [];
                                  const headerName = items[0]?.planName ?? (key === 'unknown' ? 'Plan sin identificar' : 'Plan');

                                  const headerRow = (
                                    <tr key={`${title}-${key}-header`} className="border-b bg-slate-50">
                                      <td colSpan={6} className="py-2 px-2 text-xs font-semibold text-slate-700">
                                        {headerName}
                                      </td>
                                    </tr>
                                  );

                                  const rows = items.flatMap((item) => {
                                    const d = new Date(item.date);
                                    const yyyy = d.getFullYear();
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    const hh = String(d.getHours()).padStart(2, '0');
                                    const min = String(d.getMinutes()).padStart(2, '0');

                                    const attLabel =
                                      item.attendancePresent == null
                                        ? 'Sin marcar'
                                        : item.attendancePresent
                                          ? 'Presente'
                                          : 'Ausente';

                                    const attClass =
                                      item.attendancePresent == null
                                        ? 'bg-slate-50 text-slate-700 border border-slate-200'
                                        : item.attendancePresent
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                          : 'bg-red-50 text-red-700 border border-red-100';

                                    let markedText = '-';
                                    if (item.attendanceMarkedAt) {
                                      const md = new Date(item.attendanceMarkedAt);
                                      const mY = md.getFullYear();
                                      const mM = String(md.getMonth() + 1).padStart(2, '0');
                                      const mD = String(md.getDate()).padStart(2, '0');
                                      const mH = String(md.getHours()).padStart(2, '0');
                                      const mMin = String(md.getMinutes()).padStart(2, '0');
                                      const when = `${mD}/${mM}/${mY} ${mH}:${mMin}`;
                                      if (showMarkedBy) {
                                        const who = item.attendanceMarkedByName || 'Usuario';
                                        markedText = `${who} • ${when}`;
                                      } else {
                                        markedText = when;
                                      }
                                    }

                                    const notesArr = classNotesByClass[item.id] ?? [];
                                    const firstNote = notesArr[0] ?? null;
                                    const isCoach = role === 'coach';
                                    const isAdmin = role === 'admin' || role === 'super_admin';
                                    const coachCanEditThisNote =
                                      !isCoach || !firstNote || (!!coachIdForNotes && firstNote.coach_id === coachIdForNotes);

                                    return [
                                      (
                                        <tr key={`${title}-${item.id}-row`} className="border-b last:border-b-0">
                                          <td className="py-1.5 px-2">{`${dd}/${mm}/${yyyy}`}</td>
                                          <td className="py-1.5 px-2">{`${hh}:${min}`}</td>
                                          <td className="py-1.5 px-2">{item.courtName ?? '-'}</td>
                                          <td className="py-1.5 px-2">{item.coachName ?? '-'}</td>
                                          <td className="py-1.5 px-2">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${attClass}`}>
                                              {attLabel}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-xs text-slate-600">{markedText}</td>
                                        </tr>
                                      ),
                                      (
                                        <tr key={`${title}-${item.id}-note`} className="border-b last:border-b-0">
                                          <td colSpan={6} className="py-1.5 px-2 bg-gray-50/40">
                                            {isCoach ? (
                                      <div className="space-y-1">
                                        {editingNote && editingNote.classId === item.id ? (
                                          <div className="space-y-1">
                                            <label className="block text-xs text-gray-600">Nota para esta clase</label>
                                            <textarea
                                              className="w-full border rounded-md px-2 py-1 text-base resize-y min-h-[60px]"
                                              style={{ fontSize: '16px' }}
                                              value={editingNote.draft}
                                              onChange={(e) =>
                                                setEditingNote((prev) =>
                                                  prev && prev.classId === item.id
                                                    ? { ...prev, draft: e.target.value }
                                                    : prev,
                                                )
                                              }
                                              placeholder="Escribí una nota sobre el rendimiento del alumno en esta clase..."
                                            />
                                            <div className="flex items-center justify-between gap-2">
                                              <label className="text-[11px] text-gray-600">Visible para el alumno</label>
                                              <Switch
                                                checked={editingNote.visibleToStudent}
                                                onCheckedChange={(checked) =>
                                                  setEditingNote((prev) =>
                                                    prev && prev.classId === item.id
                                                      ? { ...prev, visibleToStudent: checked }
                                                      : prev,
                                                  )
                                                }
                                              />
                                            </div>
                                            {notesError && (
                                              <p className="text-[11px] text-red-600">{notesError}</p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1">
                                              <button
                                                type="button"
                                                onClick={handleSaveNote}
                                                disabled={savingNote}
                                                className="px-3 py-1 rounded-full bg-[#3cadaf] text-white text-[11px] font-semibold hover:bg-[#31435d] disabled:opacity-60"
                                              >
                                                {savingNote ? 'Guardando...' : 'Guardar nota'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleCancelEditNote}
                                                disabled={savingNote}
                                                className="px-3 py-1 rounded-full border border-slate-300 text-[11px] text-slate-700 bg-white hover:bg-slate-50"
                                              >
                                                Cancelar
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <p className="text-[12px] text-gray-700">
                                              {firstNote ? (
                                                <>
                                                  <span className="font-semibold">
                                                    {firstNote.coach_id ? 'Tu nota:' : 'Nota del admin:'}
                                                  </span>{' '}
                                                  <span className="font-semibold">{firstNote.note}</span>
                                                </>
                                              ) : (
                                                'Aún no dejaste una nota para esta clase.'
                                              )}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleStartEditNote(item.id, firstNote ? firstNote.note : '')
                                              }
                                              disabled={!coachCanEditThisNote}
                                              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              <StickyNote className="w-3.5 h-3.5 text-[#3cadaf]" />
                                              {firstNote ? 'Editar nota' : 'Agregar nota'}
                                            </button>
                                            {!coachCanEditThisNote && (
                                              <p className="text-[11px] text-gray-500">
                                                Esta nota fue creada por un admin. No podés editarla.
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : isAdmin ? (
                                      <div className="space-y-1">
                                        {editingNote && editingNote.classId === item.id ? (
                                          <div className="space-y-2">
                                            <label className="block text-xs text-gray-600">Nota para el alumno (en esta clase)</label>
                                            <textarea
                                              className="w-full border rounded-md px-2 py-1 text-base resize-y min-h-[60px]"
                                              style={{ fontSize: '16px' }}
                                              value={editingNote.draft}
                                              onChange={(e) =>
                                                setEditingNote((prev) =>
                                                  prev && prev.classId === item.id
                                                    ? { ...prev, draft: e.target.value }
                                                    : prev,
                                                )
                                              }
                                              placeholder="Escribí una nota para el alumno..."
                                            />
                                            <div className="flex items-center justify-between gap-2">
                                              <label className="text-[11px] text-gray-600">Visible para el profesor</label>
                                              <Switch
                                                checked={editingNote.visibleToCoach}
                                                onCheckedChange={(checked) =>
                                                  setEditingNote((prev) =>
                                                    prev && prev.classId === item.id
                                                      ? { ...prev, visibleToCoach: checked }
                                                      : prev,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                              <label className="text-[11px] text-gray-600">Visible para el alumno</label>
                                              <Switch
                                                checked={editingNote.visibleToStudent}
                                                onCheckedChange={(checked) =>
                                                  setEditingNote((prev) =>
                                                    prev && prev.classId === item.id
                                                      ? { ...prev, visibleToStudent: checked }
                                                      : prev,
                                                  )
                                                }
                                              />
                                            </div>
                                            {notesError && (
                                              <p className="text-[11px] text-red-600">{notesError}</p>
                                            )}
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={handleSaveNote}
                                                disabled={savingNote}
                                                className="px-3 py-1 rounded-full bg-[#3cadaf] text-white text-[11px] font-semibold hover:bg-[#31435d] disabled:opacity-60"
                                              >
                                                {savingNote ? 'Guardando...' : 'Guardar nota'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleCancelEditNote}
                                                disabled={savingNote}
                                                className="px-3 py-1 rounded-full border border-slate-300 text-[11px] text-slate-700 bg-white hover:bg-slate-50"
                                              >
                                                Cancelar
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <p className="text-[12px] text-gray-700">
                                              {firstNote ? (
                                                <>
                                                  <span className="font-semibold">Nota:</span>{' '}
                                                  <span className="font-semibold">{firstNote.note}</span>
                                                </>
                                              ) : (
                                                'Aún no hay nota para esta clase.'
                                              )}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleStartEditNote(item.id, firstNote ? firstNote.note : '')
                                              }
                                              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              <StickyNote className="w-3.5 h-3.5 text-[#3cadaf]" />
                                              {firstNote ? 'Editar nota' : 'Agregar nota'}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ) : role === 'student' && firstNote ? (
                                      <p className="text-[13px] text-gray-700">
                                        <span className="font-semibold">Nota del profesor:</span>{' '}
                                        <span className="font-semibold">{firstNote.note}</span>
                                      </p>
                                    ) : null}
                                  </td>
                                </tr>
                              ),
                            ];
                          });

                          return [headerRow, ...rows];
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            };

            return (
              <>
                {renderSection('Histórico confirmado', confirmed)}
                {renderSection('Reservas pendientes de confirmar', pending)}
              </>
            );
          })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
