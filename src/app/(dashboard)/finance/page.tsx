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

  // Vista completa de finanzas SOLO para admin
  if (role === 'admin') {
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

  // Cualquier rol que no sea admin (coach, student) no debería acceder a Finanzas
  return (
    <section className="mt-4 max-w-5xl mx-auto px-4">
      <div className="border rounded-lg bg-white shadow-sm p-4">
        <p className="text-sm text-gray-700">
          No tenés acceso a esta sección.
        </p>
      </div>
    </section>
  );
}
