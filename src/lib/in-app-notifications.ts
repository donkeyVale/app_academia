import { supabaseAdmin } from '@/lib/supabase-service';

type InAppNotificationInsert = {
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  data?: any;
};

export async function createInAppNotifications(
  rows: InAppNotificationInsert[]
): Promise<{ inserted: number; error?: string }> {
  if (!rows || rows.length === 0) return { inserted: 0 };

  const payload = rows
    .filter((r) => !!r.user_id && !!r.type && !!r.title)
    .map((r) => ({
      user_id: r.user_id,
      type: r.type,
      title: r.title,
      body: r.body ?? null,
      data: r.data ?? null,
    }));

  if (payload.length === 0) return { inserted: 0 };

  const { error } = await supabaseAdmin.from('notifications').insert(payload);
  if (error) return { inserted: 0, error: error.message };
  return { inserted: payload.length };
}
