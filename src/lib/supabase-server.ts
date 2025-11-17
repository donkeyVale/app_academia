import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Helper para usar Supabase en Server Components / rutas del lado servidor
export const createClientServer = () => {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // En Server Components normalmente no escribimos cookies; estas funciones se usan
      // principalmente en rutas o acciones donde sí es posible mutarlas.
      set(name: string, value: string, options: CookieOptions) {
        // No-op por ahora; las operaciones de login/logout se hacen desde el cliente.
      },
      remove(name: string, options: CookieOptions) {
        // No-op.
      },
    },
  });
};
