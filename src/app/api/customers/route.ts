import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { createCustomerSchema } from "@/lib/validations";

export async function GET(_request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    include: { _count: { select: { jobSites: true } } },
  });
  return NextResponse.json(customers);
}

export async function POST(request: NextRequest) {
  // 得意先作成は admin のみ
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // code が指定されていれば一意性をチェック
  if (parsed.data.code) {
    const dup = await prisma.customer.findUnique({ where: { code: parsed.data.code } });
    if (dup) {
      return NextResponse.json(
        { error: "この得意先コードは既に登録されています" },
        { status: 409 },
      );
    }
  }
  const customer = await prisma.customer.create({
    data: {
      code: parsed.data.code || null,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  return NextResponse.json(customer, { status: 201 });
}
