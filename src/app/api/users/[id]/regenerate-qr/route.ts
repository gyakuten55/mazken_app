import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { parseId } from "@/lib/validations";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const userId = parseId(id);
  if (!userId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const token = randomBytes(24).toString("base64url");
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { loginToken: token, loginTokenAt: new Date() },
    select: { id: true, loginToken: true, loginTokenAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const userId = parseId(id);
  if (!userId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  await prisma.user.update({
    where: { id: userId },
    data: { loginToken: null, loginTokenAt: null },
  });

  return NextResponse.json({ ok: true });
}
