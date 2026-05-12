import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { updateAssignmentSchema, parseId } from "@/lib/validations";
import { checkAssignmentConflicts } from "@/lib/assignment-validation";

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
  return NextResponse.json(assignment);
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

  const body = await request.json();
  const parsed = updateAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { force, allowances, ...updateData } = parsed.data;

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
      const { conflicts, insuranceWarning, vehicleConflicts } = await checkAssignmentConflicts({
        staffId: newStaffId ?? null,
        jobSiteId: current.jobSiteId,
        dates,
        excludeAssignmentId: numId,
        vehicleId: newVehicleId,
      });
      if (
        (staffChanged && (conflicts.length > 0 || insuranceWarning)) ||
        (vehicleChanged && vehicleConflicts && vehicleConflicts.length > 0)
      ) {
        return NextResponse.json(
          {
            hasWarnings: true,
            conflicts: staffChanged ? conflicts : [],
            insuranceWarning: staffChanged ? insuranceWarning : null,
            vehicleConflicts: vehicleChanged ? vehicleConflicts ?? [] : [],
          },
          { status: 409 }
        );
      }
    }
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.update({
      where: { id: numId },
      data: updateData,
    });
    if (allowances !== undefined) {
      // 全置換: 現状を削除してから新しい一覧を投入
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
  });

  return NextResponse.json(assignment);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const delId = parseId(id);
  if (!delId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  await prisma.assignment.delete({ where: { id: delId } });
  return NextResponse.json({ ok: true });
}
