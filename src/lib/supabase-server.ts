import { cookies as nextCookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Provide a function that returns the cookie store to the helper
export const createClientServer = () =>
  createServerComponentClient({ cookies: () => nextCookies() });
