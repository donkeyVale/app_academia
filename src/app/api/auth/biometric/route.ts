import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const access_token = String(body?.access_token ?? '').trim();
    const refresh_token = String(body?.refresh_token ?? '').trim();
    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { ok: false, error: 'missing_tokens', detail: 'access_token y refresh_token son requeridos' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'missing_env',
          detail: `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl ? 'set' : 'missing'}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey ? 'set' : 'missing'}`,
        },
        { status: 500 }
      );
    }

    let supabase: any;
    try {
      supabase = createRouteHandlerClient({ cookies } as any);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'create_server_client_failed', detail: e?.message ?? String(e) },
        { status: 500 }
      );
    }

    try {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token } as any);
      if (error) {
        return NextResponse.json({ ok: false, error: 'set_session_failed', detail: error.message }, { status: 401 });
      }
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'set_session_threw', detail: e?.message ?? String(e) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'handler_threw', detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
