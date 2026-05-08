import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { updateVehicleSchema, parseId } from "@/lib/validations";
import { daysUntilDate } from "@/lib/date-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await request.json();
  const parsed = updateVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.plateNumber) {
    const dup = await prisma.vehicle.findFirst({
      where: { plateNumber: data.plateNumber, NOT: { id: numId } },
    });
    if (dup) {
      return NextResponse.json(
        { error: "この車両ナンバーは既に登録されています" },
        { status: 409 },
      );
    }
  }

  const vehicle = await prisma.vehicle.update({
    where: { id: numId },
    data: {
      ...(data.plateNumber !== undefined && { plateNumber: data.plateNumber }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.vehicleType !== undefined && { vehicleType: data.vehicleType }),
      ...(data.inspectionDate !== undefined && { inspectionDate: data.inspectionDate }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  return NextResponse.json({
    ...vehicle,
    daysUntilInspection: daysUntilDate(vehicle.inspectionDate),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin", "manager");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const assignments = await prisma.assignment.count({ where: { vehicleId: numId } });
  if (assignments > 0) {
    // 既存の配置から車両参照を外す（Assignmentは残す）
    await prisma.assignment.updateMany({
      where: { vehicleId: numId },
      data: { vehicleId: null },
    });
  }

  await prisma.vehicle.delete({ where: { id: numId } });
  return NextResponse.json({ ok: true });
}
