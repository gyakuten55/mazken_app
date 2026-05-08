import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { updateJobSiteSchema, parseId } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const site = await prisma.jobSite.findUnique({
    where: { id: numId },
    include: {
      branchOffice: true,
      qualificationBonuses: { include: { qualification: true } },
    },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(site);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const siteId = parseId(id);
  if (!siteId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await request.json();
  const parsed = updateJobSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { qualificationBonuses, ...siteData } = parsed.data;
  const site = await prisma.$transaction(async (tx) => {
    const updated = await tx.jobSite.update({
      where: { id: siteId },
      data: siteData,
    });
    if (qualificationBonuses !== undefined) {
      // 全置換: 現状を削除してから新しい一覧を投入
      await tx.jobSiteQualificationBonus.deleteMany({ where: { jobSiteId: siteId } });
      if (qualificationBonuses.length > 0) {
        await tx.jobSiteQualificationBonus.createMany({
          data: qualificationBonuses.map((qb) => ({
            jobSiteId: siteId,
            qualificationId: qb.qualificationId,
            bonusAmount: qb.bonusAmount,
          })),
        });
      }
    }
    return tx.jobSite.findUnique({
      where: { id: updated.id },
      include: {
        branchOffice: true,
        qualificationBonuses: { include: { qualification: true } },
      },
    });
  });
  return NextResponse.json(site);
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

  await prisma.jobSite.update({
    where: { id: delId },
    data: { status: "cancelled" },
  });
  return NextResponse.json({ ok: true });
}
