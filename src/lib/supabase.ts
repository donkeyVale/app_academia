import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Client-side (use inside Client Components)
export const createClientBrowser = () => createClientComponentClient();
