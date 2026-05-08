import { NextResponse } from "next/server";
import { getSession } from "./auth";

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Require authentication. Returns the session or a 401 response.
 */
export async function requireAuth(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  return session;
}

/**
 * Require authentication + specific roles. Returns the session or a 401/403 response.
 */
export async function requireRole(...roles: string[]): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  return session;
}

/**
 * Type guard to check if the result is a NextResponse (error).
 */
export function isAuthError(result: Session | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
