'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';
import Link from 'next/link';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/ui/password-input';

export default function RegisterPage() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [mode, setMode] = useState<'manual' | 'oauth'>('manual');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('+595');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const onRegisterManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!firstName.trim() || !lastName.trim() || !nationalId.trim() || !phone.trim() || !birthDate.trim() || !email.trim() || !password.trim()) {
      toast.error('Completá todos los campos obligatorios.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            national_id: nationalId,
            phone,
            birth_date: birthDate,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Si hay sesión, podemos completar el perfil y enviar el correo de bienvenida.
      // Si no, el usuario deberá confirmar el email y luego completar (se le pedirá al entrar).
      if (data.session) {
        const res = await fetch('/api/auth/complete-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName,
            lastName,
            nationalId,
            phone,
            birthDate,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json?.error ?? 'No se pudo completar el perfil.');
          return;
        }
      }

      toast.success('Registro iniciado. Revisá tu correo para continuar.');
      window.location.href = '/login';
    } catch (err: any) {
      toast.error(err?.message ?? 'No se pudo registrar.');
    } finally {
      setLoading(false);
    }
  };

  const onRegisterGoogle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        },
      });
      if (error) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onMagicLink = async () => {
    if (magicLinkLoading) return;
    if (!email.trim()) {
      toast.error('Ingresá tu correo para enviarte el link.');
      return;
    }
    setMagicLinkLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Te enviamos un link a tu correo.');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1d3b4f] to-[#3cadaf] px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-white/30 overflow-hidden">
        <div className="p-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
            <Image src="/icons/LogoAgendo1024.png" alt="Agendo" width={64} height={64} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-slate-600">Elegí cómo querés registrarte</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`h-10 rounded-md text-sm font-medium border ${mode === 'manual' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}
              onClick={() => setMode('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              className={`h-10 rounded-md text-sm font-medium border ${mode === 'oauth' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}
              onClick={() => setMode('oauth')}
            >
              Google / Link
            </button>
          </div>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={onRegisterManual} className="px-6 pb-6 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Nombre *</label>
                <input className="w-full h-10 border rounded-md px-3 text-sm" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Apellido *</label>
                <input className="w-full h-10 border rounded-md px-3 text-sm" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Cédula / Documento *</label>
                <input className="w-full h-10 border rounded-md px-3 text-sm" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Teléfono *</label>
                <input className="w-full h-10 border rounded-md px-3 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Fecha de nacimiento *</label>
              <input type="date" className="w-full h-10 border rounded-md px-3 text-sm" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Correo *</label>
              <input type="email" className="w-full h-10 border rounded-md px-3 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Contraseña *</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-md bg-[#3cadaf] hover:bg-[#31435d] text-white font-semibold disabled:opacity-60"
            >
              {loading ? 'Creando...' : 'Registrarme'}
            </button>

            <p className="text-xs text-slate-600 text-center">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="text-slate-900 font-semibold underline underline-offset-2">
                Iniciar sesión
              </Link>
            </p>
          </form>
        ) : (
          <div className="px-6 pb-6 space-y-3">
            <button
              type="button"
              onClick={onRegisterGoogle}
              disabled={loading}
              className="w-full h-11 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-semibold disabled:opacity-60"
            >
              Continuar con Google
            </button>

            <div className="border-t pt-3">
              <label className="block text-xs text-slate-600 mb-1">Correo</label>
              <input type="email" className="w-full h-10 border rounded-md px-3 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button
                type="button"
                onClick={onMagicLink}
                disabled={magicLinkLoading}
                className="mt-2 w-full h-11 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold disabled:opacity-60"
              >
                {magicLinkLoading ? 'Enviando...' : 'Enviar link mágico'}
              </button>
            </div>

            <p className="text-xs text-slate-600 text-center">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="text-slate-900 font-semibold underline underline-offset-2">
                Iniciar sesión
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
