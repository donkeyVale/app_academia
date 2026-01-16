'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createClientBrowser, createClientBrowserJs } from '@/lib/supabase';
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from 'sonner';
import { oneSignalLoginExternalUserId } from '@/lib/capacitor-onesignal';
import {
  biometricAuthenticateDetailed,
  checkBiometryAvailable,
  clearBiometricSession,
  isBiometricEnabled,
  loadBiometricSession,
  storeBiometricSession,
} from '@/lib/capacitor-biometrics';

export default function LoginPage() {
  const supabase = createClientBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [hasBiometricSession, setHasBiometricSession] = useState(false);
  const [biometricMode, setBiometricMode] = useState<'biometric' | 'device_credential'>('biometric');
  const [error, setError] = useState<string | null>(null);
  const inactiveMsg = 'Tu usuario está inactivo en todas tus academias. Comunicate con el administrador.';
  const getInactiveInfoFromUrl = () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('inactive') === '1' ? inactiveMsg : null;
  };
  const [info, setInfo] = useState<string | null>(() => getInactiveInfoFromUrl());

  useEffect(() => {
    const msg = getInactiveInfoFromUrl();
    if (msg) toast.error(msg);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshBiometrics = async () => {
      const enabled = isBiometricEnabled();
      if (cancelled) return;
      setBiometricEnabledState(enabled);
      if (!enabled) {
        setBiometricAvailable(false);
        setHasBiometricSession(false);
        return;
      }

      const avail = await checkBiometryAvailable();
      if (cancelled) return;
      setBiometricAvailable(!!avail.isAvailable);
      setBiometricMode(avail.reason === 'device_credential' ? 'device_credential' : 'biometric');
      if (!avail.isAvailable) {
        setHasBiometricSession(false);
        return;
      }
      const stored = await loadBiometricSession();
      if (cancelled) return;
      setHasBiometricSession(!!stored);
    };

    const onFocus = () => {
      void refreshBiometrics();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshBiometrics();
      }
    };

    void refreshBiometrics();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const finishLoginRedirect = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = (data?.user?.id as string | undefined) ?? '';
      if (userId) await oneSignalLoginExternalUserId(userId);
    } catch {
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/')) window.location.href = next;
    else {
      try {
        const pending = window.localStorage.getItem('pendingDeepLink');
        if (pending && pending.startsWith('/')) {
          window.localStorage.removeItem('pendingDeepLink');
          window.location.href = pending;
          return;
        }
      } catch {
      }
      window.location.href = '/';
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else {
      if (isBiometricEnabled()) {
        try {
          const { data } = await supabase.auth.getSession();
          const s = data?.session;
          if (s?.access_token && s?.refresh_token) {
            await storeBiometricSession({ access_token: s.access_token, refresh_token: s.refresh_token });
          }
        } catch {
        }
      }

      await finishLoginRedirect();
    }
    setLoading(false);
  };

  const onBiometricLogin = async () => {
    if (biometricLoading) return;
    setBiometricLoading(true);
    setError(null);
    setInfo(null);

    try {
      const verified = await biometricAuthenticateDetailed();
      if (!verified.ok) {
        if (verified.reason === 'cancelled') {
          setBiometricLoading(false);
          return;
        }
        if (verified.reason === 'no_plugin') {
          toast.error('No se encontró el plugin de biometría en el dispositivo.');
          setBiometricLoading(false);
          return;
        }
        if (verified.reason === 'no_method') {
          toast.error('El plugin de biometría no expone el método de autenticación.');
          setBiometricLoading(false);
          return;
        }
        if (verified.reason === 'web') {
          toast.error('La biometría solo está disponible en la app instalada.');
          setBiometricLoading(false);
          return;
        }
        const detail = (verified.message || verified.code || '').trim();
        toast.error(detail ? `No se pudo validar la biometría: ${detail}` : 'No se pudo validar la biometría.');
        setBiometricLoading(false);
        return;
      }

      const session = await loadBiometricSession();
      if (!session) {
        toast.error('No se encontró una sesión guardada para biometría.');
        setHasBiometricSession(false);
        setBiometricLoading(false);
        return;
      }

      try {
        const refreshFn = (supabase as any)?.auth?.refreshSession;
        if (typeof refreshFn === 'function') {
          const refreshed = await refreshFn({ refresh_token: session.refresh_token } as any);
          if (!refreshed?.error) {
            await finishLoginRedirect();
            return;
          }
        }
      } catch {
      }

      let setErr: any = null;
      try {
        const res = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        setErr = res?.error ?? null;
      } catch (e: any) {
        setErr = e;
      }

      if (setErr) {
        const detail = String(setErr?.message ?? '').trim();
        const code = String(setErr?.code ?? setErr?.name ?? '').trim();
        const haystack = `${code} ${detail}`.toLowerCase();

        if (haystack.includes('auth session missing')) {
          try {
            const supabaseJs = createClientBrowserJs();
            const { error: jsErr } = await supabaseJs.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
            if (!jsErr) {
              await finishLoginRedirect();
              return;
            }
          } catch {
          }
        }

        const detailFull = `${code ? `${code}: ` : ''}${detail}`.trim();
        toast.error(
          detailFull
            ? `No se pudo restaurar la sesión. Iniciá sesión con tu contraseña. (${detailFull})`
            : 'No se pudo restaurar la sesión. Iniciá sesión con tu contraseña.'
        );
        setBiometricLoading(false);
        return;
      }

      await finishLoginRedirect();
    } finally {
      setBiometricLoading(false);
    }
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

          {biometricEnabled && biometricAvailable && (
            <button
              type="button"
              className="w-full border border-gray-200 bg-white hover:bg-gray-50 text-[#31435d] h-10 rounded-md text-base md:text-sm font-medium disabled:opacity-50 transition-colors"
              disabled={loading || biometricLoading}
              onClick={onBiometricLogin}
            >
              {biometricLoading
                ? 'Verificando...'
                : biometricMode === 'device_credential'
                  ? 'Ingresar con bloqueo de pantalla'
                  : 'Ingresar con biometría'}
            </button>
          )}

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
