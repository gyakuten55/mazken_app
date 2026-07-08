import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError, canEditMoney } from "@/lib/api-auth";
import { updateAssignmentSchema, parseId } from "@/lib/validations";
import { checkAssignmentConflicts, checkOrderHeadcountOverflow } from "@/lib/assignment-validation";
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

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const assignment = await prisma.assignment.findUnique({
    where: { id: numId },
    include: {
      staff: { include: { branchOffice: true } },
      jobSite: { include: { branchOffice: true, qualificationBonuses: { include: { qualification: true } } } },
      vehicle: true,
      assignmentDays: { orderBy: { date: "asc" } },
      allowances: { orderBy: { id: "asc" } },
    },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // staff（個人）は自分の配置のみ・金額は見せない（議事録 §6）
  if (auth.role === "staff") {
    if (assignment.staffId == null || assignment.staffId !== auth.staffId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...assignment,
      dailyRateOverride: null,
      allowances: [],
      assignmentDays: assignment.assignmentDays.map((d) => ({ ...d, dailyRateOverride: null })),
    });
  }

  return NextResponse.json(assignment);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 既存配置の更新（入力）は管理者・番頭・スケジュール入力専用が可（個人は不可）
  const auth = await requireRole("admin", "office", "schedule");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = updateAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { force, allowances, ...updateData } = parsed.data;

  // 議事録 §6: お金（単価・加算手当）の編集は管理者のみ。非管理者の更新からは落とす。
  const editMoney = canEditMoney(auth.role);
  if (!editMoney) {
    delete updateData.dailyRateOverride;
  }

  // staffId / vehicleId が変更される場合は競合・保険・車両チェック
  if (!force) {
    const current = await prisma.assignment.findUnique({
      where: { id: numId },
      select: {
        staffId: true,
        jobSiteId: true,
        vehicleId: true,
        assignmentDays: {
          where: { status: "scheduled" },
          select: { date: true },
        },
      },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const newStaffId = updateData.staffId !== undefined ? updateData.staffId : current.staffId;
    const newVehicleId =
      updateData.vehicleId !== undefined ? updateData.vehicleId : current.vehicleId;
    const staffChanged = newStaffId !== current.staffId;
    const vehicleChanged = newVehicleId !== current.vehicleId;
    if (staffChanged || vehicleChanged) {
      const dates = current.assignmentDays.map((d) => d.date);
      const [{ conflicts, insuranceWarning, qualificationWarning, vehicleConflicts }, orderHeadcountWarnings] =
        await Promise.all([
          checkAssignmentConflicts({
            staffId: newStaffId ?? null,
            jobSiteId: current.jobSiteId,
            dates,
            excludeAssignmentId: numId,
            vehicleId: newVehicleId,
          }),
          // 未割当→割当 のときだけ人数増。割当→未割当・スタッフ間入替は人数変化なし。
          staffChanged && current.staffId == null && newStaffId != null
            ? checkOrderHeadcountOverflow({
                jobSiteId: current.jobSiteId,
                dates,
                addedStaffCount: 1,
                excludeAssignmentId: numId,
              })
            : Promise.resolve([]),
        ]);
      if (
        (staffChanged && (conflicts.length > 0 || insuranceWarning || qualificationWarning)) ||
        (vehicleChanged && vehicleConflicts && vehicleConflicts.length > 0) ||
        orderHeadcountWarnings.length > 0
      ) {
        return NextResponse.json(
          {
            hasWarnings: true,
            conflicts: staffChanged ? conflicts : [],
            insuranceWarning: staffChanged ? insuranceWarning : null,
            qualificationWarning: staffChanged ? qualificationWarning : null,
            vehicleConflicts: vehicleChanged ? vehicleConflicts ?? [] : [],
            orderHeadcountWarnings,
          },
          { status: 409 }
        );
      }
    }
  }

  try {
  const assignment = await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.update({
      where: { id: numId },
      data: updateData,
    });
    if (editMoney && allowances !== undefined) {
      // 全置換: 現状を削除してから新しい一覧を投入（加算手当=お金なので管理者のみ）
      await tx.assignmentAllowance.deleteMany({ where: { assignmentId: numId } });
      if (allowances.length > 0) {
        await tx.assignmentAllowance.createMany({
          data: allowances.map((a) => ({
            assignmentId: numId,
            name: a.name,
            amount: a.amount,
            category: a.category,
          })),
        });
      }
    }
    return tx.assignment.findUnique({
      where: { id: updated.id },
      include: {
        staff: { include: { branchOffice: true } },
        jobSite: true,
        vehicle: true,
        assignmentDays: { orderBy: { date: "asc" } },
        allowances: { orderBy: { id: "asc" } },
      },
    });
  }, { timeout: 30000, maxWait: 10000 });

  return NextResponse.json(assignment);
  } catch (error) {
    if (isPrismaNotFound(error)) return notFoundError("配置が見つかりません");
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 配置の削除は管理者・番頭のみ（スケジュール入力専用・個人は不可）
  const auth = await requireRole("admin", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const delId = parseId(id);
  if (!delId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  try {
    await prisma.assignment.delete({ where: { id: delId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFound(error)) return notFoundError("配置が見つかりません");
    throw error;
  }
}
