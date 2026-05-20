import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { assignmentDayPatchSchema, parseId } from "@/lib/validations";
import {
  parseJsonBody,
  jsonBodyError,
  isPrismaNotFound,
  notFoundError,
} from "@/lib/api-json";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { dayId } = await params;
  const numDayId = parseId(dayId);
  if (!numDayId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = assignmentDayPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { status, acknowledged, dailyRateOverride, orderHeadcount } = parsed.data;

  // status / dailyRateOverride / orderHeadcount 変更は admin/manager/office のみ
  if (
    (status !== undefined ||
      dailyRateOverride !== undefined ||
      orderHeadcount !== undefined) &&
    !["admin", "manager", "office"].includes(auth.role)
  ) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // acknowledged 変更は staff 含め全ロールOK（自分の配置確認）
  // ただし staff の場合は自分の配置日のみ操作可
  if (acknowledged !== undefined && auth.role === "staff") {
    const day = await prisma.assignmentDay.findUnique({
      where: { id: numDayId },
      include: { assignment: true },
    });
    if (!day || day.assignment.staffId !== auth.staffId) {
      return NextResponse.json({ error: "自分の配置のみ更新できます" }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (dailyRateOverride !== undefined) data.dailyRateOverride = dailyRateOverride;
  if (orderHeadcount !== undefined) data.orderHeadcount = orderHeadcount;
  if (acknowledged === true) {
    data.acknowledgedAt = new Date();
    data.acknowledgedBy = auth.id;
  } else if (acknowledged === false) {
    data.acknowledgedAt = null;
    data.acknowledgedBy = null;
  }

  try {
    const day = await prisma.assignmentDay.update({
      where: { id: numDayId },
      data,
    });
    return NextResponse.json(day);
  } catch (error) {
    if (isPrismaNotFound(error)) return notFoundError("配置日が見つかりません");
    throw error;
  }
}
