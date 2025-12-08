"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
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
  const supabase = createClientBrowser();
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
  const [historyItems, setHistoryItems] = useState<
    { id: string; date: string; courtName: string | null; coachName: string | null; note: string | null }[]
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
            .eq('student_id', studentId);

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

                        const { data: usagesData, error: usagesErr } = await supabase
                          .from('plan_usages')
                          .select('class_id, class_sessions!inner(id,date,court_id,coach_id)')
                          .eq('student_id', studentId)
                          .limit(50);

                        if (usagesErr) throw usagesErr;

                        const classSessionsRaw = (usagesData ?? [])
                          .map((u: any) => u.class_sessions as any)
                          .filter((c) => !!c);

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
                          setHistoryLoading(false);
                          return;
                        }

                        const courtIds = Array.from(
                          new Set(
                            classSessions
                              .map((c) => c.court_id)
                              .filter((id): id is string => !!id),
                          ),
                        );
                        const coachIds = Array.from(
                          new Set(
                            classSessions
                              .map((c) => c.coach_id)
                              .filter((id): id is string => !!id),
                          ),
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
                          const court = cls.court_id ? courtsMap[cls.court_id] : undefined;
                          const coach = cls.coach_id ? coachesMap[cls.coach_id] : undefined;
                          const coachName = coach?.user_id
                            ? coachNamesMap[coach.user_id] ?? null
                            : null;
                          return {
                            id: cls.id,
                            date: cls.date,
                            courtName: court?.name ?? null,
                            coachName,
                            note: null as string | null,
                          };
                        });

                        // Cargar notas de clase para este alumno y estas clases (solo lectura)
                        const classIds = baseItems.map((i) => i.id);
                        let notesByClass: Record<string, string | null> = {};
                        if (classIds.length) {
                          const { data: notesData, error: notesErr } = await supabase
                            .from('class_notes')
                            .select('class_id,note')
                            .eq('student_id', studentId)
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

                        const items = baseItems.map((it) => ({
                          ...it,
                          note: notesByClass[it.id] ?? null,
                        }));

                        items.sort((a, b) => b.date.localeCompare(a.date));
                        setHistoryItems(items);
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

                          return [
                            (
                              <tr key={`${item.id}-row`} className="border-b last:border-b-0">
                                <td className="py-1.5 px-2">{`${dd}/${mm}/${yyyy}`}</td>
                                <td className="py-1.5 px-2">{`${hh}:${min}`}</td>
                                <td className="py-1.5 px-2">{item.courtName ?? '-'}</td>
                                <td className="py-1.5 px-2">{item.coachName ?? '-'}</td>
                              </tr>
                            ),
                            (
                              <tr key={`${item.id}-note`} className="border-b last:border-b-0">
                                <td colSpan={4} className="py-1.5 px-2 bg-gray-50/40">
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
