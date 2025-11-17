"use client";

import Link from 'next/link';
import { useState } from 'react';
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
    <div className="min-h-dvh grid grid-rows-[auto,1fr]">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold">
            Inicio
          </Link>
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
          <nav className="max-w-5xl mx-auto px-4 pb-3 flex flex-col gap-2 text-sm bg-white">
            <Link
              href="/schedule"
              onClick={() => setMenuOpen(false)}
              className="underline flex items-center gap-2"
            >
              <IconCalendar />
              <span>Agenda</span>
            </Link>
            <Link
              href="/students"
              onClick={() => setMenuOpen(false)}
              className="underline flex items-center gap-2"
            >
              <IconStudents />
              <span>Alumnos</span>
            </Link>
            <Link
              href="/finance"
              onClick={() => setMenuOpen(false)}
              className="underline flex items-center gap-2"
            >
              <IconMoney />
              <span>Finanzas</span>
            </Link>
            <Link
              href="/users"
              onClick={() => setMenuOpen(false)}
              className="underline flex items-center gap-2"
            >
              <IconUsers />
              <span>Usuarios</span>
            </Link>
            <Link
              href="/reports"
              onClick={() => setMenuOpen(false)}
              className="underline flex items-center gap-2"
            >
              <IconReport />
              <span>Reportes</span>
            </Link>
            <div className="mt-1">
              <LogoutButton />
            </div>
          </nav>
        )}
      </header>
      <main className="w-full flex justify-center px-4 py-4">
        <div className="w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
