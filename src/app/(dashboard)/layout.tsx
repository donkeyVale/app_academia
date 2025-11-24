"use client";

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, CalendarDays, Users, CreditCard, UserCog, BarChart3, LogOut } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh grid grid-rows-[auto,1fr] bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="font-semibold text-[#31435d]">
            Inicio
          </Link>
          <button
            type="button"
            className="flex items-center justify-center rounded-full border border-gray-300 bg-white px-2.5 py-2 text-xs shadow-sm transition-all hover:border-[#3cadaf]/70 hover:shadow-md"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Cerrar menú principal' : 'Abrir menú principal'}
          >
            {menuOpen ? (
              <X className="h-4 w-4 text-[#31435d]" />
            ) : (
              <Menu className="h-4 w-4 text-[#31435d]" />
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {menuOpen && (
            <motion.nav
              key="dashboard-main-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="mx-auto mt-1 flex w-full max-w-[220px] origin-top-right flex-col gap-1 rounded-xl border border-[#dbeafe] bg-[#f1f5f9] px-3 py-2 text-sm shadow-md"
            >
              <p className="px-3 pb-1 text-[11px] uppercase tracking-wide text-gray-400">
                Navegación rápida
              </p>
              <Link
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                href="/schedule"
                onClick={() => setMenuOpen(false)}
              >
                <CalendarDays className="h-4 w-4 text-[#3b82f6]" />
                <span>Agenda</span>
              </Link>
              <Link
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                href="/students"
                onClick={() => setMenuOpen(false)}
              >
                <Users className="h-4 w-4 text-[#22c55e]" />
                <span>Alumnos</span>
              </Link>
              <Link
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                href="/finance"
                onClick={() => setMenuOpen(false)}
              >
                <CreditCard className="h-4 w-4 text-[#3cadaf]" />
                <span>Finanzas</span>
              </Link>
              <Link
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                href="/users"
                onClick={() => setMenuOpen(false)}
              >
                <UserCog className="h-4 w-4 text-[#f97316]" />
                <span>Usuarios</span>
              </Link>
              <Link
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                href="/reports"
                onClick={() => setMenuOpen(false)}
              >
                <BarChart3 className="h-4 w-4 text-[#6366f1]" />
                <span>Reportes</span>
              </Link>
              <div className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4" />
                <LogoutButton />
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <main className="w-full flex justify-center px-4 py-3">
        <div className="w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
