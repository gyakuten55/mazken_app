import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { createStaffSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const branchOfficeId = searchParams.get("branchOfficeId");
  const search = searchParams.get("search");
  const insuranceType = searchParams.get("insuranceType");

  const where: Record<string, unknown> = { isActive: true };

  if (branchOfficeId) {
    where.branchOfficeId = parseInt(branchOfficeId);
  }
  if (insuranceType) {
    where.insuranceType = insuranceType;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { nameKana: { contains: search } },
      { employeeCode: { contains: search } },
    ];
  }

  const staff = await prisma.staff.findMany({
    where,
    include: {
      branchOffice: true,
      staffQualifications: {
        include: { qualification: true },
      },
    },
    orderBy: [{ branchOfficeId: "asc" }, { employeeCode: "asc" }],
  });

  return NextResponse.json(staff);
}

export async function POST(request: NextRequest) {
  // スタッフ作成は admin のみ（議事録: ユーザー1=officeはスタッフ一覧の作成・編集・削除NG）
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const { qualificationIds, ...staffData } = parsed.data;

  const staff = await prisma.staff.create({
    data: {
      ...staffData,
      staffQualifications: qualificationIds?.length
        ? {
            create: qualificationIds.map((qId: number) => ({
              qualificationId: qId,
            })),
          }
        : undefined,
    },
    include: {
      branchOffice: true,
      staffQualifications: { include: { qualification: true } },
    },
  });

  return NextResponse.json(staff, { status: 201 });
}
