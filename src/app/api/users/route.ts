import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

const createUserSchema = z.object({
  username: z.string().min(1, "ユーザー名は必須です").max(100),
  password: z.string().min(4, "パスワードは4文字以上").max(200),
  name: z.string().min(1, "名前は必須です"),
  role: z.enum(["admin", "manager", "office", "schedule", "viewer", "staff"]),
  branchOfficeId: z.number().int().nullable().optional(),
  staffId: z.number().int().nullable().optional(),
});

export async function GET() {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const users = await prisma.user.findMany({
    include: { branchOffice: true, staff: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      branchOffice: u.branchOffice,
      staff: u.staff ? { id: u.staff.id, name: u.staff.name } : null,
      isActive: u.isActive,
      createdAt: u.createdAt,
    })),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) {
    return NextResponse.json(
      { error: "このユーザー名は既に使われています" },
      { status: 409 },
    );
  }

  if (data.staffId) {
    const staffTaken = await prisma.user.findUnique({ where: { staffId: data.staffId } });
    if (staffTaken) {
      return NextResponse.json(
        { error: "このスタッフは既に別ユーザーに紐付いています" },
        { status: 409 },
      );
    }
  }

  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash: hashSync(data.password, 10),
      name: data.name,
      role: data.role,
      branchOfficeId: data.branchOfficeId ?? null,
      staffId: data.staffId ?? null,
      isActive: true,
    },
    include: { branchOffice: true },
  });

  return NextResponse.json(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      branchOffice: user.branchOffice,
      isActive: user.isActive,
    },
    { status: 201 },
  );
}
