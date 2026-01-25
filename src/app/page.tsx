"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FooterAvatarButton } from '@/components/footer-avatar-button';
import { FooterNav } from '@/components/footer-nav';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { PushPermissionPrompt } from '@/components/push-permission-prompt';
import { NotificationsMenuItem } from '@/components/notifications-menu-item';
import { AgendoLogo } from '@/components/agendo-logo';
import AdminHomeIncomeExpensesCard from '@/app/(dashboard)/AdminHomeIncomeExpensesCard';
import SuperAdminHomeClient from '@/app/(dashboard)/SuperAdminHomeClient';
import { useRouter } from 'next/navigation';
import { createClientBrowser } from "@/lib/supabase";
import { toast } from "sonner";
import { isBiometricEnabled } from "@/lib/capacitor-biometrics";
import { oneSignalLogout } from '@/lib/capacitor-onesignal';
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

type AppRole = 'super_admin' | 'admin' | 'coach' | 'student' | null;

const IMPERSONATE_KEY = 'impersonateAcademyId';
const IMPERSONATE_EVT = 'impersonateAcademyIdChanged';
const LS_PREV_KEY = 'selectedAcademyIdBeforeImpersonation';
const LS_NAME_KEY = 'impersonateAcademyName';

type SuperAdminAuditRow = {
  id: string;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  user_id: string | null;
  payload: any;
};

export default function Page() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const avatarMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AppRole>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scheduleBadgeCount, setScheduleBadgeCount] = useState(0);
  const [scheduleBadgeTick, setScheduleBadgeTick] = useState<number>(() => Date.now());
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('selectedAcademyId');
  });
  const [impersonateAcademyId, setImpersonateAcademyId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(IMPERSONATE_KEY);
    return v && v.trim() ? v : null;
  });
  const [impersonateAcademyName, setImpersonateAcademyName] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(LS_NAME_KEY);
    return v && v.trim() ? v : null;
  });
  const [academyOptions, setAcademyOptions] = useState<{ id: string; name: string }[]>([]);
  const [hasAcademies, setHasAcademies] = useState<boolean | null>(null);
  const [academyLocationIds, setAcademyLocationIds] = useState<Set<string>>(new Set());
  const [activePlansCount, setActivePlansCount] = useState(0);
  const [studentsWithPlanCount, setStudentsWithPlanCount] = useState(0);
  const [todayClassesCount, setTodayClassesCount] = useState(0);
  const [coachesCount, setCoachesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [showInstallHelpOpen, setShowInstallHelpOpen] = useState(false);

  // métricas específicas para coach
  const [coachTodayClasses, setCoachTodayClasses] = useState(0);
  const [coachWeekClasses, setCoachWeekClasses] = useState(0);
  const [coachActiveStudents, setCoachActiveStudents] = useState(0);

  // métricas específicas para alumno
  const [studentUpcomingClasses, setStudentUpcomingClasses] = useState(0);
  const [studentRemainingClasses, setStudentRemainingClasses] = useState<number | null>(null);

  const [superAdminTotalUsers, setSuperAdminTotalUsers] = useState<number | null>(null);
  const [superAdminCountsByAcademy, setSuperAdminCountsByAcademy] = useState<
    Record<string, { admin: number; coach: number; student: number; total: number }>
  >({});
  const [superAdminAudit, setSuperAdminAudit] = useState<SuperAdminAuditRow[]>([]);

  const superAdminRecentStudentCreates = useMemo(() => {
    const now = Date.now();
    const fromTs = now - 30 * 24 * 60 * 60 * 1000;

    const rows = (superAdminAudit ?? [])
      .filter((r) => r.action === 'user_created')
      .filter((r) => {
        const ts = new Date(r.created_at).getTime();
        return Number.isFinite(ts) && ts >= fromTs;
      })
      .filter((r) => {
        const p = r.payload as any;
        const main = String(p?.main_role ?? '').trim();
        if (main === 'student') return true;
        const roles = Array.isArray(p?.roles) ? (p.roles as any[]) : [];
        return roles.includes('student');
      });

    const byAcademy: Record<
      string,
      {
        academyName: string;
        days: Record<string, { createdAt: string; fullName: string; email: string }[]>;
      }
    > = {};

    for (const r of rows) {
      const p = r.payload as any;
      const academyId = String(p?.academy_id ?? '').trim();
      if (!academyId) continue;

      const academyName = academyOptions.find((a) => a.id === academyId)?.name ?? academyId;
      const day = String(r.created_at).slice(0, 10);
      const fullName = String(p?.new_user_full_name ?? '').trim();
      const email = String(p?.new_user_email ?? '').trim();

      const bucket = (byAcademy[academyId] ||= { academyName, days: {} });
      (bucket.days[day] ||= []).push({ createdAt: r.created_at, fullName, email });
    }

    return byAcademy;
  }, [superAdminAudit, academyOptions]);

  const handleLogout = async () => {
    await supabase.auth.signOut(isBiometricEnabled() ? ({ scope: 'local' } as any) : undefined);
    window.location.href = '/login';
  };

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return '';
    if (unreadCount > 99) return '99+';
    return String(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    const id = window.setInterval(() => setScheduleBadgeTick(Date.now()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const read = () => {
      const v = window.localStorage.getItem(IMPERSONATE_KEY);
      setImpersonateAcademyId(v && v.trim() ? v : null);
      const n = window.localStorage.getItem(LS_NAME_KEY);
      setImpersonateAcademyName(n && n.trim() ? n : null);
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === IMPERSONATE_KEY) read();
      if (e.key === LS_NAME_KEY) read();
    };
    const onEvt = () => read();
    window.addEventListener('storage', onStorage);
    window.addEventListener(IMPERSONATE_EVT, onEvt as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(IMPERSONATE_EVT, onEvt as EventListener);
    };
  }, []);

  const effectiveRole: AppRole = useMemo(() => {
    if (role === 'super_admin' && impersonateAcademyId) return 'admin';
    return role;
  }, [role, impersonateAcademyId]);

  useEffect(() => {
    // Solo un super_admin puede impersonar; si un admin normal abre el sitio con localStorage sucio, limpiamos.
    if (role === null) return;
    if (role === 'super_admin') return;
    if (!impersonateAcademyId) return;
    try {
      window.localStorage.removeItem(IMPERSONATE_KEY);
      window.localStorage.removeItem(LS_PREV_KEY);
      window.dispatchEvent(new CustomEvent(IMPERSONATE_EVT, { detail: { academyId: null } }));
    } catch {
      // ignore
    }
  }, [role, impersonateAcademyId]);

  const onExitImpersonation = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(IMPERSONATE_KEY);
    window.dispatchEvent(new CustomEvent(IMPERSONATE_EVT, { detail: { academyId: null } }));

    const prev = window.localStorage.getItem(LS_PREV_KEY);
    if (prev && prev.trim()) {
      window.localStorage.setItem('selectedAcademyId', prev);
      window.dispatchEvent(new CustomEvent('selectedAcademyIdChanged', { detail: { academyId: prev } }));
    }
    window.localStorage.removeItem(LS_PREV_KEY);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRefresh = () => setScheduleBadgeTick(Date.now());
    window.addEventListener('scheduleBadgeRefresh', onRefresh);
    return () => window.removeEventListener('scheduleBadgeRefresh', onRefresh);
  }, []);

  useEffect(() => {
    const roleResolved = role === 'super_admin' || role === 'admin' || role === 'coach' || role === 'student';
    if (!roleResolved || !userId || !selectedAcademyId) {
      setScheduleBadgeCount(0);
      return;
    }

    const loadScheduleBadgeCount = async () => {
      try {
        const fromIso = new Date().toISOString();
        const toIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: locRows, error: locErr } = await supabase
          .from('academy_locations')
          .select('location_id')
          .eq('academy_id', selectedAcademyId);
        if (locErr) throw locErr;

        const locationIds = Array.from(
          new Set(
            ((locRows as { location_id: string | null }[] | null) ?? [])
              .map((r) => r.location_id)
              .filter((id): id is string => !!id)
          )
        );

        if (locationIds.length === 0) {
          setScheduleBadgeCount(0);
          return;
        }

        const { data: courtRows, error: courtsErr } = await supabase
          .from('courts')
          .select('id')
          .in('location_id', locationIds);
        if (courtsErr) throw courtsErr;

        const courtIds = Array.from(
          new Set(
            ((courtRows as { id: string }[] | null) ?? [])
              .map((c) => c.id)
              .filter((id): id is string => !!id)
          )
        );

        if (courtIds.length === 0) {
          setScheduleBadgeCount(0);
          return;
        }

        if (role === 'student') {
          const { data: studentRow, error: studentErr } = await supabase
            .from('students')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (studentErr) throw studentErr;
          const studentId = (studentRow?.id as string | undefined) ?? null;
          if (!studentId) {
            setScheduleBadgeCount(0);
            return;
          }

          const { data: classRows, error: classErr } = await supabase
            .from('class_sessions')
            .select('id')
            .gte('date', fromIso)
            .lte('date', toIso)
            .in('court_id', courtIds)
            .neq('status', 'cancelled');
          if (classErr) throw classErr;
          const classIds = ((classRows as { id: string }[] | null) ?? []).map((c) => c.id);
          if (classIds.length === 0) {
            setScheduleBadgeCount(0);
            return;
          }

          const { count, error: bErr } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .eq('status', 'reserved')
            .in('class_id', classIds);
          if (bErr) throw bErr;
          setScheduleBadgeCount(count ?? 0);
          return;
        }

        if (role === 'coach') {
          const { data: coachRow, error: coachErr } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (coachErr) throw coachErr;
          const coachId = (coachRow?.id as string | undefined) ?? null;
          if (!coachId) {
            setScheduleBadgeCount(0);
            return;
          }

          const { count, error: cErr } = await supabase
            .from('class_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('coach_id', coachId)
            .gte('date', fromIso)
            .lte('date', toIso)
            .in('court_id', courtIds)
            .neq('status', 'cancelled');
          if (cErr) throw cErr;
          setScheduleBadgeCount(count ?? 0);
          return;
        }

        const { count, error: csErr } = await supabase
          .from('class_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('date', fromIso)
          .lte('date', toIso)
          .in('court_id', courtIds)
          .neq('status', 'cancelled');
        if (csErr) throw csErr;
        setScheduleBadgeCount(count ?? 0);
      } catch (e) {
        setScheduleBadgeCount(0);
      }
    };

    loadScheduleBadgeCount();
  }, [supabase, userId, selectedAcademyId, role, scheduleBadgeTick]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = (session?.user?.id as string | undefined) ?? null;
      setUserId(nextUserId);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'selectedAcademyId') {
        setSelectedAcademyId(e.newValue || null);
      }
    };
    const onAcademyChanged = (e: Event) => {
      const next = (e as CustomEvent<{ academyId?: string | null }>).detail?.academyId ?? null;
      setSelectedAcademyId(next);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('selectedAcademyIdChanged', onAcademyChanged);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (!selectedAcademyId) return;

    const loadUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('data->>academyId', selectedAcademyId)
        .is('read_at', null);
      setUnreadCount(count ?? 0);
    };

    loadUnread();

    const channel = supabase
      .channel(`notifications-count:home:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, selectedAcademyId]);

  useEffect(() => {
    if (!avatarMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-slot="popover-content"]') || target.closest('[data-slot="popover-trigger"]')) {
        return;
      }

      const root = avatarMenuRef.current;
      if (!root) return;
      if (!root.contains(target)) {
        setAvatarMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [avatarMenuOpen]);

  useEffect(() => {
    if (!avatarMenuOpen) return;

    const t = window.setTimeout(() => {
      const panel = avatarMenuPanelRef.current;
      const first = panel?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      first?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAvatarMenuOpen(false);
        avatarButtonRef.current?.focus();
        return;
      }

      if (e.key !== 'Tab') return;

      const panel = avatarMenuPanelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled'));

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!activeEl || activeEl === first || !panel.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!activeEl || activeEl === last || !panel.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [avatarMenuOpen]);

  useEffect(() => {
    async function setupPush() {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) return;

      if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
        return;
      }

      // iOS/Safari suele bloquear el prompt si no hay interacción del usuario.
      // La solicitud de permiso se hace desde PushPermissionPrompt (botón).
      if (Notification.permission !== 'granted') {
        return;
      }

      try {
        const alreadyPrompted = window.localStorage.getItem('pushPermissionPrompted');
        if (alreadyPrompted) return;

        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id as string | undefined;
        if (!userId) return;

        let registration: ServiceWorkerRegistration;
        try {
          registration = await navigator.serviceWorker.ready;
        } catch {
          registration = await navigator.serviceWorker.register('/sw.js');
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey as unknown as ArrayBuffer,
          });
        }

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

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      const user = data.user;
      const userId = user?.id;
      setUserId((userId as string | undefined) ?? null);

      // nombre del usuario: intentamos en este orden
      // 1) profiles.full_name
      // 2) user_metadata.first_name / last_name
      // 3) email
      let displayName: string | null = null;

      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, default_academy_id')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.full_name) {
          displayName = profile.full_name as string;
        }
        const r = (profile?.role as AppRole) ?? null;
        const isSuperAdmin = r === 'super_admin';
        setIsAdmin(r === 'admin' || isSuperAdmin);
        if (r === 'super_admin' || r === 'admin' || r === 'coach' || r === 'student') {
          setRole(r);
        } else {
          setRole(null);
        }

        // Cargar academias asignadas al usuario (para selector de academia actual)
        try {
          if (isSuperAdmin) {
            const { data: acadRows, error: acadErr } = await supabase
              .from('academies')
              .select('id,name')
              .order('name');

            if (acadErr) {
              setHasAcademies(false);
              setAcademyOptions([]);
              setSelectedAcademyId(null);
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('selectedAcademyId');
              }
            } else {
              const options = (acadRows as { id: string; name: string | null }[]).map((a) => ({
                id: a.id,
                name: a.name ?? a.id,
              }));
              setAcademyOptions(options);
              setHasAcademies(options.length > 0);

              let stored: string | null = null;
              if (typeof window !== 'undefined') {
                stored = window.localStorage.getItem('selectedAcademyId');
              }
              const validIds = options.map((o) => o.id);

              const profileDefault = (profile as any)?.default_academy_id as string | null | undefined;
              let initial: string | null = null;
              if (profileDefault && validIds.includes(profileDefault)) {
                initial = profileDefault;
              } else if (stored && validIds.includes(stored)) {
                initial = stored;
              } else {
                initial = validIds[0] ?? null;
              }

              setSelectedAcademyId(initial);
              if (initial && typeof window !== 'undefined') {
                window.localStorage.setItem('selectedAcademyId', initial);
              }
            }

            // super_admin: acceso global, no depende de user_academies
            // por lo tanto no aplicamos bloqueo por inactividad.
            // seguimos con el resto del flujo (avatar, nombre, etc.)
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
            setLoading(false);
            return;
          }

          const { data: uaRows, error: uaErr } = await supabase
            .from('user_academies')
            .select('academy_id, is_active')
            .eq('user_id', userId);

          if (uaErr) {
            // Si hay error al leer user_academies, asumimos que no hay academias visibles para este usuario
            setHasAcademies(false);
            setAcademyOptions([]);
            setSelectedAcademyId(null);
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('selectedAcademyId');
            }
          } else if (uaRows) {
            const inactiveAcademyIds = new Set(
              (uaRows as { academy_id: string | null; is_active: boolean | null }[])
                .filter((row) => row.academy_id && (row.is_active ?? true) === false)
                .map((row) => row.academy_id as string)
            );

            const academyIds = Array.from(
              new Set(
                (uaRows as { academy_id: string | null; is_active: boolean | null }[])
                  .filter((row) => (row.is_active ?? true) === true)
                  .map((row) => row.academy_id)
                  .filter((id): id is string => !!id)
              )
            );

            if (academyIds.length > 0) {
              setHasAcademies(true);
              const { data: acadRows, error: acadErr } = await supabase
                .from('academies')
                .select('id,name')
                .in('id', academyIds)
                .order('name');

              if (!acadErr && acadRows) {
                const options = (acadRows as { id: string; name: string | null }[]).map((a) => ({
                  id: a.id,
                  name: a.name ?? a.id,
                }));
                setAcademyOptions(options);

                let stored: string | null = null;
                if (typeof window !== 'undefined') {
                  stored = window.localStorage.getItem('selectedAcademyId');
                }
                const validIds = options.map((o) => o.id);

                const profileDefault = (profile as any)?.default_academy_id as string | null | undefined;

                let initial: string | null = null;
                if (profileDefault && validIds.includes(profileDefault)) {
                  initial = profileDefault;
                } else if (stored && validIds.includes(stored)) {
                  initial = stored;
                } else {
                  initial = validIds[0] ?? null;
                }

                const shouldShowInactiveToast =
                  !!stored && stored !== initial && inactiveAcademyIds.has(stored);

                if (shouldShowInactiveToast && typeof window !== 'undefined') {
                  toast.error('Tu usuario está inactivo en la academia seleccionada. Te cambiamos a una academia activa.');
                }

                setSelectedAcademyId(initial);
                if (initial && typeof window !== 'undefined') {
                  window.localStorage.setItem('selectedAcademyId', initial);
                }
              }
            } else {
              try {
                await supabase.auth.signOut();
              } catch {
                // ignore
              }
              setHasAcademies(false);
              setAcademyOptions([]);
              setSelectedAcademyId(null);
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('selectedAcademyId');
              }
              if (typeof window !== 'undefined') {
                window.location.href = '/login?inactive=1';
              }
            }
          }
        } catch (e) {
          console.error('Error cargando academias del usuario en Home', e);
          setHasAcademies(false);
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
      }

      // métricas de dashboard
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);

        // Esperar a que el rol esté resuelto antes de calcular métricas
        if (!role) {
          return;
        }

        if (role === 'admin' || role === 'super_admin') {
          // Dashboard para admin / super_admin (y fallback cuando aún no se cargó role)

          // Si el usuario no tiene academias asignadas (o aún no se resolvió), mostramos todo en 0
          if (hasAcademies !== true) {
            setActivePlansCount(0);
            setStudentsWithPlanCount(0);
            setTodayClassesCount(0);
            setCoachesCount(0);
            setStudentsCount(0);
            return;
          }

          // 1) Planes activos y alumnos con plan (filtrados por academia si aplica)
          let spQuery = supabase
            .from('student_plans')
            .select('student_id,plan_id,remaining_classes,academy_id')
            .gt('remaining_classes', 0);

          if (selectedAcademyId) {
            spQuery = spQuery.eq('academy_id', selectedAcademyId);
          }

          const spRes = await spQuery;
          if (spRes.error) throw spRes.error;

          const spRows = spRes.data ?? [];
          const planIds = new Set<string>();
          const studentIds = new Set<string>();
          (spRows as any[]).forEach((sp) => {
            if (sp.plan_id) planIds.add(sp.plan_id as string);
            if (sp.student_id) studentIds.add(sp.student_id as string);
          });

          setActivePlansCount(planIds.size);
          setStudentsWithPlanCount(studentIds.size);

          // 2) Clases de hoy filtradas por academia (si hay academia seleccionada)
          let todayCount = 0;
          if (selectedAcademyId && academyLocationIds.size > 0) {
            const locationIds = Array.from(academyLocationIds);
            const { count, error: clsErr } = await supabase
              .from('class_sessions')
              .select('id, courts!inner(location_id)', { count: 'exact', head: true })
              .gte('date', start.toISOString())
              .lte('date', end.toISOString())
              .neq('status', 'cancelled')
              .in('courts.location_id', locationIds);
            if (clsErr) throw clsErr;
            todayCount = count ?? 0;
          } else {
            const { count, error: clsErr } = await supabase
              .from('class_sessions')
              .select('id', { count: 'exact', head: true })
              .gte('date', start.toISOString())
              .lte('date', end.toISOString())
              .neq('status', 'cancelled');
            if (clsErr) throw clsErr;
            todayCount = count ?? 0;
          }

          setTodayClassesCount(todayCount);

          // 3) Profesores / Alumnos: contamos directamente desde user_academies por rol
          if (selectedAcademyId) {
            const [coachRes, studRes] = await Promise.all([
              supabase
                .from('user_academies')
                .select('id', { count: 'exact', head: true })
                .eq('academy_id', selectedAcademyId)
                .eq('role', 'coach'),
              supabase
                .from('user_academies')
                .select('id', { count: 'exact', head: true })
                .eq('academy_id', selectedAcademyId)
                .eq('role', 'student'),
            ]);

            if (coachRes.error) throw coachRes.error;
            if (studRes.error) throw studRes.error;

            setCoachesCount(coachRes.count ?? 0);
            setStudentsCount(studRes.count ?? 0);
          } else {
            setCoachesCount(0);
            setStudentsCount(0);
          }
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
            const hasLocationFilter = selectedAcademyId && academyLocationIds.size > 0;

            // Clases de hoy para este coach, filtradas por locations de la academia seleccionada si aplica
            let todayCount: number | null = null;
            if (hasLocationFilter) {
              const locationIds = Array.from(academyLocationIds);
              const { count, error } = await supabase
                .from('class_sessions')
                .select('id, courts!inner(location_id)', { count: 'exact', head: true })
                .eq('coach_id', coachId)
                .eq('status', 'active')
                .gte('date', start.toISOString())
                .lte('date', end.toISOString())
                .in('courts.location_id', locationIds);
              if (error) throw error;
              todayCount = count;
            } else {
              const { count, error } = await supabase
                .from('class_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('coach_id', coachId)
                .eq('status', 'active')
                .gte('date', start.toISOString())
                .lte('date', end.toISOString());
              if (error) throw error;
              todayCount = count;
            }
            setCoachTodayClasses(todayCount ?? 0);

            // Clases de esta semana (Lunes-Domingo) para este coach, filtradas por locations
            const weekStart = new Date(today);
            const dayOfWeek = weekStart.getDay(); // 0=Domingo
            const diffToMonday = (dayOfWeek + 6) % 7; // 0->6,1->0,...
            weekStart.setDate(weekStart.getDate() - diffToMonday);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            let weekCount: number | null = null;
            if (hasLocationFilter) {
              const locationIds = Array.from(academyLocationIds);
              const { count, error } = await supabase
                .from('class_sessions')
                .select('id, courts!inner(location_id)', { count: 'exact', head: true })
                .eq('coach_id', coachId)
                .eq('status', 'active')
                .gte('date', weekStart.toISOString())
                .lte('date', weekEnd.toISOString())
                .in('courts.location_id', locationIds);
              if (error) throw error;
              weekCount = count;
            } else {
              const { count, error } = await supabase
                .from('class_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('coach_id', coachId)
                .eq('status', 'active')
                .gte('date', weekStart.toISOString())
                .lte('date', weekEnd.toISOString());
              if (error) throw error;
              weekCount = count;
            }
            setCoachWeekClasses(weekCount ?? 0);

            // Alumnos activos: alumnos con reservas en clases futuras de este coach, filtradas por locations
            const futureFrom = new Date();
            const futureTo = new Date(futureFrom.getTime() + 14 * 24 * 60 * 60 * 1000);

            let futureClasses: { id: string }[] | null = null;
            if (hasLocationFilter) {
              const locationIds = Array.from(academyLocationIds);
              const { data, error } = await supabase
                .from('class_sessions')
                .select('id,date,courts!inner(location_id)')
                .eq('coach_id', coachId)
                .eq('status', 'active')
                .gte('date', futureFrom.toISOString())
                .lte('date', futureTo.toISOString())
                .in('courts.location_id', locationIds);
              if (error) throw error;
              futureClasses = data as { id: string }[] | null;
            } else {
              const { data, error } = await supabase
                .from('class_sessions')
                .select('id,date')
                .eq('coach_id', coachId)
                .eq('status', 'active')
                .gte('date', futureFrom.toISOString())
                .lte('date', futureTo.toISOString());
              if (error) throw error;
              futureClasses = data as { id: string }[] | null;
            }

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
              .select('class_id,class_sessions!inner(id,date,court_id,courts!inner(location_id))')
              .eq('student_id', studentId)
              .eq('class_sessions.status', 'active')
              .gte('class_sessions.date', nowIso);
            if (upcomingErr) throw upcomingErr;

            let upcomingCount = (upcomingData ?? []).length;
            // Si hay academia seleccionada, filtramos por sus locations
            if (selectedAcademyId && academyLocationIds.size > 0) {
              const allowedLocations = academyLocationIds;
              upcomingCount = (upcomingData ?? []).filter((row: any) => {
                const cls = (row as any).class_sessions;
                const court = cls?.courts;
                const locId = court?.location_id as string | undefined;
                return locId ? allowedLocations.has(locId) : false;
              }).length;
            }
            setStudentUpcomingClasses(upcomingCount);

            // Clases restantes del plan actual (último plan asignado)
            let spQuery = supabase
              .from('student_plans')
              .select('id, remaining_classes, purchased_at, academy_id, plans(name,classes_included)')
              .eq('student_id', studentId)
              .order('purchased_at', { ascending: false })
              .limit(1);

            if (selectedAcademyId) {
              spQuery = spQuery.eq('academy_id', selectedAcademyId);
            }

            const { data: spData, error: spErr } = await spQuery;
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
                .eq('student_id', studentId)
                .in('status', ['pending', 'confirmed']);
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

    return () => {
      active = false;
    };
  }, [supabase, role, selectedAcademyId, academyLocationIds, hasAcademies]);

  useEffect(() => {
    if (role !== 'super_admin') return;
    let active = true;
    (async () => {
      try {
        const [{ count: usersCount, error: usersErr }, { data: uaRows, error: uaErr }, { data: auditRows, error: auditErr }] =
          await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('user_academies').select('academy_id, role, is_active'),
            supabase
              .from('audit_logs')
              .select('id, created_at, action, entity, entity_id, user_id, payload')
              .order('created_at', { ascending: false })
              .limit(25),
          ]);

        if (!active) return;
        if (usersErr) throw usersErr;
        if (uaErr) throw uaErr;
        if (auditErr) throw auditErr;

        setSuperAdminTotalUsers(usersCount ?? 0);

        const nextCounts: Record<string, { admin: number; coach: number; student: number; total: number }> = {};
        for (const row of (uaRows ?? []) as any[]) {
          const academyId = row?.academy_id as string | null;
          const r = row?.role as 'admin' | 'coach' | 'student' | null;
          const isActive = (row?.is_active as boolean | null) ?? true;
          if (!academyId) continue;
          if (!isActive) continue;
          if (r !== 'admin' && r !== 'coach' && r !== 'student') continue;
          const bucket = (nextCounts[academyId] ||= { admin: 0, coach: 0, student: 0, total: 0 });
          bucket[r] += 1;
          bucket.total += 1;
        }
        setSuperAdminCountsByAcademy(nextCounts);

        setSuperAdminAudit((auditRows ?? []) as any);
      } catch {
        if (!active) return;
        setSuperAdminTotalUsers(null);
        setSuperAdminCountsByAcademy({});
        setSuperAdminAudit([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [role, supabase]);

  // Cargar locations vinculadas a la academia seleccionada (para filtrar métricas por sede)
  useEffect(() => {
    if (!selectedAcademyId) {
      setAcademyLocationIds(new Set());
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('academy_locations')
          .select('location_id')
          .eq('academy_id', selectedAcademyId);
        if (error) {
          console.error('Error cargando academy_locations en Home', error);
          setAcademyLocationIds(new Set());
          return;
        }
        const ids = new Set(
          (data as { location_id: string | null }[] | null ?? [])
            .map((row) => row.location_id)
            .filter((id): id is string => !!id)
        );
        setAcademyLocationIds(ids);
      } catch (e) {
        console.error('Error cargando academy_locations en Home', e);
        setAcademyLocationIds(new Set());
      }
    })();
  }, [selectedAcademyId, supabase]);

  // Nota: el recordatorio de instalación se maneja con el banner iOS (PwaInstallPrompt).

  const initials = (() => {
    const name = (userName ?? '').trim();
    if (!name) return '';
    const parts = name.split(' ');
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    return `${first ?? ''}${second ?? ''}`.toUpperCase();
  })();

  const roleResolved = role === 'super_admin' || role === 'admin' || role === 'coach' || role === 'student';

  const isSuperAdmin = role === 'super_admin';
  const isAdminRole = role === 'admin' || isSuperAdmin;

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

  if (isSuperAdmin && !impersonateAcademyId) {
    return (
      <>
        <SuperAdminHomeClient userEmail={userName ?? ''} />

        <PwaInstallPrompt />

        <PushPermissionPrompt />

        <FooterNav
          isAdmin={true}
          isSuperAdmin={true}
          canSeeReports={true}
          canSeeFinance={false}
          canSeeSettings={true}
          studentsLabel="Alumnos"
          scheduleBadgeCount={scheduleBadgeCount}
          rightSlot={(
            <div ref={avatarMenuRef} className="relative flex items-center">
              <FooterAvatarButton
                ref={avatarButtonRef}
                avatarUrl={avatarUrl}
                initials={initials}
                avatarOffsetX={avatarOffsetX}
                avatarOffsetY={avatarOffsetY}
                unreadBadgeText={unreadLabel}
                hasUnread={unreadCount > 0}
                isMenuOpen={avatarMenuOpen}
                onClick={() => setAvatarMenuOpen((v) => !v)}
              />
              {avatarMenuOpen && (
                <div
                  ref={avatarMenuPanelRef}
                  role="menu"
                  className="absolute bottom-12 right-0 w-48 rounded-md border bg-white shadow-lg text-xs sm:text-sm py-1.5 z-50"
                >
                  {userId && (
                    <NotificationsMenuItem userId={userId} onUnreadCountChange={setUnreadCount} />
                  )}
                  <button
                    type="button"
                    role="menuitem"
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
                    role="menuitem"
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
            </div>
          )}
        />
      </>
    );
  }

  return (
    <section
      className="space-y-6 max-w-5xl mx-auto px-4 pt-6"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {isSuperAdmin && impersonateAcademyId && (
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-amber-900 truncate">
              Modo admin activo · Academia:{' '}
              <span className="font-semibold">{impersonateAcademyName ?? impersonateAcademyId}</span>
            </div>
            <button
              type="button"
              onClick={onExitImpersonation}
              className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-amber-700"
            >
              Volver a Super Admin
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#31435d]">
            Hola {userName ?? '...'}
          </h1>
          <p className="text-sm text-gray-600">
            {effectiveRole === 'student'
              ? 'Revisá tus próximas clases y tu plan en un solo lugar.'
              : 'Gestioná tu agenda desde un solo lugar.'}
          </p>
        </div>
        <div className="flex items-center justify-end flex-1">
          <AgendoLogo />
        </div>
      </div>

      {academyOptions.length > 1 && selectedAcademyId && (
        <div className="flex items-center justify-between gap-2 text-xs text-gray-600 bg-white border border-emerald-100 rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center text-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
              Academia activa
            </span>
            <span className="font-medium text-[#0f172a]">
              {academyOptions.find((a) => a.id === selectedAcademyId)?.name ?? 'Sin academia'}
            </span>
          </div>
          <Link
            href="/settings"
            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 hover:underline whitespace-nowrap"
          >
            Cambiar en Configuración
          </Link>
        </div>
      )}

      {isAdminRole && hasAcademies === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <p>
            No tenés ninguna academia asignada. Pedí a un super admin que te asigne al menos una academia
            para ver las métricas. Mientras tanto, todos los contadores se muestran en 0.
          </p>
        </div>
      )}

      {(!role || isAdminRole) && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <AdminHomeIncomeExpensesCard />

          <motion.button
            type="button"
            whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm border border-emerald-100/60 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/60 focus:ring-offset-1"
            onClick={() => router.push('/finance')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 text-emerald-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
                  <Layers className="w-3.5 h-3.5 text-[#3cadaf]" />
                </span>
                <span>Planes activos</span>
              </div>
            </div>
            <p className="text-4xl font-bold text-[#0f172a] tracking-tight leading-tight">
              {loading ? '...' : activePlansCount}
            </p>
            <p className="text-xs text-gray-600 mt-2 max-w-xs">
              Planes que tienen al menos un alumno con clases disponibles.
            </p>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="rounded-2xl p-4 bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-sm border border-sky-100/70 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/60 focus:ring-offset-1"
            onClick={() => router.push('/schedule?scope=today')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100/80 text-sky-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
                  <CalendarDays className="w-3.5 h-3.5 text-[#3b82f6]" />
                </span>
                <span>Clases de hoy</span>
              </div>
            </div>
            <p className="text-4xl font-bold text-[#0f172a] tracking-tight leading-tight">
              {loading ? '...' : todayClassesCount}
            </p>
            <p className="text-xs text-gray-600 mt-2 max-w-xs">
              Total de clases programadas para el día de hoy.
            </p>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="rounded-2xl p-4 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm border border-amber-100/70 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f97316]/60 focus:ring-offset-1"
            onClick={() => router.push('/users')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 text-amber-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
                  <UserCog className="w-3.5 h-3.5 text-[#f97316]" />
                </span>
                <span>Profesores / Alumnos</span>
              </div>
            </div>
            <p className="text-4xl font-bold text-[#0f172a] tracking-tight leading-tight">
              {loading ? '...' : `${coachesCount} / ${studentsCount}`}
            </p>
            <p className="text-xs text-gray-600 mt-2 max-w-xs">
              Cantidad total de profesores y alumnos en la academia.
            </p>
          </motion.button>
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
                <li>
                  Tocá el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).
                </li>
                <li>
                  En el menú que se abre, tocá los <strong>tres puntitos</strong> (Más opciones).
                </li>
                <li>
                  Elegí <strong>"Agregar a inicio"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.
                </li>
                <li>
                  Confirmá con <strong>Agregar</strong>.
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-[#31435d]">Android (Chrome)</h3>
              <ol className="list-decimal list-inside text-gray-700 space-y-1 mt-1">
                <li>Abrí este enlace en Chrome.</li>
                <li>
                  Tocá el botón de <strong>tres puntos</strong> arriba a la derecha.
                </li>
                <li>
                  Elegí <strong>"Agregar a pantalla principal"</strong> o <strong>"Instalar app"</strong>.
                </li>
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

      <PwaInstallPrompt />

      <PushPermissionPrompt />

      <FooterNav
        isAdmin={isAdmin}
        isStudent={effectiveRole === 'student'}
        canSeeReports={effectiveRole === 'admin'}
        canSeeFinance={effectiveRole === 'admin'}
        canSeeSettings={effectiveRole === 'admin' || effectiveRole === 'coach' || effectiveRole === 'student'}
        studentsLabel={effectiveRole === 'student' ? 'Mi cuenta' : 'Alumnos'}
        scheduleBadgeCount={scheduleBadgeCount}
        rightSlot={(
          <div ref={avatarMenuRef} className="relative flex items-center">
            <FooterAvatarButton
              ref={avatarButtonRef}
              avatarUrl={avatarUrl}
              initials={initials}
              avatarOffsetX={avatarOffsetX}
              avatarOffsetY={avatarOffsetY}
              unreadBadgeText={unreadLabel}
              hasUnread={unreadCount > 0}
              isMenuOpen={avatarMenuOpen}
              onClick={() => setAvatarMenuOpen((v) => !v)}
            />
            {avatarMenuOpen && (
              <div
                ref={avatarMenuPanelRef}
                role="menu"
                className="absolute bottom-12 right-0 w-48 rounded-md border bg-white shadow-lg text-xs sm:text-sm py-1.5 z-50"
              >
                {userId && (
                  <NotificationsMenuItem userId={userId} onUnreadCountChange={setUnreadCount} />
                )}
                <button
                  type="button"
                  role="menuitem"
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
                  role="menuitem"
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
          </div>
        )}
      />
    </section>
  );
}
