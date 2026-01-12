import { NextResponse, NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export const config = {
  matcher: ['/((?!_next|api|manifest\\.json|icons|sw\\.js|login|favicon\\.ico).*)'],
};

export default async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh the session if needed. This sets auth cookies on the response.
  let session: any = null;
  try {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    session = s;
  } catch {
    session = null;
  }

  const isLogin = req.nextUrl.pathname.startsWith('/login');

  if (!session && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return res;
}
