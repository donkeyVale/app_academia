"use client";

import Link from 'next/link';
import { useState } from 'react';
import LogoutButton from '@/components/LogoutButton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh grid grid-rows-[auto,1fr]">
      <header className="border-b">
        <div className="container mx-auto p-4 flex items-center justify-between gap-4">
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
          <nav className="container mx-auto px-4 pb-3 flex flex-col gap-2 text-sm bg-white">
            <Link href="/schedule" onClick={() => setMenuOpen(false)} className="underline">
              Agenda
            </Link>
            <Link href="/students" onClick={() => setMenuOpen(false)} className="underline">
              Alumnos
            </Link>
            <Link href="/finance" onClick={() => setMenuOpen(false)} className="underline">
              Finanzas
            </Link>
            <Link href="/users" onClick={() => setMenuOpen(false)} className="underline">
              Usuarios
            </Link>
            <Link href="/reports" onClick={() => setMenuOpen(false)} className="underline">
              Reportes
            </Link>
            <div className="mt-1">
              <LogoutButton />
            </div>
          </nav>
        )}
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
