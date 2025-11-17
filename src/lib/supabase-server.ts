import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Helper para usar Supabase en Server Components / rutas del lado servidor
export const createClientServer = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    // Usamos la interfaz "deprecada" basada en get/set/remove, que es la que
    // tu versión de @supabase/ssr está esperando internamente.
    cookies: {
      get(name: string) {
        const cookieStore = cookies() as any;
        const cookie = cookieStore.get(name);
        return cookie?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        const cookieStore = cookies() as any;
        try {
          // @ts-ignore
          cookieStore.set(name, value, options as any);
        } catch {
          // En Server Components puros puede fallar; lo ignoramos.
        }
      },
      remove(name: string, options: CookieOptions) {
        const cookieStore = cookies() as any;
        try {
          // Simulamos remove seteando la cookie expirada
          // @ts-ignore
          cookieStore.set(name, '', { ...(options as any), maxAge: 0 });
        } catch {
          // Ignorado en Server Components puros.
        }
      },
    },
  });
};
