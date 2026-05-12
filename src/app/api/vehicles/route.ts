import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { createVehicleSchema } from "@/lib/validations";
import { daysUntilDate } from "@/lib/date-utils";

export async function GET() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ isActive: "desc" }, { plateNumber: "asc" }],
  });

  return NextResponse.json(
    vehicles.map((v) => ({
      ...v,
      daysUntilInspection: daysUntilDate(v.inspectionDate),
    })),
  );
}

export async function POST(request: NextRequest) {
  // 車両登録は admin のみ（議事録: ユーザー1=officeは編集・削除NG）
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = createVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existing = await prisma.vehicle.findUnique({
    where: { plateNumber: data.plateNumber },
  });
  if (existing) {
    return NextResponse.json(
      { error: "この車両ナンバーは既に登録されています" },
      { status: 409 },
    );
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      plateNumber: data.plateNumber,
      name: data.name ?? null,
      vehicleType: data.vehicleType ?? null,
      inspectionDate: data.inspectionDate ?? null,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(
    { ...vehicle, daysUntilInspection: daysUntilDate(vehicle.inspectionDate) },
    { status: 201 },
  );
}
