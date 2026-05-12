import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { createJobSiteSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const branchOfficeId = searchParams.get("branchOfficeId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (branchOfficeId) where.branchOfficeId = parseInt(branchOfficeId);

  const sites = await prisma.jobSite.findMany({
    where,
    include: {
      branchOffice: true,
      customer: { select: { id: true, code: true, name: true } },
      qualificationBonuses: {
        select: { qualificationId: true, isRequired: true, qualification: { select: { id: true, name: true } } },
      },
    },
    // 得意先(親) → 現場(子) の階層で並べる
    orderBy: [{ clientCode: "asc" }, { clientName: "asc" }, { siteCode: "asc" }],
  });

  return NextResponse.json(sites);
}

// customerId から得意先情報を取得し、レガシー clientCode / clientName 列も同期する
async function resolveCustomerSync(customerId: number | null | undefined) {
  if (!customerId) return { customerId: null, clientCode: null, clientName: null };
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, code: true, name: true },
  });
  if (!c) throw new Error("指定された得意先が見つかりません");
  return { customerId: c.id, clientCode: c.code, clientName: c.name };
}

export async function POST(request: NextRequest) {
  // 現場作成は admin のみ（議事録: ユーザー1=officeは現場一覧の作成・編集・削除NG）
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = createJobSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { qualificationBonuses, customerId, clientCode, clientName, ...siteData } = parsed.data;

  // customerId が指定されていれば Customer の code/name をレガシー列に同期
  let synced;
  try {
    synced = await resolveCustomerSync(customerId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const site = await prisma.jobSite.create({
    data: {
      ...siteData,
      // customerId を優先。指定されていない場合は手入力された clientCode/clientName を保持（レガシー）
      customerId: synced.customerId,
      clientCode: synced.customerId ? synced.clientCode : clientCode ?? null,
      clientName: synced.customerId ? synced.clientName : clientName ?? null,
      ...(qualificationBonuses && qualificationBonuses.length > 0
        ? { qualificationBonuses: { create: qualificationBonuses } }
        : {}),
    },
    include: {
      branchOffice: true,
      customer: { select: { id: true, code: true, name: true } },
      qualificationBonuses: true,
    },
  });
  return NextResponse.json(site, { status: 201 });
}
