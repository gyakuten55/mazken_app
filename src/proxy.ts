import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "matsken_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth endpoints without session check
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // All other API routes require session cookie
  if (pathname.startsWith("/api")) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
