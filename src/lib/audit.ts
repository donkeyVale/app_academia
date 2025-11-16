"use client";

import { createClientBrowser } from '@/lib/supabase';

type AuditPayload = Record<string, any> | null;

export async function logAudit(action: string, entity: string, entity_id: string | null, payload: AuditPayload = null) {
  const supabase = createClientBrowser();
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData?.user?.id ?? null;
  await supabase.from('audit_logs').insert({ action, entity, entity_id, payload, user_id });
}
