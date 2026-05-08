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
    include: { branchOffice: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sites);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = createJobSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { qualificationBonuses, ...siteData } = parsed.data;
  const site = await prisma.jobSite.create({
    data: {
      ...siteData,
      ...(qualificationBonuses && qualificationBonuses.length > 0
        ? { qualificationBonuses: { create: qualificationBonuses } }
        : {}),
    },
    include: { branchOffice: true, qualificationBonuses: true },
  });
  return NextResponse.json(site, { status: 201 });
}
