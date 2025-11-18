"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export default function StudentsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [plansByStudent, setPlansByStudent] = useState<Record<string, StudentPlanRow | undefined>>({});
  const [planNamesById, setPlanNamesById] = useState<Record<string, string>>({});
  const [profilesByUser, setProfilesByUser] = useState<Record<string, ProfileRow | undefined>>({});

  useEffect(() => {
    const supabase = createClientBrowser();

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/login');
        return;
      }

      setChecking(false);
      setLoading(true);
      setError(null);

      try {
        const [studentsRes, studentPlansRes] = await Promise.all([
          supabase.from('students').select('id, user_id, level, notes'),
          supabase.from('student_plans').select('id, student_id, plan_id, remaining_classes'),
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (studentPlansRes.error) throw studentPlansRes.error;

        const studentsData = (studentsRes.data ?? []) as StudentRow[];
        const plansData = (studentPlansRes.data ?? []) as StudentPlanRow[];

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
        const planIds = new Set<string>();
        for (const p of plansData) {
          const used = usageCountsByPlan[p.id] || 0;
          const effectiveRemaining = Math.max(0, (p.remaining_classes ?? 0) - used);
          const withEffective: StudentPlanRow = {
            ...p,
            remaining_classes: effectiveRemaining,
          };

          // Si hay varios registros de plan para el mismo alumno, nos quedamos con el primero.
          if (!plansMap[p.student_id]) {
            plansMap[p.student_id] = withEffective;
          }
          if (p.plan_id) {
            planIds.add(p.plan_id);
          }
        }

        let planNamesMap: Record<string, string> = {};
        if (planIds.size > 0) {
          const plansRes = await supabase
            .from('plans')
            .select('id, name')
            .in('id', Array.from(planIds));

          if (plansRes.error) throw plansRes.error;

          const plansRows = plansRes.data as { id: string; name: string }[];
          planNamesMap = plansRows.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.name;
            return acc;
          }, {});
        }

        setStudents(studentsData);
        setPlansByStudent(plansMap);
        setPlanNamesById(planNamesMap);
        setProfilesByUser(profilesMap);
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando alumnos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (checking) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <IconStudents />
          <h1 className="text-2xl font-semibold text-[#31435d]">Alumnos</h1>
        </div>
        <p className="text-sm text-gray-600">Cargando...</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2">
        <IconStudents />
        <h1 className="text-2xl font-semibold text-[#31435d]">Alumnos</h1>
      </div>
      <p className="text-sm text-gray-600">
        Listado de alumnos con su plan activo y clases restantes (si corresponde).
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-lg bg-white p-4 shadow-sm border-t-4 border-[#3cadaf]">
        {loading ? (
          <p className="text-sm text-gray-600">Cargando alumnos...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-600">Todavía no hay alumnos registrados.</p>
        ) : (
          <div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Alumno</th>
                  <th className="text-left py-2 px-3">Plan</th>
                  <th className="text-left py-2 px-3">Clases restantes</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const planInfo = plansByStudent[s.id];
                  const planId = planInfo?.plan_id ?? null;
                  const planName = planId ? planNamesById[planId] ?? '-' : '-';
                  const remaining = planInfo?.remaining_classes ?? null;

                  const profile = s.user_id ? profilesByUser[s.user_id] : undefined;
                  const displayName = profile?.full_name || '(Sin nombre vinculado)';

                  return (
                    <tr key={s.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-2 px-3">{displayName}</td>
                      <td className="py-2 px-3">{planName}</td>
                      <td className="py-2 px-3">{remaining !== null ? remaining : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
