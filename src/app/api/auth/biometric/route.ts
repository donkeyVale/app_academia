import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const refresh_token = String(body?.refresh_token ?? '').trim();
    if (!refresh_token) {
      return NextResponse.json({ ok: false, error: 'missing_refresh_token' }, { status: 400 });
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

    const cookieStore = cookies() as any;

    let supabase: any;
    try {
      supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          get(name: string) {
            const cookie = cookieStore.get(name);
            return cookie?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              // @ts-ignore
              cookieStore.set(name, value, options as any);
            } catch {
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              // @ts-ignore
              cookieStore.set(name, '', { ...(options as any), maxAge: 0 });
            } catch {
            }
          },
        },
      });
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'create_server_client_failed', detail: e?.message ?? String(e) },
        { status: 500 }
      );
    }

    try {
      const { error } = await supabase.auth.refreshSession({ refresh_token } as any);
      if (error) {
        return NextResponse.json({ ok: false, error: 'refresh_failed', detail: error.message }, { status: 401 });
      }
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'refresh_threw', detail: e?.message ?? String(e) },
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
