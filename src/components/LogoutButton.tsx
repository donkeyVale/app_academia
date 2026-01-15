"use client";

import { createClientBrowser } from '@/lib/supabase';
import { clearBiometricSession } from '@/lib/capacitor-biometrics';

export default function LogoutButton() {
  const supabase = createClientBrowser();
  return (
    <button
      type="button"
      className="text-sm"
      onClick={async () => {
        try {
          await clearBiometricSession();
        } catch {
        }
        await supabase.auth.signOut();
        window.location.href = '/(auth)/login';
      }}
    >
      Cerrar sesión
    </button>
  );
}
