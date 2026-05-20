import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await login(parsed.data.username, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "ユーザー名またはパスワードが正しくありません" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
