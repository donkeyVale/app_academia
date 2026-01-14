"use client";

import { createClientBrowser } from '@/lib/supabase';
import { oneSignalLogout } from '@/lib/capacitor-onesignal';

export default function LogoutButton() {
  const supabase = createClientBrowser();
  return (
    <button
      type="button"
      className="text-sm"
      onClick={async () => {
        try {
          await oneSignalLogout();
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
