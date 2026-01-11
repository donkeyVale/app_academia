export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  if (role === 'student') return 'Alumno';
  if (role === 'coach') return 'Profesor';
  if (role === 'admin') return 'Admin';
  if (role === 'super_admin') return 'Super admin';
  return role;
}
