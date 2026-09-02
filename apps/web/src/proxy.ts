import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge-of-app request handling.
 *
 * In Next.js 16 this file replaces `middleware.ts`; the runtime is Node.js and
 * cannot be configured.
 *
 * Three jobs:
 *   1. Give every request a correlation id that also reaches Laravel.
 *   2. Send signed-out visitors away from private areas before a page renders.
 *   3. Attach the security headers that only make sense for HTML responses.
 */

const PRIVATE_PREFIXES = ['/account', '/dashboard', '/learn', '/checkout'];

/** The Sanctum session cookie name, as configured in the Laravel session config. */
const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? 'nuruzzaman_session';

export function proxy(request: NextRequest): NextResponse {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const { pathname, search } = request.nextUrl;

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // A cookie only means "probably signed in"; the API still authorises every
  // read and write. This redirect exists to avoid rendering a shell the visitor
  // cannot use, not as a security boundary.
  if (isPrivate && !request.cookies.has(SESSION_COOKIE)) {
    const signIn = new URL('/login', request.url);
    signIn.searchParams.set('next', `${pathname}${search}`);

    return NextResponse.redirect(signIn);
  }

  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);

  const response = NextResponse.next({ request: { headers } });

  response.headers.set('x-request-id', requestId);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );

  // Private areas must never be stored by a shared cache.
  if (isPrivate) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and the files served from /public,
     * so static delivery stays as cheap as possible.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)',
  ],
};
