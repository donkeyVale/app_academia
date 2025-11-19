'use client';

import Image from 'next/image';
import { useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';

export default function LoginPage() {
  const supabase = createClientBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else window.location.href = '/';
    setLoading(false);
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
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-white/10 border border-white/30 flex items-center justify-center overflow-hidden">
            <Image
              src="/icons/LogoAgendo1024.png"
              alt="Icono de la app"
              width={64}
              height={64}
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
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf]"
              placeholder="nombre@tuacademia.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Contraseña</label>
            <input
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf]"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <button
            className="w-full bg-[#3cadaf] hover:bg-[#31435d] text-white py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p className="text-[11px] text-gray-400 text-center mt-2">
            Si no tenés acceso, solicitá un usuario a tu administrador.
          </p>
        </form>

        <div className="mt-6 text-[11px] text-white/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Diseñado por</span>
            <div className="h-10 w-auto flex items-center">
              <Image
                src="/icons/AlvicLogo.png"
                alt="Alvic"
                width={144}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Desarrollado por</span>
            <div className="h-10 w-auto flex items-center">
              <Image
                src="/icons/NativaLogo.png"
                alt="Nativa"
                width={144}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
