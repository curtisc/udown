import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Check for Auth.js session cookie
  // Cookie name varies: "authjs.session-token" in dev, "__Secure-authjs.session-token" in production
  const sessionToken =
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('__Secure-authjs.session-token')

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!sign-in|request-access|api/auth|api/cron|api/access-request|_next/static|_next/image|favicon.ico).*)',
  ],
}
