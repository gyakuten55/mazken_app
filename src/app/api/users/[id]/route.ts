import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { parseId } from "@/lib/validations";

const patchUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "manager", "office", "viewer", "staff"]).optional(),
  branchOfficeId: z.number().int().nullable().optional(),
  staffId: z.number().int().nullable().optional(),
  password: z.string().min(4).max(200).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await request.json();
  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.staffId) {
    const staffTaken = await prisma.user.findFirst({
      where: { staffId: data.staffId, NOT: { id: numId } },
    });
    if (staffTaken) {
      return NextResponse.json(
        { error: "このスタッフは既に別ユーザーに紐付いています" },
        { status: 409 },
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.branchOfficeId !== undefined) updateData.branchOfficeId = data.branchOfficeId;
  if (data.staffId !== undefined) updateData.staffId = data.staffId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password) updateData.passwordHash = hashSync(data.password, 10);

  const user = await prisma.user.update({
    where: { id: numId },
    data: updateData,
    include: { branchOffice: true, staff: true },
  });

  return NextResponse.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    branchOffice: user.branchOffice,
    staff: user.staff ? { id: user.staff.id, name: user.staff.name } : null,
    isActive: user.isActive,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  if (numId === auth.id) {
    return NextResponse.json(
      { error: "自分自身は削除できません" },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id: numId } });
  return NextResponse.json({ ok: true });
}
