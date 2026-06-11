import { NextRequest, NextResponse } from 'next/server';

// Mirrors the bearer session token as an httpOnly cookie so middleware can
// gate server-rendered pages (RSC HTML must not leak to unauthenticated
// visitors). API auth stays header-based; only middleware reads the cookie.
export function setAuthCookie(res: NextResponse, token: string, req: NextRequest) {
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.headers.get('x-forwarded-proto') === 'https',
    maxAge: 30 * 24 * 3600,
    path: '/',
  });
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set('auth_token', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
}
