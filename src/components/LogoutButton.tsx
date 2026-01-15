"use client";

import { createClientBrowser } from '@/lib/supabase';
import { isBiometricEnabled } from '@/lib/capacitor-biometrics';

export default function LogoutButton() {
  const supabase = createClientBrowser();
  return (
    <button
      type="button"
      className="text-sm"
      onClick={async () => {
        await supabase.auth.signOut(isBiometricEnabled() ? ({ scope: 'local' } as any) : undefined);
        window.location.href = '/(auth)/login';
      }}
    >
      Cerrar sesión
    </button>
  );
}
