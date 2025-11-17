import { requireUser } from '@/lib/auth';

const iconColor = '#3cadaf';

const IconStudents = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-5 h-5"
  >
    <circle cx="9" cy="8" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <circle cx="17" cy="9" r="2.5" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M4 18c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke={iconColor} strokeWidth="1.6" fill="none" />
    <path d="M14 18c.3-1.6 1.7-3 3.5-3S21 16.4 21 18" stroke={iconColor} strokeWidth="1.6" fill="none" />
  </svg>
);

export default async function StudentsPage() {
  await requireUser();
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <IconStudents />
        <h1 className="text-2xl font-semibold text-[#31435d]">Alumnos</h1>
      </div>
      <p className="text-sm text-gray-600">Listado y gestión de alumnos (pendiente DB).</p>
    </section>
  );
}
