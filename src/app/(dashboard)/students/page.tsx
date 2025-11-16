import { requireUser } from '@/lib/auth';

export default async function StudentsPage() {
  await requireUser();
  return (
    <section>
      <h1 className="text-2xl font-semibold">Alumnos</h1>
      <p>Listado y gestión de alumnos (pendiente DB).</p>
    </section>
  );
}
