"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createClientBrowser } from '@/lib/supabase';

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
  remaining_classes: number;
  base_price?: number | null;
  final_price?: number | null;
  total_classes?: number | null;
  used_classes?: number | null;
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
  const supabase = createClientBrowser();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'coach' | 'student' | null>(null);
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
    { id: string; date: string; courtName: string | null; coachName: string | null }[]
  >([]);
  const [showOnlyMyStudents, setShowOnlyMyStudents] = useState(false);
  const [myStudentIds, setMyStudentIds] = useState<string[]>([]);
  const [nextClassByStudent, setNextClassByStudent] = useState<Record<string, string | null>>({});
  const [classNotesByClass, setClassNotesByClass] = useState<
    Record<string, { id: string; note: string }[]>
  >({});
  const [editingNote, setEditingNote] = useState<{ classId: string; draft: string } | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [coachIdForNotes, setCoachIdForNotes] = useState<string | null>(null);

  const roleResolved = role === 'admin' || role === 'coach' || role === 'student';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/login');
        return;
      }

      const userId = data.user.id as string;

      let roleFromProfile: 'admin' | 'coach' | 'student' | null = null;
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (!profErr) {
        const r = (profile?.role as 'admin' | 'coach' | 'student' | null) ?? null;
        roleFromProfile = r === 'admin' || r === 'coach' || r === 'student' ? r : null;
        setRole(roleFromProfile);
      }

      setChecking(false);
      setLoading(true);
      setError(null);

      try {
        const [studentsRes, studentPlansRes] = await Promise.all([
          supabase.from('students').select('id, user_id, level, notes'),
          supabase
            .from('student_plans')
            .select('id, student_id, plan_id, remaining_classes, base_price, final_price, plans(name)'),
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (studentPlansRes.error) throw studentPlansRes.error;

        const studentsData = (studentsRes.data ?? []) as StudentRow[];
        const rawPlansData = (studentPlansRes.data ?? []) as any[];
        const plansData: StudentPlanRow[] = rawPlansData.map((p) => ({
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
        }));

        // Cargar perfiles para obtener el full_name de cada alumno (cuando tenga user vinculado)
        const userIds = Array.from(
          new Set(
            studentsData
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
            .in('student_plan_id', studentPlanIds);

          if (usagesErr) throw usagesErr;

          usageCountsByPlan = (usagesData ?? []).reduce<Record<string, number>>((acc, u: any) => {
            const pid = u.student_plan_id as string;
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
          }, {});
        }

        // Construir mapas de planes
        const plansMap: Record<string, StudentPlanRow> = {};
        for (const p of plansData) {
          const used = usageCountsByPlan[p.id] || 0;
          const baseTotal = (p.total_classes ?? p.remaining_classes) ?? 0;
          const effectiveRemaining = Math.max(0, baseTotal - used);
          const withEffective: StudentPlanRow = {
            ...p,
            remaining_classes: effectiveRemaining,
            total_classes: baseTotal,
            used_classes: used,
          };

          // Si hay varios registros de plan para el mismo alumno, priorizamos uno que tenga plan_id no nulo.
          const existing = plansMap[p.student_id];
          if (!existing) {
            plansMap[p.student_id] = withEffective;
          } else if (!existing.plan_id && p.plan_id) {
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

        setStudents(studentsData);

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
            const futureFrom = new Date();
            const futureTo = new Date(futureFrom.getTime() + 14 * 24 * 60 * 60 * 1000);
            const { data: futureClasses, error: futureErr } = await supabase
              .from('class_sessions')
              .select('id,date')
              .eq('coach_id', coachId)
              .gte('date', futureFrom.toISOString())
              .lte('date', futureTo.toISOString());
            if (futureErr) throw futureErr;

            const classes = futureClasses ?? [];
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
          }
        }

        setMyStudentIds(myIds);
        setNextClassByStudent(nextByStudent);
        if (roleFromProfile === 'coach') {
          setShowOnlyMyStudents(true);
        }
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
      // Buscar clases efectivamente usadas (presentes) a través de plan_usages
      const { data: usagesData, error: usagesErr } = await supabase
        .from('plan_usages')
        .select('class_id, class_sessions!inner(id,date,court_id,coach_id)')
        .eq('student_id', studentId)
        .limit(50);

      if (usagesErr) throw usagesErr;

      const classSessionsRaw = (usagesData ?? [])
        .map((u: any) => u.class_sessions as any)
        .filter((c) => !!c);

      // Quitar duplicados por id
      const byId: Record<string, any> = {};
      classSessionsRaw.forEach((c: any) => {
        if (!byId[c.id]) byId[c.id] = c;
      });
      const classSessions = Object.values(byId) as {
        id: string;
        date: string;
        court_id: string | null;
        coach_id: string | null;
      }[];

      if (!classSessions.length) {
        setHistoryItems([]);
        return;
      }

      const courtIds = Array.from(
        new Set(
          classSessions
            .map((c) => c.court_id)
            .filter((id): id is string => !!id)
        )
      );
      const coachIds = Array.from(
        new Set(
          classSessions
            .map((c) => c.coach_id)
            .filter((id): id is string => !!id)
        )
      );

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
        const court = cls.court_id ? courtsMap[cls.court_id] : undefined;
        const coach = cls.coach_id ? coachesMap[cls.coach_id] : undefined;
        const coachName = coach?.user_id ? coachNamesMap[coach.user_id] ?? null : null;
        return {
          id: cls.id,
          date: cls.date,
          courtName: court?.name ?? null,
          coachName: coachName,
        };
      });

      // Ordenar por fecha descendente por si acaso
      items.sort((a, b) => b.date.localeCompare(a.date));
      setHistoryItems(items);

      // Cargar notas de clase para este alumno y estas clases
      const classIds = items.map((i) => i.id);
      if (classIds.length) {
        const { data: notesData, error: notesErr } = await supabase
          .from('class_notes')
          .select('id,class_id,student_id,coach_id,note')
          .eq('student_id', studentId)
          .in('class_id', classIds);

        if (notesErr) {
          console.error('Error cargando notas de clases', notesErr.message);
        } else {
          const map: Record<string, { id: string; note: string }[]> = {};
          (notesData ?? []).forEach((n: any) => {
            const cid = n.class_id as string;
            if (!map[cid]) map[cid] = [];
            map[cid].push({ id: n.id as string, note: n.note as string });
          });
          setClassNotesByClass(map);
        }
      }
    } catch (err: any) {
      setHistoryError(err?.message ?? 'Error cargando historial de clases.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStartEditNote = (classId: string, currentNote: string) => {
    setEditingNote({ classId, draft: currentNote });
    setNotesError(null);
  };

  const handleCancelEditNote = () => {
    setEditingNote(null);
    setNotesError(null);
  };

  const handleSaveNote = async () => {
    if (!editingNote || !historyStudent) return;
    if (!coachIdForNotes) {
      setNotesError('No se pudo identificar tu usuario como profesor para guardar la nota.');
      return;
    }

    const { classId, draft } = editingNote;
    const existing = (classNotesByClass[classId] ?? [])[0] ?? null;

    try {
      setSavingNote(true);
      setNotesError(null);

      if (existing) {
        const { error } = await supabase
          .from('class_notes')
          .update({ note: draft })
          .eq('id', existing.id);
        if (error) throw error;
        setClassNotesByClass((prev) => ({
          ...prev,
          [classId]: [{ id: existing.id, note: draft }],
        }));
      } else {
        const { data, error } = await supabase
          .from('class_notes')
          .insert({
            class_id: classId,
            student_id: historyStudent.id,
            coach_id: coachIdForNotes,
            note: draft,
          })
          .select('id,note')
          .single();
        if (error) throw error;
        const newId = (data as any).id as string;
        const newNote = (data as any).note as string;
        setClassNotesByClass((prev) => ({
          ...prev,
          [classId]: [{ id: newId, note: newNote }],
        }));
      }

      setEditingNote(null);
    } catch (err: any) {
      setNotesError(err?.message ?? 'No se pudo guardar la nota.');
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
                  {totalPaid} / {planTotal} PYG
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
                          <td className="py-1.5 px-2 text-right">{p.amount} {p.currency}</td>
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
            {role === 'admin' && (
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
          {/* Vista para admin: tabla completa */}
          {role === 'admin' && (
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
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-gray-600">
                        <th className="py-1.5 px-2 text-left font-medium">Fecha</th>
                        <th className="py-1.5 px-2 text-left font-medium">Hora</th>
                        <th className="py-1.5 px-2 text-left font-medium">Cancha</th>
                        <th className="py-1.5 px-2 text-left font-medium">Profesor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((item) => {
                        const d = new Date(item.date);
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const hh = String(d.getHours()).padStart(2, '0');
                        const min = String(d.getMinutes()).padStart(2, '0');

                        const notesArr = classNotesByClass[item.id] ?? [];
                        const firstNote = notesArr[0] ?? null;
                        const isCoach = role === 'coach';
                        const isAdmin = role === 'admin';
                        const isStudent = role === 'student';

                        return (
                          <>
                            <tr key={`${item.id}-row`} className="border-b last:border-b-0">
                              <td className="py-1.5 px-2">{`${dd}/${mm}/${yyyy}`}</td>
                              <td className="py-1.5 px-2">{`${hh}:${min}`}</td>
                              <td className="py-1.5 px-2">{item.courtName ?? '-'}</td>
                              <td className="py-1.5 px-2">{item.coachName ?? '-'}</td>
                            </tr>
                            <tr key={`${item.id}-note`} className="border-b last:border-b-0">
                              <td colSpan={4} className="py-1.5 px-2 bg-gray-50/40">
                                {isCoach ? (
                                  <div className="space-y-1">
                                    {editingNote && editingNote.classId === item.id ? (
                                      <div className="space-y-1">
                                        <label className="block text-xs text-gray-600">Nota para esta clase</label>
                                        <textarea
                                          className="w-full border rounded-md px-2 py-1 text-xs resize-y min-h-[60px]"
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
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] text-gray-600">
                                          {firstNote
                                            ? `Tu nota: ${firstNote.note}`
                                            : 'Aún no dejaste una nota para esta clase.'}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleStartEditNote(item.id, firstNote ? firstNote.note : '')
                                          }
                                          className="text-[11px] text-[#3cadaf] hover:underline"
                                        >
                                          {firstNote ? 'Editar nota' : 'Agregar nota'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : (isStudent || isAdmin) && firstNote ? (
                                  <p className="text-[11px] text-gray-600">
                                    Nota del profesor: {firstNote.note}
                                  </p>
                                ) : null}
                              </td>
                            </tr>
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
