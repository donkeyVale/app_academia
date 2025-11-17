import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Helper para usar Supabase en Server Components / rutas del lado servidor
export const createClientServer = () =>
  createServerComponentClient({ cookies });
