import { redirect } from 'next/navigation';
import { createClientServer } from './supabase-server';

export async function requireUser() {
  const supabase = createClientServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  return data.user;
}
