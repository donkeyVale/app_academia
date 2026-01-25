"use client";

import { createClientBrowser } from '@/lib/supabase';
import { isBiometricEnabled } from '@/lib/capacitor-biometrics';
import { useMemo } from 'react';

export default function LogoutButton({ className }: { className?: string }) {
  const supabase = useMemo(() => createClientBrowser(), []);
  return (
    <button
      type="button"
      className={className || "text-sm"}
      onClick={async () => {
        await supabase.auth.signOut(isBiometricEnabled() ? ({ scope: 'local' } as any) : undefined);
        window.location.href = '/(auth)/login';
      }}
    >
      Cerrar sesión
    </button>
  );
}
