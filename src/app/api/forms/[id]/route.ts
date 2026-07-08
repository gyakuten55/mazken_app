import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { updateFormSchema, parseId } from "@/lib/validations";
import {
  parseJsonBody,
  jsonBodyError,
  isPrismaNotFound,
  notFoundError,
} from "@/lib/api-json";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  // 出来高請求書は番頭/スケジュール入力専用/個人には見せない（議事録 §6）
  if (["office", "schedule", "staff"].includes(auth.role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const form = await prisma.workCompletionForm.findUnique({
    where: { id: numId },
    include: { jobSite: { include: { branchOffice: true } } },
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(form);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = updateFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const form = await prisma.workCompletionForm.update({
      where: { id: numId },
      data: parsed.data,
      include: { jobSite: { include: { branchOffice: true } } },
    });
    return NextResponse.json(form);
  } catch (error) {
    if (isPrismaNotFound(error)) return notFoundError("出来高確認書が見つかりません");
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  try {
    await prisma.workCompletionForm.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFound(error)) return notFoundError("出来高確認書が見つかりません");
    throw error;
  }
}
