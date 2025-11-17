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
    // Implementación recomendada por Supabase para Next.js App Router
    cookies: {
      getAll() {
        const cookieStore = cookies() as any;
        // NextRequestCookies / ReadonlyRequestCookies ya exponen getAll()
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        const cookieStore = cookies() as any;
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            // En Server Components esto puede lanzar; por eso el try/catch.
            // En rutas / acciones sí puede escribir cookies.
            // @ts-ignore: el tipo de cookies() en Next no declara set con CookieOptions exactamente igual
            cookieStore.set(name, value, options as any);
          });
        } catch {
          // Si se llama desde un Server Component puro, ignoramos el intento de escritura.
          // Las sesiones se refrescan vía middleware o desde el cliente.
        }
      },
    },
  });
};
