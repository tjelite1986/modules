import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Gates server-rendered pages: without this, RSC HTML (e.g. the clips and
// shorts18 listings with every title/slug) is served to anyone. API routes
// keep their own header/media-token auth and are excluded via the matcher.
// The cookie mirrors the bearer session token (see lib/authCookie.ts);
// signature + expiry are checked here, DB-backed session revocation is
// still enforced by the API layer.

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");

const PUBLIC_PAGES = [/^\/login$/, /^\/register$/, /^\/gallery\/s\//];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PAGES.some((re) => re.test(pathname))) return NextResponse.next();

  const token = req.cookies.get("auth_token")?.value;
  if (token) {
    try {
      await jwtVerify(token, SECRET);
      return NextResponse.next();
    } catch {}
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, socket.io and public
    // assets. Pages are the protection target here.
    "/((?!api/|_next/|socket\\.io|favicon\\.ico|sw\\.js|manifest|icons/|pdfjs/|elite\\.apk).*)",
  ],
};
