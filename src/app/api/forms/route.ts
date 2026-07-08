import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { createFormSchema } from "@/lib/validations";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  // 出来高請求書は番頭/スケジュール入力専用/個人には見せない（議事録 §6・お金関連）
  if (["office", "schedule", "staff"].includes(auth.role)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const jobSiteId = searchParams.get("jobSiteId");

  const where: Record<string, unknown> = {};
  if (date) where.date = date;
  if (jobSiteId) where.jobSiteId = parseInt(jobSiteId);

  const forms = await prisma.workCompletionForm.findMany({
    where,
    include: { jobSite: { include: { branchOffice: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(forms);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = createFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const form = await prisma.workCompletionForm.create({
    data: parsed.data,
    include: { jobSite: { include: { branchOffice: true } } },
  });
  return NextResponse.json(form, { status: 201 });
}
