import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { assignmentBulkStatusSchema, parseId } from "@/lib/validations";

// 配置に紐づく全 AssignmentDay の status を一括変更（事前断りトグル等）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await request.json();
  const parsed = assignmentBulkStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { status } = parsed.data;
  const result = await prisma.assignmentDay.updateMany({
    where: { assignmentId: numId },
    data: { status },
  });

  return NextResponse.json({ ok: true, updated: result.count, status });
}
