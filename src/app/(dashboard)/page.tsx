import { requireUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await requireUser();
  return (
    <section>
      <h1 className="text-2xl font-semibold">Bienvenido</h1>
      <p className="text-sm text-gray-600">Usuario: {user.email}</p>
    </section>
  );
}
