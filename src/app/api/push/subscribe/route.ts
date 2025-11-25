import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, keys, platform = 'web', userId } = body || {};

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Falta userId.' }, { status: 400 });
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Suscripción inválida.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        platform,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error guardando suscripción' }, { status: 500 });
  }
}
