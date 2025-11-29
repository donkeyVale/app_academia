"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import PlansClient from './PlansClient';
import { CreditCard } from 'lucide-react';
import { createClientBrowser } from '@/lib/supabase';

type Role = 'admin' | 'coach' | 'student' | null;

type StudentFinanceSummary = {
  planName: string | null;
  totalClasses: number | null;
  remainingClasses: number | null;
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

  const roleResolved = role === 'admin' || role === 'coach' || role === 'student';

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
        roleFromProfile = r === 'admin' || r === 'coach' || r === 'student' ? r : null;
      }

      setRole(roleFromProfile);
      setCheckingRole(false);

      if (roleFromProfile !== 'student') {
        return;
      }

      // Cargar resumen financiero para el alumno actual
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

        // Último plan del alumno con join al plan
        const { data: spData, error: spErr } = await supabase
          .from('student_plans')
          .select('id, remaining_classes, plans(name,classes_included)')
          .eq('student_id', studentId)
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

          setSummary({
            planName: (row.plans?.name as string | null) ?? null,
            totalClasses,
            remainingClasses: effectiveRemaining,
          });
        }

        // Pagos del alumno
        const { data: payData, error: payErr } = await supabase
          .from('payments')
          .select('id,amount,currency,payment_date,method,status')
          .eq('student_id', studentId)
          .order('payment_date', { ascending: false })
          .limit(10);

        if (payErr) throw payErr;

        setPayments(((payData ?? []) as unknown as StudentPayment[]));
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando tu resumen financiero.');
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

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

  // Vista original completa para admin / coach
  if (role === 'admin' || role === 'coach') {
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

  // Vista de alumno (student): resumen simple + botón pagar ahora sin funcionalidad aún
  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <CreditCard className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Finanzas</h1>
            <p className="text-sm text-gray-600">Resumen de tu plan y tus pagos.</p>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
          <p className="text-sm font-semibold text-[#31435d]">Resumen de tu plan</p>
          <button
            type="button"
            className="inline-flex items-center rounded-full bg-[#3cadaf] hover:bg-[#31435d] text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-60"
            // Sin funcionalidad por ahora; se implementará cuando se integren pagos online
            disabled={loading}
          >
            Pagar ahora
          </button>
        </div>
        <div className="px-4 py-4 text-sm space-y-2">
          {loading ? (
            <p className="text-gray-600">Cargando tu información...</p>
          ) : !summary ? (
            <p className="text-gray-600">Todavía no tenés un plan asignado.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <div>
                  <span className="text-xs text-gray-500">Plan actual</span>
                  <div className="font-medium text-[#31435d]">
                    {summary.planName ?? '-'}
                  </div>
                </div>
                <div className="flex gap-6 mt-2 text-xs">
                  <div>
                    <div className="text-gray-500">Clases totales</div>
                    <div className="font-semibold text-[#31435d]">
                      {summary.totalClasses != null ? summary.totalClasses : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Clases usadas</div>
                    <div className="font-semibold text-[#31435d]">
                      {summary.totalClasses != null && summary.remainingClasses != null
                        ? summary.totalClasses - summary.remainingClasses
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Clases restantes</div>
                    <div className="font-semibold text-[#31435d]">
                      {summary.remainingClasses != null ? summary.remainingClasses : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
          <p className="text-sm font-semibold text-[#31435d]">Tus pagos recientes</p>
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
    </section>
  );
}
