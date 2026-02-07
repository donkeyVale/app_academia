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
    cookies: {
      getAll() {
        const cookieStore = cookies() as any;
        const all = (cookieStore.getAll?.() ?? []) as { name: string; value: string }[];
        return all.map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        const cookieStore = cookies() as any;
        try {
          for (const c of cookiesToSet) {
            // @ts-ignore
            cookieStore.set(c.name, c.value, (c.options ?? {}) as any);
          }
        } catch {
          // En Server Components puros puede fallar; lo ignoramos.
        }
      },
    },
  });
};
