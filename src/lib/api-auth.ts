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

// ===== 役割ポリシー（議事録 §6 の4区分: admin=管理者 / office=番頭 / schedule=スケジュール入力専用 / staff=個人）=====

/** お金（単価・日当・加算手当・日計表金額・CSV）を編集/出力できるのは管理者のみ。 */
export function canEditMoney(role: string): boolean {
  return role === "admin";
}

/** 配置の新規作成・削除ができる役割（番頭は可。スケジュール入力専用・個人は不可）。 */
export function canCreateOrDeleteAssignment(role: string): boolean {
  return role === "admin" || role === "office";
}

/** 既存配置の入力（更新・日別入力）ができる役割（スケジュール入力専用も可。個人は不可）。 */
export function canInputAssignment(role: string): boolean {
  return role === "admin" || role === "office" || role === "schedule";
}
