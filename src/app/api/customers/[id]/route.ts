import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { updateCustomerSchema, parseId } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const customer = await prisma.customer.findUnique({
    where: { id: numId },
    include: {
      jobSites: {
        select: { id: true, siteCode: true, name: true, status: true },
        orderBy: { siteCode: "asc" },
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await request.json();
  const parsed = updateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.code) {
    const dup = await prisma.customer.findFirst({
      where: { code: parsed.data.code, NOT: { id: numId } },
    });
    if (dup) {
      return NextResponse.json(
        { error: "この得意先コードは既に登録されています" },
        { status: 409 },
      );
    }
  }

  const customer = await prisma.customer.update({
    where: { id: numId },
    data: {
      ...(parsed.data.code !== undefined && { code: parsed.data.code || null }),
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
      ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });
  return NextResponse.json(customer);
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

  // 紐付く現場がある場合は論理削除（isActive=false）
  const linked = await prisma.jobSite.count({ where: { customerId: numId } });
  if (linked > 0) {
    await prisma.customer.update({ where: { id: numId }, data: { isActive: false } });
    return NextResponse.json({
      ok: true,
      mode: "deactivated",
      reason: `${linked}件の現場が紐付いているため論理削除しました`,
    });
  }
  await prisma.customer.delete({ where: { id: numId } });
  return NextResponse.json({ ok: true, mode: "deleted" });
}
