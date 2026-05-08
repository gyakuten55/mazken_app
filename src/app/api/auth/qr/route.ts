import { NextRequest, NextResponse } from "next/server";
import { loginByToken } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "トークンが不正です" }, { status: 400 });
  }

  const user = await loginByToken(parsed.data.token);
  if (!user) {
    return NextResponse.json({ error: "無効または期限切れのトークンです" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    role: user.role,
  });
}
