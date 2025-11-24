"use client";

import { useEffect, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';
import { Users, UserPlus, ListChecks, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const ROLES = ['admin', 'coach', 'student'] as const;

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split('-');
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatYmd(date: Date | undefined): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return 'Seleccionar fecha';
  return date.toLocaleDateString('es-PY');
}

function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const selectedDate = parseYmd(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 h-10"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <span className={selectedDate ? '' : 'text-gray-400'}>
            {formatDisplay(selectedDate)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatYmd(date));
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

type Role = (typeof ROLES)[number];

type UserRow = {
  id: string;
  full_name: string | null;
  role: Role;
};

type UserRolesRow = {
  user_id: string;
  role: Role;
};

export default function UsersPage() {
  const supabase = createClientBrowser();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('+595');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(['student']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [userRoles, setUserRoles] = useState<UserRolesRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // UI: secciones plegables
  const [showCreateUser, setShowCreateUser] = useState(true);
  const [showUsersList, setShowUsersList] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Verificar si el usuario es admin
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setForbidden(true);
        setLoadingList(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (!profile || profile.role !== 'admin') {
        setForbidden(true);
        setLoadingList(false);
        return;
      }

      // Cargar lista de usuarios + roles
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (!active) return;

      if (profilesRes.error || rolesRes.error) {
        setError('Error cargando usuarios.');
        setLoadingList(false);
        return;
      }

      setUsers((profilesRes.data ?? []) as UserRow[]);
      setUserRoles((rolesRes.data ?? []) as UserRolesRow[]);
      setLoadingList(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  const toggleRole = (role: Role) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        const next = prev.filter((r) => r !== role);
        return next.length === 0 ? prev : next;
      }
      return [...prev, role];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          nationalId,
          phone,
          email,
          birthDate,
          roles: selectedRoles,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? 'Error creando usuario.');
        return;
      }

      setSuccess('Usuario creado correctamente.');
      setFirstName('');
      setLastName('');
      setNationalId('');
      setPhone('+595');
      setEmail('');
      setBirthDate('');
      setSelectedRoles(['student']);

      // recargar lista
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (profilesRes.error || rolesRes.error) {
        return;
      }

      setUsers((profilesRes.data ?? []) as UserRow[]);
      setUserRoles((rolesRes.data ?? []) as UserRolesRow[]);
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado.');
    } finally {
      setSubmitting(false);
    }
  };

  const rolesForUser = (userId: string): Role[] => {
    return userRoles
      .filter((r) => r.user_id === userId)
      .map((r) => r.role);
  };

  if (forbidden) {
    return (
      <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
        <div className="flex items-start gap-2">
          <Users className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Usuarios</h1>
            <p className="text-sm text-gray-600">Solo administradores pueden acceder a este módulo.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start gap-2">
        <Users className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Usuarios</h1>
          <p className="text-sm text-gray-600">
            Creá usuarios de acceso al sistema y asignales uno o varios roles.
          </p>
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowCreateUser((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-500" />
            <span>Crear y gestionar usuarios</span>
          </span>
          <span className="text-xs text-gray-500">{showCreateUser ? '▼' : '▲'}</span>
        </button>
        {showCreateUser && (
          <div className="p-4 space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Nombre</label>
              <input
                className="border rounded p-2 w-full"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Apellido</label>
              <input
                className="border rounded p-2 w-full"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">N° de cédula</label>
              <input
                className="border rounded p-2 w-full"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Esta será la contraseña inicial del usuario.
              </p>
            </div>
            <div>
              <label className="block text-sm mb-1">Teléfono (+595...)</label>
              <input
                className="border rounded p-2 w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Correo electrónico</label>
              <input
                type="email"
                className="border rounded p-2 w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Fecha de nacimiento</label>
              <DatePickerField value={birthDate} onChange={setBirthDate} />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Roles</label>
            <div className="flex flex-wrap gap-3 text-sm">
              {ROLES.map((role) => (
                <label key={role} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Podés asignar más de un rol. Si marcás "admin", el usuario tendrá acceso completo.
            </p>
          </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <button
                type="submit"
                className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 text-sm disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Creando usuario...' : 'Crear usuario'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowUsersList((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-sky-500" />
            <span>Usuarios registrados</span>
          </span>
          <span className="text-xs text-gray-500">{showUsersList ? '▼' : '▲'}</span>
        </button>
        {showUsersList && (
          <div className="p-4">
            {loadingList ? (
              <p className="text-sm text-gray-600">Cargando...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-600">Todavía no hay usuarios registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2 px-3">Nombre</th>
                      <th className="text-left py-2 px-3">Rol principal</th>
                      <th className="text-left py-2 px-3">Roles asignados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const allRoles = rolesForUser(u.id);
                      return (
                        <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50">
                          <td className="py-2 px-3 whitespace-nowrap">{u.full_name ?? '(Sin nombre)'}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{u.role}</td>
                          <td className="py-2 px-3 text-xs text-gray-700">{allRoles.join(', ') || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
