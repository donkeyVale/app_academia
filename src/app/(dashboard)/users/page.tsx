"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';
import { formatPyg } from '@/lib/formatters';
import { Users, UserPlus, ListChecks, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';

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
          captionLayout="dropdown"
          fromYear={1950}
          toYear={new Date().getFullYear()}
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
  const [role, setRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);

  // UI: secciones plegables
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showUsersList, setShowUsersList] = useState(false);

  // Modal de detalle/edición de usuario
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSubmitting, setDetailSubmitting] = useState(false);
  const [detailDeleting, setDetailDeleting] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailFirstName, setDetailFirstName] = useState('');
  const [detailLastName, setDetailLastName] = useState('');
  const [detailNationalId, setDetailNationalId] = useState('');
  const [detailPhone, setDetailPhone] = useState('+595');
  const [detailEmail, setDetailEmail] = useState('');
  const [detailBirthDate, setDetailBirthDate] = useState('');
  const [detailRoles, setDetailRoles] = useState<Role[]>([]);
  const [detailCoachFee, setDetailCoachFee] = useState('');
  const [detailCoachFeeSaving, setDetailCoachFeeSaving] = useState(false);

  // Importación masiva desde CSV
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUploading, setImportUploading] = useState(false);
  const [importResults, setImportResults] = useState<
    { index: number; status: 'ok' | 'error'; message: string }[]
  >([]);
  const [importSummary, setImportSummary] = useState<{ total: number; ok: number; error: number } | null>(
    null,
  );

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

      setCurrentUserId(userId);

      // Academia seleccionada (multi-academia)
      let storedAcademyId: string | null = null;
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        storedAcademyId = stored && stored.trim() ? stored : null;
      }
      setSelectedAcademyId(storedAcademyId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      const currentRole = (profile?.role as string | null) ?? null;
      setRole(currentRole);
      const isAdminLike = currentRole === 'admin' || currentRole === 'super_admin';
      if (!isAdminLike) {
        setForbidden(true);
        setLoadingList(false);
        return;
      }

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

      const rawUsers = (profilesRes.data ?? []) as UserRow[];
      const rawUserRoles = (rolesRes.data ?? []) as UserRolesRow[];

      let finalUsers = rawUsers;
      let finalUserRoles = rawUserRoles;

      if (currentRole === 'admin') {
        if (!storedAcademyId) {
          finalUsers = [];
          finalUserRoles = [];
        } else {
          const { data: uaRows, error: uaErr } = await supabase
            .from('user_academies')
            .select('user_id, academy_id')
            .eq('academy_id', storedAcademyId);

          if (uaErr) {
            setError('Error cargando usuarios por academia.');
            setLoadingList(false);
            return;
          }

          const rows = (uaRows as { user_id: string | null; academy_id: string | null }[] | null) ?? [];
          const allowedUserIds = new Set(
            rows
              .map((r) => r.user_id)
              .filter((id): id is string => !!id)
          );

          finalUsers = rawUsers.filter((u) => allowedUserIds.has(u.id));
          finalUserRoles = rawUserRoles.filter((r) => allowedUserIds.has(r.user_id));
        }
      }

      setUsers(finalUsers);
      setUserRoles(finalUserRoles);
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

  const toggleDetailRole = (role: Role) => {
    setDetailRoles((prev) => {
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

    // Validaciones de campos obligatorios al crear usuario
    if (!nationalId.trim() || !phone.trim() || !email.trim() || !birthDate.trim()) {
      const message = 'Completá número de documento, teléfono, correo y fecha de nacimiento.';
      setError(message);
      toast.error(message);
      return;
    }

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
        const message = json?.error ?? 'Error creando usuario.';
        setError(message);
        toast.error(message);
        return;
      }

      setSuccess('Usuario creado correctamente.');
      toast.success('Usuario creado correctamente.');
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
      const message = err?.message ?? 'Error inesperado.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const rolesForUser = (userId: string): Role[] => {
    return userRoles
      .filter((r) => r.user_id === userId)
      .map((r) => r.role);
  };

  const parseCsvContent = (content: string) => {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return { headers: [] as string[], rows: [] as Record<string, string>[] };
    }

    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.trim());

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] ?? '').trim();
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  const handleImportCsv = async () => {
    if (!importFile) {
      toast.error('Seleccioná un archivo CSV primero.');
      return;
    }

    setImportUploading(true);
    setImportResults([]);
    setImportSummary(null);

    try {
      const fileText = await importFile.text();
      const { headers, rows } = parseCsvContent(fileText);

      const requiredHeaders = [
        'nombre',
        'apellido',
        'numero_de_documento',
        'telefono',
        'correo',
        'fecha_de_nacimiento',
        'role',
        'academias',
      ];

      const missing = requiredHeaders.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        toast.error(
          `El archivo CSV no tiene todas las columnas requeridas. Faltan: ${missing.join(', ')}.`,
        );
        setImportUploading(false);
        return;
      }

      if (rows.length === 0) {
        toast.error('El archivo CSV no tiene filas de datos.');
        setImportUploading(false);
        return;
      }

      const payloadRows = rows.map((r) => ({
        nombre: r.nombre ?? '',
        apellido: r.apellido ?? '',
        numero_de_documento: r.numero_de_documento ?? '',
        telefono: r.telefono ?? '',
        correo: r.correo ?? '',
        fecha_de_nacimiento: r.fecha_de_nacimiento ?? '',
        role: r.role ?? '',
        academias: r.academias ?? '',
      }));

      const res = await fetch('/api/admin/import-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows: payloadRows }),
      });

      const json = await res.json();

      if (!res.ok) {
        const message = json?.error ?? 'Error procesando la importación.';
        toast.error(message);
        setImportUploading(false);
        return;
      }

      const results = (json?.results ?? []) as {
        index: number;
        status: 'ok' | 'error';
        message: string;
      }[];

      setImportResults(results);

      const total = results.length;
      const ok = results.filter((r) => r.status === 'ok').length;
      const error = results.filter((r) => r.status === 'error').length;
      setImportSummary({ total, ok, error });

      if (ok > 0) {
        toast.success(`Importación finalizada. Usuarios creados: ${ok}. Errores: ${error}.`);
        await reloadUsersList();
      } else {
        toast.error('No se pudo crear ningún usuario. Revisá los errores por fila.');
      }
    } catch (e: any) {
      const message = e?.message ?? 'Error inesperado procesando el archivo.';
      toast.error(message);
    } finally {
      setImportUploading(false);
    }
  };

  const reloadUsersList = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role'),
      supabase.from('user_roles').select('user_id, role'),
    ]);

    if (profilesRes.error || rolesRes.error) {
      return;
    }

    const rawUsers = (profilesRes.data ?? []) as UserRow[];
    const rawUserRoles = (rolesRes.data ?? []) as UserRolesRow[];

    let finalUsers = rawUsers;
    let finalUserRoles = rawUserRoles;

    if (role === 'admin') {
      let selectedAcademyId: string | null = null;
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        selectedAcademyId = stored && stored.trim() ? stored : null;
      }

      if (!selectedAcademyId) {
        finalUsers = [];
        finalUserRoles = [];
      } else {
        const { data: uaRows } = await supabase
          .from('user_academies')
          .select('user_id, academy_id')
          .eq('academy_id', selectedAcademyId);

        const rows = (uaRows as { user_id: string | null; academy_id: string | null }[] | null) ?? [];
        const allowedUserIds = new Set(
          rows
            .map((r) => r.user_id)
            .filter((id): id is string => !!id)
        );

        finalUsers = rawUsers.filter((u) => allowedUserIds.has(u.id));
        finalUserRoles = rawUserRoles.filter((r) => allowedUserIds.has(r.user_id));
      }
    }

    setUsers(finalUsers);
    setUserRoles(finalUserRoles);
  };

  const openUserDetail = async (userId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailSubmitting(false);
    setDetailDeleting(false);
    setDetailCoachFee('');
    try {
      const res = await fetch('/api/admin/get-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDetailError(json?.error ?? 'No se pudo cargar el usuario.');
        return;
      }
      const u = json.user as any;
      setDetailUserId(u.id as string);
      const fullName = (u.full_name as string | null) ?? '';
      const [fn, ...rest] = fullName.split(' ');
      setDetailFirstName((u.firstName as string | null) ?? fn ?? '');
      setDetailLastName((u.lastName as string | null) ?? rest.join(' ') ?? '');
      setDetailNationalId((u.nationalId as string | null) ?? '');
      setDetailPhone(((u.metaPhone as string | null) ?? u.phone ?? '+595') || '+595');
      setDetailEmail((u.email as string | null) ?? '');
      setDetailBirthDate((u.birthDate as string | null) ?? '');
      const roles: string[] = (u.roles as string[] | undefined) ?? [];
      const validRoles = roles.filter((r) => (ROLES as readonly string[]).includes(r)) as Role[];
      setDetailRoles(validRoles.length ? validRoles : ['student']);

      // Cargar tarifa por clase si es coach y hay academia seleccionada
      if (validRoles.includes('coach') && currentUserId && selectedAcademyId) {
        try {
          const feeRes = await fetch('/api/admin/get-coach-fee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentUserId,
              userId: u.id,
              academyId: selectedAcademyId,
            }),
          });
          const feeJson = await feeRes.json();
          if (feeRes.ok) {
            const fee = feeJson?.feePerClass as number | null | undefined;
            setDetailCoachFee(fee != null ? formatPyg(fee) : '');
          } else if (feeJson?.error) {
            toast.error(feeJson.error);
          }
        } catch (e: any) {
          // Si falla la carga de tarifa, solo mostramos el error como toast
          const msg = e?.message ?? 'No se pudo cargar la tarifa del profesor.';
          toast.error(msg);
        }
      }
    } catch (e: any) {
      setDetailError(e?.message ?? 'Error inesperado cargando el usuario.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailUserId) return;
    setDetailError(null);
    setDetailSubmitting(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: detailUserId,
          firstName: detailFirstName,
          lastName: detailLastName,
          nationalId: detailNationalId,
          phone: detailPhone,
          email: detailEmail,
          birthDate: detailBirthDate,
          roles: detailRoles,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json?.error ?? 'No se pudo actualizar el usuario.';
        setDetailError(message);
        toast.error(message);
        return;
      }
      await reloadUsersList();
      setDetailOpen(false);
      toast.success('Usuario actualizado correctamente.');
    } catch (e: any) {
      const message = e?.message ?? 'Error inesperado actualizando el usuario.';
      setDetailError(message);
      toast.error(message);
    } finally {
      setDetailSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!detailUserId) return;
    const confirmDelete = window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.');
    if (!confirmDelete) return;
    setDetailError(null);
    setDetailDeleting(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: detailUserId }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json?.error ?? 'No se pudo eliminar el usuario.';
        setDetailError(message);
        toast.error(message);
        return;
      }
      await reloadUsersList();
      setDetailOpen(false);
      toast.success('Usuario eliminado correctamente.');
    } catch (e: any) {
      const message = e?.message ?? 'Error inesperado eliminando el usuario.';
      setDetailError(message);
      toast.error(message);
    } finally {
      setDetailDeleting(false);
    }
  };

  const handleUpdateCoachFee = async () => {
    if (!detailUserId || !currentUserId || !selectedAcademyId) {
      toast.error('No se puede guardar la tarifa: falta información de usuario o academia.');
      return;
    }

    const raw = detailCoachFee.replace(/[\.\s]/g, '').replace(',', '.').trim();
    if (!raw) {
      toast.error('Ingresá una tarifa por clase.');
      return;
    }

    const fee = Number(raw);
    if (!Number.isFinite(fee) || fee < 0) {
      toast.error('La tarifa por clase debe ser un número válido mayor o igual a 0.');
      return;
    }

    setDetailCoachFeeSaving(true);
    try {
      const res = await fetch('/api/admin/update-coach-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          userId: detailUserId,
          academyId: selectedAcademyId,
          feePerClass: fee,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json?.error ?? 'No se pudo guardar la tarifa del profesor.';
        toast.error(message);
        return;
      }
      toast.success('Tarifa por clase guardada correctamente.');
    } catch (e: any) {
      const message = e?.message ?? 'Error inesperado guardando la tarifa del profesor.';
      toast.error(message);
    } finally {
      setDetailCoachFeeSaving(false);
    }
  };

  const isSuperAdmin = role === 'super_admin';
  const isAdminReadOnly = role === 'admin';

  if (forbidden) {
    return (
      <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <Users className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
            <div className="space-y-0.5">
              <h1 className="text-2xl font-semibold text-[#31435d]">Usuarios</h1>
              <p className="text-sm text-gray-600">Solo administradores pueden acceder a este módulo.</p>
            </div>
          </div>
          <div className="flex items-center justify-end flex-1">
            <Link href="/" className="flex items-center">
              <div className="h-16 w-32 relative">
                <Image
                  src="/icons/logoHome.png"
                  alt="Agendo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Users className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Usuarios</h1>
            {isSuperAdmin ? (
              <p className="text-sm text-gray-600">
                Creá usuarios de acceso al sistema y asignales uno o varios roles.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Como admin podés consultar usuarios de tu academia. Solo el super admin puede crear o editar.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end flex-1">
          <Link href="/" className="flex items-center">
            <div className="h-16 w-32 relative">
              <Image
                src="/icons/logoHome.png"
                alt="Agendo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>
        </div>
      </div>

      {isSuperAdmin && (
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
                      className="border rounded px-3 w-full h-10 text-base md:text-sm"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Apellido</label>
                    <input
                      className="border rounded px-3 w-full h-10 text-base md:text-sm"
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
                      className="border rounded px-3 w-full h-10 text-base md:text-sm"
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
                      className="border rounded px-3 w-full h-10 text-base md:text-sm"
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
                      type="text"
                      inputMode="email"
                      autoComplete="email"
                      className="border rounded px-3 w-full h-10 text-base md:text-sm"
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

                <button
                  type="submit"
                  className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 text-sm disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Creando usuario...' : 'Crear usuario'}
                </button>
              </form>

              <div className="mt-6 border-t pt-4 space-y-3 max-w-xl">
                <h3 className="text-sm font-semibold text-[#31435d] flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-500" />
                  Importar usuarios desde CSV
                </h3>
                <p className="text-xs text-gray-600">
                  Subí un archivo CSV exportado desde Google Sheets con los siguientes encabezados en la primera
                  fila: <strong>nombre</strong>, <strong>apellido</strong>, <strong>numero_de_documento</strong>,{' '}
                  <strong>telefono</strong>, <strong>correo</strong>, <strong>fecha_de_nacimiento</strong>,{' '}
                  <strong>role</strong>, <strong>academias</strong>.
                </p>
                <p className="text-xs text-gray-600">
                  La fecha debe estar en formato <strong>DD/MM/YYYY</strong>. El campo{' '}
                  <strong>academias</strong> acepta uno o varios IDs de academia separados por punto y coma (;).
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-start">
                  <div className="flex flex-col gap-1">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setImportFile(file);
                      }}
                      className="hidden"
                      id="import-users-csv-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs flex items-center gap-2"
                      onClick={() => {
                        const input = document.getElementById('import-users-csv-input') as HTMLInputElement | null;
                        input?.click();
                      }}
                    >
                      Seleccionar archivo CSV
                    </Button>
                    <span className="text-[11px] text-gray-600 break-all">
                      {importFile ? `Archivo seleccionado: ${importFile.name}` : 'Ningún archivo seleccionado'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 bg-sky-500 hover:bg-sky-600 text-white text-xs disabled:opacity-50"
                    disabled={importUploading || !importFile}
                    onClick={handleImportCsv}
                  >
                    {importUploading ? 'Procesando archivo...' : 'Procesar archivo'}
                  </Button>
                </div>

                {(importSummary || importResults.length > 0) && (
                  <div className="flex items-center justify-between gap-3 text-xs text-gray-700">
                    {importSummary && (
                      <p>
                        Total filas procesadas: <strong>{importSummary.total}</strong>. Usuarios creados:{' '}
                        <strong>{importSummary.ok}</strong>. Errores: <strong>{importSummary.error}</strong>.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] ml-auto flex items-center gap-1"
                      onClick={() => {
                        setImportResults([]);
                        setImportSummary(null);
                        setImportFile(null);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpiar resultados
                    </Button>
                  </div>
                )}

                {importResults.length > 0 && (
                  <div className="max-h-64 overflow-auto border rounded mt-2">
                    <table className="min-w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left py-1 px-2">Fila</th>
                          <th className="text-left py-1 px-2">Estado</th>
                          <th className="text-left py-1 px-2">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.map((r) => (
                          <tr key={r.index} className="border-b last:border-b-0">
                            <td className="py-1 px-2 whitespace-nowrap">{r.index + 2}</td>
                            <td className="py-1 px-2 whitespace-nowrap">
                              {r.status === 'ok' ? (
                                <span className="text-emerald-600 font-medium">OK</span>
                              ) : (
                                <span className="text-red-600 font-medium">Error</span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-gray-700">{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
                        <tr
                          key={u.id}
                          className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                          onClick={() => openUserDetail(u.id)}
                        >
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

      {detailOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <h2 className="text-lg font-semibold text-[#31435d]">Detalle de usuario</h2>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setDetailOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="px-4 py-3 overflow-y-auto text-sm space-y-3">
              {detailLoading ? (
                <p className="text-sm text-gray-600">Cargando usuario...</p>
              ) : (
                <form
                  onSubmit={isAdminReadOnly ? (e) => e.preventDefault() : handleUpdateUser}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Nombre</label>
                      <input
                        className="border rounded px-3 w-full h-10 text-base md:text-sm"
                        value={detailFirstName}
                        onChange={(e) => setDetailFirstName(e.target.value)}
                        required
                        disabled={isAdminReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Apellido</label>
                      <input
                        className="border rounded px-3 w-full h-10 text-base md:text-sm"
                        value={detailLastName}
                        onChange={(e) => setDetailLastName(e.target.value)}
                        required
                        disabled={isAdminReadOnly}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">N° de cédula</label>
                      <input
                        className="border rounded px-3 w-full h-10 text-base md:text-sm"
                        value={detailNationalId}
                        onChange={(e) => setDetailNationalId(e.target.value)}
                        required
                        disabled={isAdminReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Teléfono (+595...)</label>
                      <input
                        className="border rounded px-3 w-full h-10 text-base md:text-sm"
                        value={detailPhone}
                        onChange={(e) => setDetailPhone(e.target.value)}
                        required
                        disabled={isAdminReadOnly}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Correo electrónico</label>
                      <input
                        type="text"
                        inputMode="email"
                        autoComplete="email"
                        className="border rounded px-3 w-full h-10 text-base md:text-sm"
                        value={detailEmail}
                        onChange={(e) => setDetailEmail(e.target.value)}
                        required
                        disabled={isAdminReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Fecha de nacimiento</label>
                      <DatePickerField value={detailBirthDate} onChange={setDetailBirthDate} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Roles</label>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {ROLES.map((role) => (
                        <label key={role} className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={detailRoles.includes(role)}
                            onChange={() => toggleDetailRole(role)}
                            disabled={isAdminReadOnly}
                          />
                          <span>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {detailRoles.includes('coach') && (
                    <div>
                      <label className="block text-sm mb-1">
                        Tarifa por clase (Gs) – academia actual
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="border rounded px-3 w-full h-10 text-base md:text-sm"
                          value={detailCoachFee}
                          onChange={(e) => setDetailCoachFee(e.target.value)}
                          onBlur={() => {
                            const clean = detailCoachFee.replace(/[^0-9]/g, '');
                            if (!clean) {
                              setDetailCoachFee('');
                              return;
                            }
                            const num = Number(clean);
                            if (!Number.isFinite(num) || num < 0) return;
                            setDetailCoachFee(formatPyg(num));
                          }}
                        />
                        <button
                          type="button"
                          className="px-3 py-2 bg-[#3cadaf] hover:bg-[#31435d] text-white rounded text-xs disabled:opacity-50"
                          onClick={handleUpdateCoachFee}
                          disabled={detailCoachFeeSaving}
                        >
                          {detailCoachFeeSaving ? 'Guardando…' : 'Guardar tarifa'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Esta tarifa se aplica por cada clase/hora impartida por este profesor en la academia
                        seleccionada.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center gap-2 pt-2 border-t mt-2">
                    {isAdminReadOnly ? (
                      <p className="text-xs text-gray-600">
                        Solo el super administrador puede editar o eliminar usuarios.
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="px-3 py-2 border rounded text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={handleDeleteUser}
                          disabled={detailDeleting || detailSubmitting}
                        >
                          {detailDeleting ? 'Eliminando...' : 'Eliminar usuario'}
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-2 bg-[#3cadaf] hover:bg-[#31435d] text-white rounded text-xs disabled:opacity-50"
                          disabled={detailSubmitting || detailDeleting}
                        >
                          {detailSubmitting ? 'Guardando cambios...' : 'Guardar cambios'}
                        </button>
                      </>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
