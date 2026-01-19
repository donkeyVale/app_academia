"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import PlansClient from './PlansClient';
import { CreditCard, History } from 'lucide-react';
import { createClientBrowser } from '@/lib/supabase';
import { formatPyg } from '@/lib/formatters';

type Role = 'super_admin' | 'admin' | 'coach' | 'student' | null;

type StudentFinanceSummary = {
  planName: string | null;
  totalClasses: number | null;
  remainingClasses: number | null;
  usedClasses: number | null;
  planTotal: number | null;
};

type StudentPayment = {
  id: string;
  amount: number;
  currency: string;
  payment_date: string;
  method: string;
  status: string;
};

export default function FinancePage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const [role, setRole] = useState<Role>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<StudentFinanceSummary | null>(null);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySelectedPlanId, setHistorySelectedPlanId] = useState<string>('');
  const [historyItems, setHistoryItems] = useState<
    {
      id: string;
      date: string;
      courtName: string | null;
      coachName: string | null;
      note: string | null;
      studentPlanId: string | null;
      planName: string | null;
      planPurchasedAt: string | null;
      usageStatus: 'pending' | 'confirmed';
      attendancePresent: boolean | null;
      attendanceMarkedAt: string | null;
    }[]
  >([]);

  const roleResolved = role === 'super_admin' || role === 'admin' || role === 'coach' || role === 'student';

  // Sincronizar selectedAcademyId con localStorage (cambia cuando el usuario cambia de academia)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readFromStorage = () => {
      const stored = window.localStorage.getItem('selectedAcademyId');
      const value = stored && stored.trim() ? stored : null;
      setSelectedAcademyId((prev) => (prev === value ? prev : value));
    };

    readFromStorage();
    const intervalId = window.setInterval(readFromStorage, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    (async () => {
      setCheckingRole(true);
      setError(null);

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setCheckingRole(false);
        return;
      }

      const userId = data.user.id as string;

      let roleFromProfile: Role = null;
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (!profErr) {
        const r = (profile?.role as Role) ?? null;
        roleFromProfile = r === 'super_admin' || r === 'admin' || r === 'coach' || r === 'student' ? r : null;
      }

      setRole(roleFromProfile);
      setCheckingRole(false);

      if (roleFromProfile !== 'student') {
        return;
      }

      // Si no hay academia seleccionada todavía, limpiamos datos de alumno
      if (!selectedAcademyId) {
        setSummary(null);
        setPayments([]);
        return;
      }

      // Cargar resumen financiero para el alumno actual, filtrado por academia seleccionada
      setLoading(true);
      try {
        // Buscar fila de students vinculada al usuario
        const { data: studentsData, error: studentsErr } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (studentsErr) throw studentsErr;

        if (!studentsData) {
          setSummary(null);
          setPayments([]);
          setLoading(false);
          return;
        }

        const studentId = studentsData.id as string;
        setStudentId(studentId);

        // Último plan del alumno para la academia seleccionada, con join al plan
        const { data: spData, error: spErr } = await supabase
          .from('student_plans')
          .select('id, remaining_classes, academy_id, base_price, final_price, plans(name,classes_included)')
          .eq('student_id', studentId)
          .eq('academy_id', selectedAcademyId)
          .order('purchased_at', { ascending: false })
          .limit(1);

        if (spErr) throw spErr;

        if (!spData || spData.length === 0) {
          setSummary(null);
        } else {
          const row = spData[0] as any;

          // Contar usos efectivos de ese plan para calcular clases usadas/restantes
          const { data: usagesData, error: usagesErr } = await supabase
            .from('plan_usages')
            .select('id')
            .eq('student_plan_id', row.id)
            .eq('student_id', studentId)
            .in('status', ['pending', 'confirmed']);

          if (usagesErr) throw usagesErr;

          const usedCount = (usagesData ?? []).length;
          const baseRemaining = (row.remaining_classes as number | null) ?? null;
          const effectiveRemaining = baseRemaining != null ? Math.max(0, baseRemaining - usedCount) : null;
          const totalClasses = (row.plans?.classes_included as number | null) ?? baseRemaining;

          const basePrice = (row.base_price as number | null) ?? null;
          const finalPrice = (row.final_price as number | null) ?? null;
          const planTotal = finalPrice ?? basePrice ?? null;

          setSummary({
            planName: (row.plans?.name as string | null) ?? null,
            totalClasses,
            remainingClasses: effectiveRemaining,
            usedClasses: usedCount,
            planTotal,
          });
        }

        // Pagos del alumno para la academia seleccionada
        // Primero obtener todos los student_plans de esta academia para el alumno
        const { data: spForPayments, error: spPayErr } = await supabase
          .from('student_plans')
          .select('id,academy_id')
          .eq('student_id', studentId)
          .eq('academy_id', selectedAcademyId);

        if (spPayErr) throw spPayErr;

        const planIds = ((spForPayments ?? []) as { id: string; academy_id: string | null }[]).map(
          (p) => p.id,
        );

        if (planIds.length === 0) {
          setPayments([]);
        } else {
          const { data: payData, error: payErr } = await supabase
            .from('payments')
            .select('id,amount,currency,payment_date,method,status,student_plan_id')
            .eq('student_id', studentId)
            .in('student_plan_id', planIds)
            .order('payment_date', { ascending: false })
            .limit(10);

          if (payErr) throw payErr;

          const mappedPayments: StudentPayment[] = ((payData ?? []) as any[]).map((p) => ({
            id: p.id as string,
            amount: p.amount as number,
            currency: p.currency as string,
            payment_date: p.payment_date as string,
            method: p.method as string,
            status: p.status as string,
          }));

          setPayments(mappedPayments);
        }
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando tu resumen financiero.');
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, selectedAcademyId]);

  if (!roleResolved || checkingRole) {
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
            <div className="text-xs text-white/80 mt-1">Cargando finanzas...</div>
          </div>
        </div>
      </section>
    );
  }

  // Vista completa de finanzas para admin y super_admin
  if (role === 'admin' || role === 'super_admin') {
    return (
      <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <CreditCard className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
            <div className="space-y-0.5">
              <h1 className="text-2xl font-semibold text-[#31435d]">Finanzas</h1>
              <p className="text-sm text-gray-600">Gestión de planes, saldos y pagos.</p>
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
        <PlansClient />
      </section>
    );
  }

  // Vista de "Mi cuenta" para alumno (rol student)
  if (role === 'student') {
    const planTotal = summary?.planTotal ?? null;
    const totalPaid = payments.reduce(
      (acc, p) => (p.status === 'pagado' ? acc + (p.amount ?? 0) : acc),
      0,
    );

    return (
      <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <CreditCard className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
            <div className="space-y-0.5">
              <h1 className="text-2xl font-semibold text-[#31435d]">Mi cuenta</h1>
              <p className="text-sm text-gray-600">
                Resumen de tu plan y tus pagos recientes en la academia seleccionada.
              </p>
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

        {/* Card de pagos recientes, replicando estilo de StudentsPage */}
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
            ) : payments.length === 0 ? (
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
                    {payments.map((p) => {
                      const d = new Date(p.payment_date);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const dd = String(d.getDate()).padStart(2, '0');
                      return (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="py-1.5 px-2">{`${dd}/${mm}/${yyyy}`}</td>
                          <td className="py-1.5 px-2 capitalize">{p.method}</td>
                          <td className="py-1.5 px-2 text-right">
                            {formatPyg(p.amount)} {p.currency}
                          </td>
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

        {/* Card de resumen de cuenta, replicando estilo de StudentsPage para student */}
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
            <p className="text-sm font-semibold text-[#31435d]">Resumen de tu cuenta</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-[#3cadaf] hover:bg-[#31435d] text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-60"
                disabled={loading}
              >
                Pagar ahora
              </button>
            </div>
          </div>
          <div className="px-4 py-3 space-y-3 text-sm">
            {loading ? (
              <p className="text-gray-600">Cargando resumen...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : !summary ? (
              <p className="text-gray-600">
                No encontramos un plan activo para la academia seleccionada.
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <span className="font-semibold text-[#31435d]">Clases totales:</span>{' '}
                    {summary.totalClasses != null ? summary.totalClasses : '-'}
                  </div>
                  <div>
                    <span className="font-semibold text-[#31435d]">Usadas:</span>{' '}
                    {summary.usedClasses != null ? summary.usedClasses : '-'}
                  </div>
                  <div>
                    <span className="font-semibold text-[#31435d]">Restantes:</span>{' '}
                    {summary.remainingClasses != null ? summary.remainingClasses : '-'}
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!studentId) return;
                      try {
                        setHistoryOpen(true);
                        setHistoryLoading(true);
                        setHistoryError(null);
                        setHistoryItems([]);
                        setHistorySelectedPlanId('');

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
                          setHistoryLoading(false);
                          return;
                        }

                        const courtIds = Array.from(
                          new Set(
                            classSessions
                              .map((c) => c.classSession.court_id)
                              .filter((id): id is string => !!id),
                          ),
                        );
                        const coachIds = Array.from(
                          new Set(
                            classSessions
                              .map((c) => c.classSession.coach_id)
                              .filter((id): id is string => !!id),
                          ),
                        );

                        const planIds = Array.from(
                          new Set(
                            classSessions
                              .map((c) => c.studentPlanId)
                              .filter((id): id is string => !!id),
                          ),
                        );

                        let planInfoById: Record<string, { name: string | null; purchased_at: string | null }> = {};
                        if (planIds.length) {
                          const { data: spRows, error: spErr } = await supabase
                            .from('student_plans')
                            .select('id, purchased_at, plans(name)')
                            .in('id', planIds);
                          if (spErr) throw spErr;

                          planInfoById = (spRows ?? []).reduce<
                            Record<string, { name: string | null; purchased_at: string | null }>
                          >((acc, row: any) => {
                            const pid = row.id as string;
                            const planName = ((row as any)?.plans?.name as string | undefined) ?? null;
                            acc[pid] = {
                              name: planName,
                              purchased_at: (row.purchased_at as string | null) ?? null,
                            };
                            return acc;
                          }, {});
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
                          courtsMap = (courtsData ?? []).reduce<
                            Record<string, { id: string; name: string }>
                          >((acc, c: any) => {
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
                          coachesMap = (coachesData ?? []).reduce<
                            Record<string, { id: string; user_id: string | null }>
                          >((acc, c: any) => {
                            acc[c.id] = { id: c.id, user_id: c.user_id };
                            return acc;
                          }, {});

                          const coachUserIds = Array.from(
                            new Set(
                              (coachesData ?? [])
                                .map((c: any) => c.user_id)
                                .filter((id: string | null): id is string => !!id),
                            ),
                          );

                          if (coachUserIds.length) {
                            const { data: profilesData, error: profErr } = await supabase
                              .from('profiles')
                              .select('id, full_name')
                              .in('id', coachUserIds);
                            if (profErr) throw profErr;
                            coachNamesMap = (profilesData ?? []).reduce<
                              Record<string, string | null>
                            >((acc, p: any) => {
                              acc[p.id] = p.full_name;
                              return acc;
                            }, {});
                          }
                        }

                        const baseItems = classSessions.map((cls) => {
                          const courtId = cls.classSession.court_id;
                          const coachId = cls.classSession.coach_id;
                          const court = courtId ? courtsMap[courtId] : undefined;
                          const coach = coachId ? coachesMap[coachId] : undefined;
                          const coachName = coach?.user_id
                            ? coachNamesMap[coach.user_id] ?? null
                            : null;
                          const planInfo = cls.studentPlanId ? planInfoById[cls.studentPlanId] : undefined;
                          return {
                            id: cls.classSession.id,
                            date: cls.classSession.date,
                            courtName: court?.name ?? null,
                            coachName,
                            note: null as string | null,
                            studentPlanId: cls.studentPlanId,
                            planName: planInfo?.name ?? null,
                            planPurchasedAt: planInfo?.purchased_at ?? null,
                            usageStatus: cls.usageStatus,
                            attendancePresent: null as boolean | null,
                            attendanceMarkedAt: null as string | null,
                          };
                        });

                        // Cargar asistencia para estas clases (Presente/Ausente/Sin marcar + marcado_at)
                        const classIdsForAttendance = baseItems.map((i) => i.id);
                        const attendanceMap = new Map<string, { present: boolean | null; marked_at: string | null }>();
                        if (classIdsForAttendance.length) {
                          const { data: attRows, error: attErr } = await supabase
                            .from('attendance')
                            .select('class_id,present,marked_at')
                            .eq('student_id', studentId)
                            .in('class_id', classIdsForAttendance);
                          if (attErr) throw attErr;
                          (attRows ?? []).forEach((r: any) => {
                            const cid = r.class_id as string | null;
                            if (!cid) return;
                            attendanceMap.set(cid, {
                              present: (r.present as boolean | null) ?? null,
                              marked_at: (r.marked_at as string | null) ?? null,
                            });
                          });
                        }

                        const itemsWithAttendance = baseItems.map((it) => {
                          const att = attendanceMap.get(it.id);
                          return {
                            ...it,
                            attendancePresent: att ? (att.present ?? null) : null,
                            attendanceMarkedAt: att ? (att.marked_at ?? null) : null,
                          };
                        });

                        // Cargar notas de clase para este alumno y estas clases (solo lectura)
                        const classIds = baseItems.map((i) => i.id);
                        let notesByClass: Record<string, string | null> = {};
                        if (classIds.length) {
                          const { data: notesData, error: notesErr } = await supabase
                            .from('class_notes')
                            .select('class_id,note,visible_to_student')
                            .eq('student_id', studentId)
                            .eq('visible_to_student', true)
                            .in('class_id', classIds);

                          if (!notesErr) {
                            notesByClass = (notesData ?? []).reduce<Record<string, string | null>>(
                              (acc, n: any) => {
                                const cid = n.class_id as string;
                                // Nos quedamos con la primera nota si hay varias
                                if (!acc[cid]) acc[cid] = (n.note as string) ?? null;
                                return acc;
                              },
                              {},
                            );
                          }
                        }

                        const items = itemsWithAttendance.map((it) => ({
                          ...it,
                          note: notesByClass[it.id] ?? null,
                        }));

                        items.sort((a, b) => b.date.localeCompare(a.date));
                        setHistoryItems(items);

                        const planOptionsMap = new Map<string, { id: string; label: string; purchasedAtMs: number }>();
                        for (const it of items) {
                          const key = it.studentPlanId ?? 'unknown';
                          if (planOptionsMap.has(key)) continue;
                          const ms = it.planPurchasedAt ? new Date(it.planPurchasedAt).getTime() : 0;
                          const d = it.planPurchasedAt ? new Date(it.planPurchasedAt) : null;
                          const dd = d ? String(d.getDate()).padStart(2, '0') : '--';
                          const mm = d ? String(d.getMonth() + 1).padStart(2, '0') : '--';
                          const yyyy = d ? String(d.getFullYear()) : '----';
                          const when = `${dd}/${mm}/${yyyy}`;
                          const planName = it.planName ?? (key === 'unknown' ? 'Plan sin identificar' : 'Plan');
                          planOptionsMap.set(key, { id: key, label: `${planName} — asignado el ${when}`, purchasedAtMs: ms });
                        }
                        const optionsSorted = Array.from(planOptionsMap.values()).sort((a, b) => b.purchasedAtMs - a.purchasedAtMs);
                        if (optionsSorted.length > 0) {
                          setHistorySelectedPlanId(optionsSorted[0].id);
                        }
                      } catch (err: any) {
                        setHistoryError(err?.message ?? 'Error cargando historial de clases.');
                      } finally {
                        setHistoryLoading(false);
                      }
                    }}
                    className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Ver historial de clases
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
            <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl border border-slate-200">
              <div className="flex items-center justify-between border-b px-4 pt-4 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-[#3cadaf]" />
                    <h2 className="text-base font-semibold text-[#31435d]">Historial de clases</h2>
                  </div>
                  <p className="text-xs text-gray-500">Mi historial de clases</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                  onClick={() => {
                    setHistoryOpen(false);
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
                  <p className="text-sm text-gray-600">Todavía no tenés clases registradas.</p>
                )}
                {!historyLoading && !historyError && historyItems.length > 0 && (
                  <div className="space-y-4">
                    {(() => {
                      const planOptionsMap = new Map<string, { id: string; label: string; purchasedAtMs: number }>();
                      for (const it of historyItems) {
                        const key = it.studentPlanId ?? 'unknown';
                        if (planOptionsMap.has(key)) continue;
                        const ms = it.planPurchasedAt ? new Date(it.planPurchasedAt).getTime() : 0;
                        const d = it.planPurchasedAt ? new Date(it.planPurchasedAt) : null;
                        const dd = d ? String(d.getDate()).padStart(2, '0') : '--';
                        const mm = d ? String(d.getMonth() + 1).padStart(2, '0') : '--';
                        const yyyy = d ? String(d.getFullYear()) : '----';
                        const when = `${dd}/${mm}/${yyyy}`;
                        const planName = it.planName ?? (key === 'unknown' ? 'Plan sin identificar' : 'Plan');
                        planOptionsMap.set(key, { id: key, label: `${planName} — asignado el ${when}`, purchasedAtMs: ms });
                      }
                      const planOptions = Array.from(planOptionsMap.values()).sort((a, b) => b.purchasedAtMs - a.purchasedAtMs);

                      const confirmed = historyItems.filter((x) => x.usageStatus === 'confirmed');
                      const pending = historyItems.filter((x) => x.usageStatus === 'pending');

                      const renderSection = (title: string, itemsInSection: typeof historyItems) => {
                        if (!itemsInSection.length) return null;

                        const key = historySelectedPlanId || (itemsInSection[0]?.studentPlanId ?? 'unknown');
                        const items = itemsInSection.filter((it) => (it.studentPlanId ?? 'unknown') === key);
                        if (!items.length) return null;

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
                                  {items.map((item) => {
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
                                        markedText = `${mD}/${mM}/${mY} ${mH}:${mMin}`;
                                      }

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
                                              {item.note ? (
                                                <p className="text-[12px] text-gray-700">
                                                  <span className="font-semibold">Nota:</span>{' '}
                                                  <span className="font-semibold">{item.note}</span>
                                                </p>
                                              ) : (
                                                <p className="text-[12px] text-gray-500">
                                                  Esta clase no tiene notas cargadas.
                                                </p>
                                              )}
                                            </td>
                                          </tr>
                                        ),
                                      ];
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {planOptions.length > 1 && (
                            <div className="flex items-center justify-between gap-3">
                              <label className="text-xs text-slate-600">Plan</label>
                              <select
                                className="h-9 w-full max-w-[360px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                                value={historySelectedPlanId}
                                onChange={(e) => setHistorySelectedPlanId(e.target.value)}
                              >
                                {planOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
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

  // Cualquier otro rol (por ejemplo coach) no debería acceder a Finanzas
  return (
    <section className="mt-4 max-w-5xl mx-auto px-4">
      <div className="border rounded-lg bg-white shadow-sm p-4">
        <p className="text-sm text-gray-700">No tenés acceso a esta sección.</p>
      </div>
    </section>
  );
}
