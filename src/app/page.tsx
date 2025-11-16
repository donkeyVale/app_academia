"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';

export default function HomePage() {
  const supabase = createClientBrowser();
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          .select('full_name')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.full_name) {
          displayName = profile.full_name as string;
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
    <section className="space-y-6 max-w-5xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bienvenido</h1>
          <p className="text-sm text-gray-600">Usuario: {userName ?? '...'}</p>
        </div>
        <button
          type="button"
          className="border rounded px-3 py-2 text-sm flex flex-col justify-center items-center gap-0.5"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          <span className="block w-5 h-0.5 bg-black" />
          <span className="block w-5 h-0.5 bg-black" />
          <span className="block w-5 h-0.5 bg-black" />
        </button>
      </div>

      {menuOpen && (
        <nav className="border rounded p-3 bg-white flex flex-col gap-2 text-sm">
          <Link className="underline" href="/schedule" onClick={() => setMenuOpen(false)}>Agenda</Link>
          <Link className="underline" href="/students" onClick={() => setMenuOpen(false)}>Alumnos</Link>
          <Link className="underline" href="/finance" onClick={() => setMenuOpen(false)}>Finanzas</Link>
          <Link className="underline" href="/reports" onClick={() => setMenuOpen(false)}>Reportes</Link>
          <button
            type="button"
            className="text-left underline text-red-600 mt-1"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </nav>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border rounded p-4 bg-white">
          <p className="text-xs uppercase text-gray-500 mb-1">Planes activos</p>
          <p className="text-2xl font-semibold">{loading ? '...' : activePlansCount}</p>
          <p className="text-xs text-gray-500 mt-1">Planes con al menos un alumno con clases disponibles</p>
        </div>
        <div className="border rounded p-4 bg-white">
          <p className="text-xs uppercase text-gray-500 mb-1">Alumnos con plan</p>
          <p className="text-2xl font-semibold">{loading ? '...' : studentsWithPlanCount}</p>
          <p className="text-xs text-gray-500 mt-1">Alumnos que aún tienen clases en algún plan</p>
        </div>
        <div className="border rounded p-4 bg-white">
          <p className="text-xs uppercase text-gray-500 mb-1">Clases de hoy</p>
          <p className="text-2xl font-semibold">{loading ? '...' : todayClassesCount}</p>
          <p className="text-xs text-gray-500 mt-1">Clases programadas para el día de hoy</p>
        </div>
        <div className="border rounded p-4 bg-white">
          <p className="text-xs uppercase text-gray-500 mb-1">Profesores / Alumnos</p>
          <p className="text-2xl font-semibold">{loading ? '...' : `${coachesCount} / ${studentsCount}`}</p>
          <p className="text-xs text-gray-500 mt-1">Total de profesores y alumnos en la academia</p>
        </div>
      </div>

      <div className="border rounded p-4 bg-white text-sm space-y-3">
        <h2 className="text-base font-semibold mb-1">¿Cómo instalar esta app en tu celular?</h2>
        <p className="text-gray-600">
          Seguí estos pasos para tener acceso rápido desde la pantalla de inicio de tu celular.
        </p>

        <div>
          <h3 className="font-semibold text-[#31435d]">iPhone (Safari)</h3>
          <ol className="list-decimal list-inside text-gray-700 space-y-1 mt-1">
            <li>Abrí este enlace en Safari.</li>
            <li>Tocá el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).</li>
            <li>Deslizá hacia abajo y elegí <strong>"Agregar a la pantalla de inicio"</strong>.</li>
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
