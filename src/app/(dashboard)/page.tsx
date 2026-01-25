import { requireUser } from '@/lib/auth';
import { createClientServer } from '@/lib/supabase-server';
import { LayoutDashboard } from 'lucide-react';
import AdminHomeIncomeExpensesCard from './AdminHomeIncomeExpensesCard';
import SuperAdminHomeClient from './SuperAdminHomeClient';

export default async function HomePage() {
  const user = await requireUser();

  const supabase = createClientServer();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile?.role as string | null) ?? null;

  if (role === 'super_admin') {
    return <SuperAdminHomeClient userEmail={user.email ?? ''} />;
  }

  return (
    <section className="mt-4 space-y-4 max-w-5xl mx-auto px-4">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-[#3cadaf]" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#31435d]">Bienvenido</h1>
          <p className="text-sm text-gray-600">Usuario: {user.email}</p>
        </div>
      </div>

      {/* Resumen rápido de ingresos/egresos para admins (últimos 30 días, multi-academia) */}
      <AdminHomeIncomeExpensesCard />
    </section>
  );
}
