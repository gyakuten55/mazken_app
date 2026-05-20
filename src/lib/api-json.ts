import { NextResponse } from "next/server";

/**
 * リクエストボディを JSON としてパースする。
 * 不正な JSON（空ボディ、文字列ボディなど）の場合は null を返す。
 * 呼び出し側で null チェックして jsonBodyError() を返すこと。
 */
export async function parseJsonBody<T = unknown>(
  request: Request,
): Promise<T | null> {
  return request
    .json()
    .then((body) => body as T)
    .catch(() => null);
}

export function jsonBodyError() {
  return NextResponse.json(
    { error: "リクエストボディが正しい JSON ではありません" },
    { status: 400 },
  );
}

/**
 * Prisma の "Record to update/delete not found" (P2025) かを判定。
 */
export function isPrismaNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}

export function notFoundError(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
