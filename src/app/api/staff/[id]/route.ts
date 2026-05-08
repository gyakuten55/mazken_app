import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { updateStaffSchema, parseId } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const staffId = parseId(id);
  if (!staffId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: {
      branchOffice: true,
      staffQualifications: { include: { qualification: true } },
    },
  });

  if (!staff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(staff);
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
  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const { qualificationIds, ...staffData } = parsed.data;

  // Update staff and replace qualifications
  const staff = await prisma.$transaction(async (tx) => {
    if (qualificationIds !== undefined) {
      await tx.staffQualification.deleteMany({
        where: { staffId: numId },
      });

      if (qualificationIds.length > 0) {
        await tx.staffQualification.createMany({
          data: qualificationIds.map((qId: number) => ({
            staffId: numId,
            qualificationId: qId,
          })),
        });
      }
    }

    return tx.staff.update({
      where: { id: numId },
      data: staffData,
      include: {
        branchOffice: true,
        staffQualifications: { include: { qualification: true } },
      },
    });
  });

  return NextResponse.json(staff);
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

  await prisma.staff.update({
    where: { id: numId },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
