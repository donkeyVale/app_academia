'use client';

import Image from 'next/image';
import { useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';
import { PasswordInput } from '@/components/ui/password-input';

export default function LoginPage() {
  const supabase = createClientBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else window.location.href = '/';
    setLoading(false);
  };

  const onForgotPassword = async () => {
    if (!email) {
      setError('Ingresá tu correo para restablecer la contraseña.');
      return;
    }

    setError(null);
    setInfo(null);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/(auth)/login`,
      });
      setInfo('Te enviamos un correo para restablecer tu contraseña. Revisá tu bandeja de entrada.');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo enviar el correo de restablecimiento.');
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1d3b4f] to-[#3cadaf] relative overflow-hidden p-6">
      {/* Capa decorativa con blur para darle movimiento al fondo */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-32 -left-24 h-64 w-64 rounded-full bg-[#3cadaf] blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-72 w-72 rounded-full bg-[#22c55e] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 h-24 w-24 rounded-full bg-white/10 border border-white/30 flex items-center justify-center overflow-hidden">
            <Image
              src="/icons/LogoAgendo1024.png"
              alt="Icono de la app"
              width={120}
              height={120}
              className="object-cover"
            />
          </div>
          <p className="text-sm text-white/80">
            Gestioná tu agenda en un solo lugar.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="w-full space-y-4 rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm"
        >
          <h2 className="text-lg font-semibold text-[#31435d] mb-1">Iniciar sesión</h2>
          <p className="text-xs text-gray-500 mb-2">
            Ingresá con tu correo y contraseña para acceder al panel.
          </p>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Correo electrónico</label>
            <input
              className="w-full border border-gray-200 rounded-md px-3 h-10 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf]"
              placeholder="nombre@tuacademia.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Contraseña</label>
            <PasswordInput
              className="w-full border border-gray-200 rounded-md px-3 h-10 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[11px] text-[#3cadaf] hover:text-[#31435d] underline-offset-2 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
          {info && !error && <p className="text-emerald-600 text-xs mt-1">{info}</p>}

          <button
            className="w-full bg-[#3cadaf] hover:bg-[#31435d] text-white h-10 rounded-md text-base md:text-sm font-medium disabled:opacity-50 transition-colors"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p className="text-[11px] text-gray-400 text-center mt-2">
            Si no tenés acceso, solicitá un usuario a tu administrador.
          </p>
        </form>

        <div className="mt-6 flex flex-row items-center justify-center gap-4">
          <div className="h-24 w-1/2 flex items-center justify-center">
            <Image
              src="/icons/AlvicLogo.png"
              alt="Alvic"
              width={256}
              height={96}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="h-24 w-1/2 flex items-center justify-center">
            <Image
              src="/icons/NativaLogo.png"
              alt="Nativa"
              width={256}
              height={96}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
