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
      customer: { select: { id: true, code: true, name: true } },
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
  // 現場編集・削除は admin のみ（議事録: ユーザー1は現場一覧の編集・削除NG）
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const siteId = parseId(id);
  if (!siteId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await request.json();
  const parsed = updateJobSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { qualificationBonuses, customerId, clientCode, clientName, ...siteData } = parsed.data;

  // customerId が指定されたら Customer から code/name を取得し、レガシー列にも同期
  let customerSync: { customerId: number | null; clientCode: string | null; clientName: string | null } | null = null;
  if (customerId !== undefined) {
    if (customerId === null) {
      customerSync = { customerId: null, clientCode: clientCode ?? null, clientName: clientName ?? null };
    } else {
      const c = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, code: true, name: true },
      });
      if (!c) {
        return NextResponse.json({ error: "指定された得意先が見つかりません" }, { status: 400 });
      }
      customerSync = { customerId: c.id, clientCode: c.code, clientName: c.name };
    }
  }

  const site = await prisma.$transaction(async (tx) => {
    const updated = await tx.jobSite.update({
      where: { id: siteId },
      data: {
        ...siteData,
        ...(customerSync && {
          customerId: customerSync.customerId,
          clientCode: customerSync.clientCode,
          clientName: customerSync.clientName,
        }),
      },
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
            isRequired: qb.isRequired ?? false,
          })),
        });
      }
    }
    return tx.jobSite.findUnique({
      where: { id: updated.id },
      include: {
        branchOffice: true,
        customer: { select: { id: true, code: true, name: true } },
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
  // 現場編集・削除は admin のみ（議事録: ユーザー1は現場一覧の編集・削除NG）
  const auth = await requireRole("admin");
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
