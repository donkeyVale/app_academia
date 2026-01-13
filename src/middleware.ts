import { NextResponse, NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export const config = {
  matcher: ['/((?!_next|api|manifest\\.json|icons|sw\\.js|login|privacy-policy|support|favicon\\.ico|\\.well-known|apple-app-site-association).*)'],
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
    const nextPath = req.nextUrl.pathname + req.nextUrl.search;
    url.searchParams.set('next', nextPath);
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const next = req.nextUrl.searchParams.get('next');
    if (next && next.startsWith('/')) {
      const url = req.nextUrl.clone();
      url.pathname = next;
      url.search = '';
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return res;
}
