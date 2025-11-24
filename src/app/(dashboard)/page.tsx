import { requireUser } from '@/lib/auth';
import { LayoutDashboard } from 'lucide-react';

export default async function HomePage() {
  const user = await requireUser();
  return (
    <section className="mt-4 space-y-4 max-w-5xl mx-auto px-4">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-[#3cadaf]" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#31435d]">Bienvenido</h1>
          <p className="text-sm text-gray-600">Usuario: {user.email}</p>
        </div>
      </div>
    </section>
  );
}
