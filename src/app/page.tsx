"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';

const iconColor = "#3cadaf";

const IconCalendar = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-4 h-4"
    {...props}
  >
    <rect x="3" y="4" width="18" height="17" rx="2" ry="2" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M3 9h18" stroke={iconColor} strokeWidth="1.6" />
    <path d="M9 3v4" stroke={iconColor} strokeWidth="1.6" />
    <path d="M15 3v4" stroke={iconColor} strokeWidth="1.6" />
  </svg>
);

const IconStudents = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-4 h-4"
    {...props}
  >
    <circle cx="9" cy="8" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <circle cx="17" cy="9" r="2.5" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M4 18c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke={iconColor} strokeWidth="1.6" fill="none" />
    <path d="M14 18c.3-1.6 1.7-3 3.5-3S21 16.4 21 18" stroke={iconColor} strokeWidth="1.6" fill="none" />
  </svg>
);

const IconMoney = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-4 h-4"
    {...props}
  >
    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M6 9h2" stroke={iconColor} strokeWidth="1.6" />
    <path d="M16 15h2" stroke={iconColor} strokeWidth="1.6" />
  </svg>
);

const IconReport = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-4 h-4"
    {...props}
  >
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M8 15v-4" stroke={iconColor} strokeWidth="1.6" />
    <path d="M12 15v-6" stroke={iconColor} strokeWidth="1.6" />
    <path d="M16 15v-3" stroke={iconColor} strokeWidth="1.6" />
  </svg>
);

const IconUsers = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-4 h-4"
    {...props}
  >
    <circle cx="8" cy="9" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <circle cx="16" cy="9" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M3 19c0-2.2 2.2-4 5-4" stroke={iconColor} strokeWidth="1.6" fill="none" />
    <path d="M21 19c0-2.2-2.2-4-5-4" stroke={iconColor} strokeWidth="1.6" fill="none" />
  </svg>
);

export default function HomePage() {
  const supabase = createClientBrowser();
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [activePlansCount, setActivePlansCount] = useState(0);
  const [studentsWithPlanCount, setStudentsWithPlanCount] = useState(0);
  const [todayClassesCount, setTodayClassesCount] = useState(0);
  const [coachesCount, setCoachesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      // nombre del usuario desde profiles (fallback al email)
      let displayName: string | null = data.user?.email ?? null;
      const userId = data.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.full_name) {
          displayName = profile.full_name as string;
        }
        if (profile?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
      setUserName(displayName);

      // métricas de dashboard
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);

        const [spRes, clsRes, coachRes, studRes] = await Promise.all([
          supabase
            .from('student_plans')
            .select('student_id,plan_id,remaining_classes')
            .gt('remaining_classes', 0),
          supabase
            .from('class_sessions')
            .select('id', { count: 'exact', head: true })
            .gte('date', start.toISOString())
            .lte('date', end.toISOString()),
          supabase
            .from('coaches')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true }),
        ]);

        if (spRes.error) throw spRes.error;
        if (clsRes.error) throw clsRes.error;
        if (coachRes.error) throw coachRes.error;
        if (studRes.error) throw studRes.error;

        const spRows = spRes.data ?? [];
        const planIds = new Set<string>();
        const studentIds = new Set<string>();
        (spRows as any[]).forEach((sp) => {
          planIds.add(sp.plan_id as string);
          studentIds.add(sp.student_id as string);
        });

        setActivePlansCount(planIds.size);
        setStudentsWithPlanCount(studentIds.size);
        setTodayClassesCount(clsRes.count ?? 0);
        setCoachesCount(coachRes.count ?? 0);
        setStudentsCount(studRes.count ?? 0);
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Error cargando métricas');
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  return (
    <section className="space-y-6 max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#31435d]">
            Bienvenido {userName ?? '...'}
          </h1>
          <p className="text-sm text-gray-600">
            Gestioná tu agenda, alumnos, planes y finanzas desde un solo lugar.
          </p>
        </div>
        <button
          type="button"
          className="border border-gray-300 bg-white rounded-full px-3 py-2 text-xs flex flex-col justify-center items-center gap-0.5 shadow-sm hover:shadow-md transition-shadow"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menú principal"
        >
          <span className="block w-5 h-0.5 bg-[#31435d] rounded" />
          <span className="block w-5 h-0.5 bg-[#31435d] rounded" />
          <span className="block w-5 h-0.5 bg-[#31435d] rounded" />
        </button>
      </div>

      {menuOpen && (
        <nav className="border rounded-lg p-3 bg-white flex flex-col gap-2 text-sm shadow-md">
          <Link
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 transition-colors"
            href="/schedule"
            onClick={() => setMenuOpen(false)}
          >
            <IconCalendar />
            <span>Agenda</span>
          </Link>
          <Link
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 transition-colors"
            href="/students"
            onClick={() => setMenuOpen(false)}
          >
            <IconStudents />
            <span>Alumnos</span>
          </Link>
          <Link
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 transition-colors"
            href="/finance"
            onClick={() => setMenuOpen(false)}
          >
            <IconMoney />
            <span>Finanzas</span>
          </Link>
          {isAdmin && (
            <Link
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 transition-colors"
              href="/users"
              onClick={() => setMenuOpen(false)}
            >
              <IconUsers />
              <span>Usuarios</span>
            </Link>
          )}
          <Link
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 transition-colors"
            href="/reports"
            onClick={() => setMenuOpen(false)}
          >
            <IconReport />
            <span>Reportes</span>
          </Link>
          <button
            type="button"
            className="text-left mt-2 px-3 py-2 rounded text-xs text-red-600 hover:bg-red-50 transition-colors"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </nav>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border rounded-lg p-4 bg-white shadow-sm border-t-4 border-[#3cadaf]">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
              <IconMoney />
            </div>
            <p className="text-xs uppercase text-gray-500">Planes activos</p>
          </div>
          <p className="text-2xl font-semibold">{loading ? '...' : activePlansCount}</p>
          <p className="text-xs text-gray-500 mt-1">Planes con al menos un alumno con clases disponibles</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm border-t-4 border-[#22c55e]">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
              <IconStudents />
            </div>
            <p className="text-xs uppercase text-gray-500">Alumnos con plan</p>
          </div>
          <p className="text-2xl font-semibold">{loading ? '...' : studentsWithPlanCount}</p>
          <p className="text-xs text-gray-500 mt-1">Alumnos que aún tienen clases en algún plan</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm border-t-4 border-[#3b82f6]">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
              <IconCalendar />
            </div>
            <p className="text-xs uppercase text-gray-500">Clases de hoy</p>
          </div>
          <p className="text-2xl font-semibold">{loading ? '...' : todayClassesCount}</p>
          <p className="text-xs text-gray-500 mt-1">Clases programadas para el día de hoy</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm border-t-4 border-[#f97316]">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
              <IconUsers />
            </div>
            <p className="text-xs uppercase text-gray-500">Profesores / Alumnos</p>
          </div>
          <p className="text-2xl font-semibold">{loading ? '...' : `${coachesCount} / ${studentsCount}`}</p>
          <p className="text-xs text-gray-500 mt-1">Total de profesores y alumnos en la academia</p>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-[#f0f9fb] text-sm space-y-3 shadow-sm border border-[#3cadaf]/20">
        <h2 className="text-base font-semibold mb-1">¿Cómo instalar esta app en tu celular?</h2>
        <p className="text-gray-600">
          Seguí estos pasos para tener acceso rápido desde la pantalla de inicio de tu celular.
        </p>

        <div>
          <h3 className="font-semibold text-[#31435d]">iPhone (Safari)</h3>
          <ol className="list-decimal list-inside text-gray-700 space-y-1 mt-1">
            <li>Abrí este enlace en Safari.</li>
            <li>Tocá el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).</li>
            <li>En el menú que se abre, tocá los <strong>tres puntitos</strong> (Más opciones).</li>
            <li>Elegí <strong>"Agregar a inicio"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.</li>
            <li>Confirmá con <strong>Agregar</strong>.</li>
          </ol>
        </div>

        <div>
          <h3 className="font-semibold text-[#31435d]">Android (Chrome)</h3>
          <ol className="list-decimal list-inside text-gray-700 space-y-1 mt-1">
            <li>Abrí este enlace en Chrome.</li>
            <li>Tocá el botón de <strong>tres puntos</strong> arriba a la derecha.</li>
            <li>Elegí <strong>"Agregar a pantalla principal"</strong> o <strong>"Instalar app"</strong>.</li>
            <li>Confirmá cuando aparezca el mensaje.</li>
          </ol>
        </div>

        <p className="text-gray-600">
          Una vez instalado, vas a ver el icono de la academia en tu pantalla de inicio y podés entrar directo como si fuera una app.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
