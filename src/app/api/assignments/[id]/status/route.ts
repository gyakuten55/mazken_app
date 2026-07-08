import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { assignmentBulkStatusSchema, parseId } from "@/lib/validations";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

// 配置に紐づく全 AssignmentDay の status を一括変更（事前断りトグル等）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 事前断り等の status 変更（入力）は管理者・番頭・スケジュール入力専用が可
  const auth = await requireRole("admin", "office", "schedule");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
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
