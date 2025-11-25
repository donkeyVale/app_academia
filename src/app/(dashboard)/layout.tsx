"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Users, CreditCard, UserCog, BarChart3, LogOut, UserCircle2, Smartphone } from 'lucide-react';
import { createClientBrowser } from '@/lib/supabase';

const iconColor = '#3cadaf';

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    <div className="min-h-dvh bg-gray-50 pb-16">
      <main className="w-full flex justify-center px-4 py-3 overflow-x-hidden">
        <div className="w-full max-w-5xl">{children}</div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex-1 flex items-center gap-3 text-xs sm:text-sm overflow-x-auto">
            <Link
              href="/schedule"
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              <CalendarDays className="w-4 h-4 text-[#3b82f6]" />
              <span>Agenda</span>
            </Link>
            <Link
              href="/students"
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              <Users className="w-4 h-4 text-[#22c55e]" />
              <span>Alumnos</span>
            </Link>
            <Link
              href="/finance"
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              <CreditCard className="w-4 h-4 text-[#3cadaf]" />
              <span>Finanzas</span>
            </Link>
            {isAdmin && (
              <Link
                href="/users"
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <UserCog className="w-4 h-4 text-[#f97316]" />
                <span>Usuarios</span>
              </Link>
            )}
            <Link
              href="/reports"
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              <BarChart3 className="w-4 h-4 text-[#6366f1]" />
              <span>Reportes</span>
            </Link>
          </div>

          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((v) => !v)}
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gray-200 flex items-center justify-center text-xs sm:text-sm font-medium text-gray-700 overflow-visible hover:ring-2 hover:ring-[#3cadaf]"
              aria-label="Abrir menú de usuario"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full rounded-full object-cover"
                  style={{ transform: `translate(${avatarOffsetX}%, ${avatarOffsetY - 6}%) scale(1.3)` }}
                />
              ) : initials ? (
                <span
                  className="text-base sm:text-lg inline-block"
                  style={{ transform: `translate(${avatarOffsetX}%, ${avatarOffsetY - 6}%) scale(1.3)` }}
                >
                  {initials}
                </span>
              ) : (
                <UserCircle2
                  className="w-6 h-6 text-gray-500"
                  style={{ transform: `translate(${avatarOffsetX}%, ${avatarOffsetY - 6}%) scale(1.3)` }}
                />
              )}
            </button>

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
          </div>
        </div>
      </nav>
    </div>
  );
}
