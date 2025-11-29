"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { FooterAvatarButton } from '@/components/footer-avatar-button';
import { FooterNav } from '@/components/footer-nav';
import { AgendoLogo } from '@/components/agendo-logo';
import { useRouter } from 'next/navigation';
import { createClientBrowser } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Smartphone,
  Layers,
  Users,
  CalendarDays,
  UserCog,
  CalendarClock,
  TicketPercent,
  CreditCard,
  BarChart3,
  LogOut,
  UserCircle2,
} from 'lucide-react';

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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function HomePage() {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<'admin' | 'coach' | 'student' | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);

  const [activePlansCount, setActivePlansCount] = useState(0);
  const [studentsWithPlanCount, setStudentsWithPlanCount] = useState(0);
  const [todayClassesCount, setTodayClassesCount] = useState(0);
  const [coachesCount, setCoachesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [showInstallHelpOpen, setShowInstallHelpOpen] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [popupDontShowAgain, setPopupDontShowAgain] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  // métricas específicas para coach
  const [coachTodayClasses, setCoachTodayClasses] = useState(0);
  const [coachWeekClasses, setCoachWeekClasses] = useState(0);
  const [coachActiveStudents, setCoachActiveStudents] = useState(0);

  // métricas específicas para alumno
  const [studentUpcomingClasses, setStudentUpcomingClasses] = useState(0);
  const [studentRemainingClasses, setStudentRemainingClasses] = useState<number | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      const user = data.user;
      const userId = user?.id;

      // nombre del usuario: intentamos en este orden
      // 1) profiles.full_name
      // 2) user_metadata.first_name / last_name
      // 3) email
      let displayName: string | null = null;

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
        if (profile?.role === 'admin' || profile?.role === 'coach' || profile?.role === 'student') {
          setRole(profile.role as 'admin' | 'coach' | 'student');
        } else {
          setRole(null);
        }
      }

      const meta = (user?.user_metadata ?? {}) as any;

      if (!displayName) {
        const fn = (meta.first_name as string | null) ?? '';
        const ln = (meta.last_name as string | null) ?? '';
        const fullFromMeta = `${fn} ${ln}`.trim();
        if (fullFromMeta) {
          displayName = fullFromMeta;
        }
      }

      if (!displayName) {
        displayName = user?.email ?? null;
      }

      const avatarMeta = (meta.avatar_url as string | null) ?? null;
      setAvatarUrl(avatarMeta);

      const offX = Number(meta.avatar_offset_x ?? 0);
      const offY = Number(meta.avatar_offset_y ?? 0);
      setAvatarOffsetX(Number.isFinite(offX) ? offX : 0);
      setAvatarOffsetY(Number.isFinite(offY) ? offY : 0);

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

        if (role === 'admin' || role === null) {
          // Dashboard global para admin (y fallback cuando aún no se cargó role)
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
        } else if (role === 'coach' && userId) {
          // Dashboard específico para coach
          // 1) Obtener id de coach vinculado al usuario
          const { data: coachRow, error: coachRowErr } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (coachRowErr) throw coachRowErr;
          const coachId = coachRow?.id as string | undefined;

          if (!coachId) {
            setCoachTodayClasses(0);
            setCoachWeekClasses(0);
            setCoachActiveStudents(0);
          } else {
            // Clases de hoy para este coach
            const { count: todayCount, error: todayErr } = await supabase
              .from('class_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('coach_id', coachId)
              .gte('date', start.toISOString())
              .lte('date', end.toISOString());
            if (todayErr) throw todayErr;
            setCoachTodayClasses(todayCount ?? 0);

            // Clases de esta semana (Lunes-Domingo) para este coach
            const weekStart = new Date(today);
            const dayOfWeek = weekStart.getDay(); // 0=Domingo
            const diffToMonday = (dayOfWeek + 6) % 7; // 0->6,1->0,...
            weekStart.setDate(weekStart.getDate() - diffToMonday);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const { count: weekCount, error: weekErr } = await supabase
              .from('class_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('coach_id', coachId)
              .gte('date', weekStart.toISOString())
              .lte('date', weekEnd.toISOString());
            if (weekErr) throw weekErr;
            setCoachWeekClasses(weekCount ?? 0);

            // Alumnos activos: alumnos con reservas en clases futuras de este coach
            const futureFrom = new Date();
            const futureTo = new Date(futureFrom.getTime() + 14 * 24 * 60 * 60 * 1000);
            const { data: futureClasses, error: futureErr } = await supabase
              .from('class_sessions')
              .select('id,date')
              .eq('coach_id', coachId)
              .gte('date', futureFrom.toISOString())
              .lte('date', futureTo.toISOString());
            if (futureErr) throw futureErr;

            const classIds = (futureClasses ?? []).map((c) => c.id as string);
            if (!classIds.length) {
              setCoachActiveStudents(0);
            } else {
              const { data: bookingsData, error: bookingsErr } = await supabase
                .from('bookings')
                .select('student_id,class_id')
                .in('class_id', classIds);
              if (bookingsErr) throw bookingsErr;
              const studentSet = new Set<string>();
              (bookingsData ?? []).forEach((b: any) => {
                studentSet.add(b.student_id as string);
              });
              setCoachActiveStudents(studentSet.size);
            }
          }
        } else if (role === 'student' && userId) {
          // Dashboard específico para alumno
          // 1) Obtener id de student vinculado al usuario
          const { data: studentRow, error: studentRowErr } = await supabase
            .from('students')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (studentRowErr) throw studentRowErr;
          const studentId = studentRow?.id as string | undefined;

          if (!studentId) {
            setStudentUpcomingClasses(0);
            setStudentRemainingClasses(null);
          } else {
            // Próximas clases: reservas futuras de este alumno
            const nowIso = new Date().toISOString();
            const { data: upcomingData, error: upcomingErr } = await supabase
              .from('bookings')
              .select('class_id,class_sessions!inner(id,date)')
              .eq('student_id', studentId)
              .gte('class_sessions.date', nowIso);
            if (upcomingErr) throw upcomingErr;
            setStudentUpcomingClasses((upcomingData ?? []).length);

            // Clases restantes del plan actual (último plan asignado)
            const { data: spData, error: spErr } = await supabase
              .from('student_plans')
              .select('id, remaining_classes, purchased_at, plans(name,classes_included)')
              .eq('student_id', studentId)
              .order('purchased_at', { ascending: false })
              .limit(1);
            if (spErr) throw spErr;

            if (!spData || spData.length === 0) {
              setStudentRemainingClasses(null);
            } else {
              const planRow = spData[0] as any;
              const totalFromPlan = (planRow.remaining_classes as number) ?? 0;

              // Igual que en la pantalla de alumnos: contamos usos en plan_usages
              const { data: usagesData, error: usagesErr } = await supabase
                .from('plan_usages')
                .select('id')
                .eq('student_plan_id', planRow.id)
                .eq('student_id', studentId);
              if (usagesErr) throw usagesErr;
              const used = (usagesData ?? []).length;

              const remaining = Math.max(0, totalFromPlan - used);
              setStudentRemainingClasses(remaining);
            }
          }
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Error cargando métricas');
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [supabase, role]);

  // Registro de service worker y suscripción Web Push
  useEffect(() => {
    async function setupPush() {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY no está configurada. Push deshabilitado.');
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.register('/sw.js');

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey as unknown as ArrayBuffer,
          });
        }

        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id as string | undefined;
        if (!userId) return;

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...subscription.toJSON(), userId, platform: 'web' }),
        });
      } catch (err) {
        console.error('Error configurando notificaciones push', err);
      }
    }

    setupPush();
  }, [supabase]);

  // Popup de recordatorio para leer cómo instalar la app en el celular
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('hide_install_help_reminder');
      if (stored === 'true') {
        setShowInstallPopup(false);
      } else {
        setShowInstallPopup(true);
      }
    } catch {
      // si localStorage falla, simplemente no mostramos el popup
    }
  }, []);

  const initials = (() => {
    const name = (userName ?? '').trim();
    if (!name) return '';
    const parts = name.split(' ');
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    return `${first ?? ''}${second ?? ''}`.toUpperCase();
  })();

  const roleResolved = role === 'admin' || role === 'coach' || role === 'student';

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
    <section className="space-y-6 max-w-5xl mx-auto px-4 pt-6 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#31435d]">
            Hola {userName ?? '...'}
          </h1>
          <p className="text-sm text-gray-600">
            {role === 'student'
              ? 'Revisá tus próximas clases y tu plan en un solo lugar.'
              : 'Gestioná tu agenda desde un solo lugar.'}
          </p>
        </div>
        <div className="flex items-center justify-end flex-1">
          <AgendoLogo />
        </div>
      </div>

      {(!role || role === 'admin') && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <motion.button
            type="button"
            whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="border rounded-xl p-4 bg-white shadow-sm border-t-4 border-[#3cadaf] text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/60 focus:ring-offset-1"
            onClick={() => router.push('/students')}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
                <Layers className="w-4 h-4 text-[#3cadaf]" />
              </div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Planes activos</p>
            </div>
            <p className="text-2xl font-semibold text-[#111827]">{loading ? '...' : activePlansCount}</p>
            <p className="text-xs text-gray-500 mt-1">Planes con al menos un alumno con clases disponibles</p>
          </motion.button>
          <motion.div
            whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="border rounded-xl p-4 bg-white shadow-sm border-t-4 border-[#22c55e]"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
                <Users className="w-4 h-4 text-[#22c55e]" />
              </div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Alumnos con plan</p>
            </div>
            <p className="text-2xl font-semibold text-[#111827]">{loading ? '...' : studentsWithPlanCount}</p>
            <p className="text-xs text-gray-500 mt-1">Alumnos que aún tienen clases en algún plan</p>
          </motion.div>
          <motion.div
            whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="border rounded-xl p-4 bg-white shadow-sm border-t-4 border-[#3b82f6]"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-[#3b82f6]" />
              </div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Clases de hoy</p>
            </div>
            <p className="text-2xl font-semibold text-[#111827]">{loading ? '...' : todayClassesCount}</p>
            <p className="text-xs text-gray-500 mt-1">Clases programadas para el día de hoy</p>
          </motion.div>
          <motion.div
            whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="border rounded-xl p-4 bg-white shadow-sm border-t-4 border-[#f97316]"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-full bg-[#e6f5f6] flex items-center justify-center">
                <UserCog className="w-4 h-4 text-[#f97316]" />
              </div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Profesores / Alumnos</p>
            </div>
            <p className="text-2xl font-semibold text-[#111827]">{loading ? '...' : `${coachesCount} / ${studentsCount}`}</p>
            <p className="text-xs text-gray-500 mt-1">Total de profesores y alumnos en la academia</p>
          </motion.div>
        </div>
      )}

      {role === 'coach' && (
        <div className="space-y-4">
          {/* Hero para coach: enfoque en las clases de hoy */}
          <motion.div
            whileHover={{ y: -1, boxShadow: '0 16px 40px rgba(15,23,42,0.30)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white px-4 py-5 shadow-lg"
          >
            <div className="relative z-10 flex flex-col gap-3">
              <div className="text-xs uppercase tracking-wide text-white/80">Tus clases de hoy</div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm text-white/80">Clases donde sos profesor</div>
                  <div className="text-3xl font-bold leading-tight">
                    {loading ? '...' : coachTodayClasses}
                  </div>
                  <div className="mt-1 text-xs text-white/80">
                    {loading
                      ? 'Cargando tus clases de hoy...'
                      : coachTodayClasses === 0
                      ? 'Hoy no tenés clases asignadas. Podés revisar la semana desde la Agenda.'
                      : 'Revisá el detalle de horarios y alumnos en tu Agenda.'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/schedule?scope=today')}
                    className="inline-flex items-center gap-2 rounded-full bg-white text-sky-800 px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-slate-50"
                  >
                    Ver clases de hoy
                    <CalendarDays className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          </motion.div>

          {/* Cards de apoyo para coach: semana y alumnos activos */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <motion.div
              whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="border rounded-2xl p-4 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm border-t-4 border-[#22c55e]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 text-emerald-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80">
                    <IconCalendar />
                  </span>
                  <span>Clases esta semana</span>
                </div>
              </div>
              <p className="text-4xl font-bold text-[#0f172a] tracking-tight">
                {loading ? '...' : coachWeekClasses}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Total de clases donde sos profesor entre lunes y domingo.
              </p>
            </motion.div>

            <motion.button
              type="button"
              whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              onClick={() => router.push('/students')}
              className="border rounded-2xl p-4 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-sm border-t-4 border-[#3cadaf] text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/60 focus:ring-offset-1"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-100/80 text-sky-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80">
                    <IconStudents />
                  </span>
                  <span>Alumnos activos</span>
                </div>
              </div>
              <p className="text-4xl font-bold text-[#0f172a] tracking-tight">
                {loading ? '...' : coachActiveStudents}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Alumnos con clases futuras reservadas con vos en las próximas semanas.
              </p>
            </motion.button>
          </div>
        </div>
      )}

      {role === 'student' && (
        <div className="space-y-4">
          {/* Hero principal para alumno */}
          <motion.div
            whileHover={{ y: -1, boxShadow: '0 16px 40px rgba(15,23,42,0.30)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500 text-white px-4 py-5 shadow-lg"
          >
            <div className="relative z-10 flex flex-col gap-3">
              <div className="text-xs uppercase tracking-wide text-white/80">Tu próxima sesión</div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm text-white/80">Clases reservadas</div>
                  <div className="text-3xl font-bold leading-tight">
                    {loading ? '...' : studentUpcomingClasses}
                  </div>
                  <div className="mt-1 text-xs text-white/80">
                    {loading
                      ? 'Cargando tus próximas clases...'
                      : studentUpcomingClasses === 0
                      ? 'Aún no tenés próximas clases. Reservá una desde la Agenda.'
                      : 'Tenés clases futuras reservadas en tu Agenda.'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/schedule')}
                    className="inline-flex items-center gap-2 rounded-full bg-white text-sky-700 px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-slate-50"
                  >
                    Ir a Agenda
                    <CalendarDays className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          </motion.div>

          {/* Card de apoyo: progreso de plan */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <motion.button
              type="button"
              whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              onClick={() => router.push('/students')}
              className="border rounded-2xl p-4 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm border-t-4 border-[#3cadaf] text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/60 focus:ring-offset-1"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 text-emerald-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80">
                    <IconMoney />
                  </span>
                  <span>Clases restantes</span>
                </div>
              </div>
              <p className="text-4xl font-bold text-[#0f172a] tracking-tight">
                {loading ? '...' : studentRemainingClasses === null ? '-' : studentRemainingClasses}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Clases que aún tenés disponibles en tu plan actual.
              </p>
            </motion.button>
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-[#f0f9fb] hover:bg-[#e1f3f7] rounded-t-lg"
          onClick={() => setShowInstallHelpOpen((v) => !v)}
        >
          <span className="inline-flex items-center gap-2 font-semibold text-[#31435d]">
            <Smartphone className="w-4 h-4 text-[#3cadaf]" />
            ¿Cómo instalar esta app en tu celular?
          </span>
          <span className="text-xs text-gray-500">{showInstallHelpOpen ? '▼' : '▲'}</span>
        </button>
        {showInstallHelpOpen && (
          <div
            id="install-app-help"
            className="p-4 text-sm space-y-3 bg-[#f0f9fb] border-t border-[#3cadaf]/20 origin-top"
          >
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
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <FooterNav
        isAdmin={isAdmin}
        canSeeReports={role === 'admin'}
        canSeeFinance={role !== 'student'}
        canSeeSettings={role === 'coach' || role === 'student'}
        studentsLabel={role === 'student' ? 'Mi cuenta' : 'Alumnos'}
        rightSlot={(
          <>
            <FooterAvatarButton
              avatarUrl={avatarUrl}
              initials={initials}
              avatarOffsetX={avatarOffsetX}
              avatarOffsetY={avatarOffsetY}
              onClick={() => setAvatarMenuOpen((v) => !v)}
            />
            {avatarMenuOpen && (
              <div className="absolute bottom-12 right-0 w-48 rounded-md border bg-white shadow-lg text-xs sm:text-sm py-1.5 z-50">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-gray-50 text-left"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    router.push('/profile');
                  }}
                >
                  <UserCircle2 className="w-3.5 h-3.5" />
                  <span>Mi perfil</span>
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-red-50 text-left text-red-600"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </>
        )}
      />

      <Dialog open={showInstallPopup} onOpenChange={setShowInstallPopup}>
        <DialogContent
          className="w-full max-w-md sm:max-w-lg max-h-[90vh] p-0 flex flex-col rounded-xl border border-gray-200 shadow-xl bg-slate-50/95 backdrop-blur data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogHeader className="px-4 pt-4 pb-2 border-b bg-white/80 backdrop-blur-sm rounded-t-xl">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#3cadaf]" />
              <DialogTitle className="text-lg font-semibold text-[#31435d]">
                Instalá esta app en tu celular
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Recordatorio para leer la guía de instalación de la app en tu celular
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 py-3 overflow-y-auto text-sm space-y-3">
            <p className="text-gray-700">
              Tenés disponible una guía rápida para instalar esta app en la pantalla de inicio de tu celular.
            </p>
            <p className="text-gray-600">
              Podés leerla cuando quieras en la sección <strong>"¿Cómo instalar esta app en tu celular?"</strong> al final de esta pantalla.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <input
                id="dont-show-install-popup"
                type="checkbox"
                className="rounded border-gray-300"
                checked={popupDontShowAgain}
                onChange={(e) => setPopupDontShowAgain(e.target.checked)}
              />
              <label htmlFor="dont-show-install-popup">
                No volver a mostrar este recordatorio.
              </label>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 px-4 py-3 border-t bg-white text-xs rounded-b-xl">
            <button
              type="button"
              className="px-3 py-2 border rounded"
              onClick={() => {
                if (typeof window !== 'undefined' && popupDontShowAgain) {
                  try {
                    window.localStorage.setItem('hide_install_help_reminder', 'true');
                  } catch {}
                }
                setShowInstallPopup(false);
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="px-3 py-2 bg-[#3cadaf] hover:bg-[#31435d] text-white rounded"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // 1) Abrimos el acordeón de ayuda si aún no está abierto
                  if (!showInstallHelpOpen) {
                    setShowInstallHelpOpen(true);
                  }

                  // 2) Esperamos un pequeño tiempo para que el contenido se monte y luego hacemos scroll
                  setTimeout(() => {
                    const el = document.getElementById('install-app-help');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 120);

                  // 3) Respetamos la preferencia de no volver a mostrar el popup
                  if (popupDontShowAgain) {
                    try {
                      window.localStorage.setItem('hide_install_help_reminder', 'true');
                    } catch {}
                  }
                }
                setShowInstallPopup(false);
              }}
            >
              Ver instrucciones ahora
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
