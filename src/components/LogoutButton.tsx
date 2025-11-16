"use client";

import { createClientBrowser } from '@/lib/supabase';

export default function LogoutButton() {
  const supabase = createClientBrowser();
  return (
    <button
      type="button"
      className="text-sm underline ml-auto"
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = '/(auth)/login';
      }}
    >
      Cerrar sesión
    </button>
  );
}
