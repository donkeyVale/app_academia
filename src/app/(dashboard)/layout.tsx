import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid grid-rows-[auto,1fr]">
      <header className="border-b">
        <nav className="container mx-auto flex gap-4 p-4 items-center">
          <Link href="/">Inicio</Link>
          <Link href="/schedule">Agenda</Link>
          <Link href="/students">Alumnos</Link>
          <Link href="/finance">Finanzas</Link>
          <LogoutButton />
        </nav>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
