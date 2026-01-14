"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Users, CreditCard, UserCog, BarChart3, LogOut, UserCircle2, Smartphone } from 'lucide-react';
import { createClientBrowser } from '@/lib/supabase';
import { FooterAvatarButton } from '@/components/footer-avatar-button';
import { FooterNav } from '@/components/footer-nav';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { PushPermissionPrompt } from '@/components/push-permission-prompt';
import { NotificationsMenuItem } from '@/components/notifications-menu-item';
import { oneSignalLogout } from '@/lib/capacitor-onesignal';

const iconColor = '#3cadaf';

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
    <path d="21 19c0-2.2-2.2-4-5-4" stroke={iconColor} strokeWidth="1.6" fill="none" />
  </svg>
);

type AppRole = 'super_admin' | 'admin' | 'coach' | 'student' | null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const avatarMenuPanelRef = useRef<HTMLDivElement | null>(null);

  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AppRole>(null);
  const [academyOptions, setAcademyOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scheduleBadgeCount, setScheduleBadgeCount] = useState(0);
  const [scheduleBadgeTick, setScheduleBadgeTick] = useState<number>(() => Date.now());

  useEffect(() => {
    // Al iniciar sesión, Supabase puede hidratar la sesión async; esto asegura que
    // el userId (y por ende el badge) se setee apenas la sesión esté disponible.
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
    const onRefresh = () => setScheduleBadgeTick(Date.now());
    window.addEventListener('scheduleBadgeRefresh', onRefresh);
    return () => window.removeEventListener('scheduleBadgeRefresh', onRefresh);
  }, []);

  useEffect(() => {
    if (!userId) {
      setScheduleBadgeCount(0);
      return;
    }
    if (!selectedAcademyId) {
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

        // Alumno: contar reservas futuras del alumno
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
            .in('court_id', courtIds);
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

        // Profesor: contar clases futuras del coach
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
            .in('court_id', courtIds);
          if (cErr) throw cErr;
          setScheduleBadgeCount(count ?? 0);
          return;
        }

        // Admin/Super admin: contar clases futuras de la academia (por sedes)
        const { count, error: csErr } = await supabase
          .from('class_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('date', fromIso)
          .lte('date', toIso)
          .in('court_id', courtIds);
        if (csErr) throw csErr;
        setScheduleBadgeCount(count ?? 0);
      } catch (e) {
        setScheduleBadgeCount(0);
      }
    };

    loadScheduleBadgeCount();
  }, [supabase, userId, selectedAcademyId, role, scheduleBadgeTick]);

  useEffect(() => {
    async function setupPush() {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        return;
      }

      if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
        return;
      }

      // iOS/Safari suele bloquear el prompt si no hay interacción del usuario.
      // La solicitud de permiso se hace desde PushPermissionPrompt (botón).
      if (Notification.permission !== 'granted') {
        return;
      }

      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id as string | undefined;
        if (!userId) return;
        setUserId(userId);

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
      .channel(`notifications-count:${userId}`)
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

      // Si el usuario interactúa con el popover (Radix portal), no cerrar el menú
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
    if (typeof window === 'undefined') return;

    const onAcademyChanged = (e: Event) => {
      const next = (e as CustomEvent<{ academyId?: string | null }>).detail?.academyId ?? null;
      setSelectedAcademyId(next);
    };

    window.addEventListener('selectedAcademyIdChanged', onAcademyChanged);
    return () => {
      window.removeEventListener('selectedAcademyIdChanged', onAcademyChanged);
    };
  }, []);

  useEffect(() => {
    if (!avatarMenuOpen) return;

    // Focus al primer item del menú para teclado
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
      if (userId) setUserId(userId);
      if (userId && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('currentUserId', userId);
          window.dispatchEvent(new CustomEvent('currentUserIdChanged', { detail: { userId } }));
        } catch {
          // ignore
        }
      }

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
        const r = (profile?.role as AppRole) ?? null;
        const isSuperAdmin = r === 'super_admin';
        setIsAdmin(r === 'admin' || isSuperAdmin);
        if (r === 'super_admin' || r === 'admin' || r === 'coach' || r === 'student') {
          setRole(r);
        } else {
          setRole(null);
        }
        if (typeof window !== 'undefined') {
          try {
            const nextRole = r && (r === 'super_admin' || r === 'admin' || r === 'coach' || r === 'student') ? r : '';
            if (nextRole) {
              window.localStorage.setItem('currentUserRole', nextRole);
            } else {
              window.localStorage.removeItem('currentUserRole');
            }
            window.dispatchEvent(new CustomEvent('currentUserRoleChanged', { detail: { role: nextRole || null } }));
          } catch {
            // ignore
          }
        }

        // Cargar academias asignadas al usuario (para selector de academia actual)
        try {
          const { data: uaRows, error: uaErr } = await supabase
            .from('user_academies')
            .select('academy_id')
            .eq('user_id', userId);

          if (!uaErr && uaRows) {
            const academyIds = Array.from(
              new Set(
                (uaRows as { academy_id: string | null }[])
                  .map((row) => row.academy_id)
                  .filter((id): id is string => !!id)
              )
            );

            if (academyIds.length > 0) {
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

                // Determinar academia seleccionada (localStorage o primera)
                let stored: string | null = null;
                if (typeof window !== 'undefined') {
                  stored = window.localStorage.getItem('selectedAcademyId');
                }
                const validIds = options.map((o) => o.id);
                const initial = stored && validIds.includes(stored) ? stored : validIds[0] ?? null;
                setSelectedAcademyId(initial);
                if (initial && typeof window !== 'undefined') {
                  window.localStorage.setItem('selectedAcademyId', initial);
                  window.dispatchEvent(new CustomEvent('selectedAcademyIdChanged', { detail: { academyId: initial } }));
                }
              }
            } else {
              setAcademyOptions([]);
              setSelectedAcademyId(null);
            }
          }
        } catch {
          // si falla, dejamos academyOptions vacío y seguimos
          setAcademyOptions([]);
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
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  const initials = (() => {
    const name = (userName ?? '').trim();
    if (!name) return '';
    const parts = name.split(' ');
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    return `${first ?? ''}${second ?? ''}`.toUpperCase();
  })();

  return (
    <div
      className="min-h-dvh bg-gray-50"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <main className="w-full flex justify-center px-4 py-3 overflow-x-hidden">
        <div className="w-full max-w-5xl">{children}</div>
      </main>

      <PwaInstallPrompt />

      <PushPermissionPrompt />

      <FooterNav
        isAdmin={isAdmin}
        canSeeReports={role === 'admin' || role === 'super_admin'}
        canSeeFinance={role === 'admin' || role === 'super_admin'}
        canSeeSettings={role === 'admin' || role === 'coach' || role === 'student' || role === 'super_admin'}
        studentsLabel={role === 'student' ? 'Mi cuenta' : 'Alumnos'}
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
                  <NotificationsMenuItem
                    userId={userId}
                    onUnreadCountChange={setUnreadCount}
                  />
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
    </div>
  );
}
