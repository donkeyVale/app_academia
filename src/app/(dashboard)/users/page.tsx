"use client";

import { useEffect, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';

const ROLES = ['admin', 'coach', 'student'] as const;
const iconColor = "#3cadaf";

const IconUsers = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-5 h-5"
    {...props}
  >
    <circle cx="8" cy="9" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <circle cx="16" cy="9" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M3 19c0-2.2 2.2-4 5-4" stroke={iconColor} strokeWidth="1.6" fill="none" />
    <path d="M21 19c0-2.2-2.2-4-5-4" stroke={iconColor} strokeWidth="1.6" fill="none" />
  </svg>
);

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
      <section className="w-full max-w-5xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-semibold text-[#31435d]">Usuarios</h1>
        <p className="text-sm text-red-600">Solo administradores pueden acceder a este módulo.</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <IconUsers />
          <h1 className="text-2xl font-semibold text-[#31435d]">Usuarios</h1>
        </div>
        <p className="text-sm text-gray-600">
          Creá usuarios de acceso al sistema y asignales uno o varios roles.
        </p>
      </div>

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-semibold bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowCreateUser((v) => !v)}
        >
          <span>Crear usuario</span>
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
              <input
                type="date"
                className="border rounded p-2 w-full"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
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
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-semibold bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowUsersList((v) => !v)}
        >
          <span>Usuarios registrados</span>
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
