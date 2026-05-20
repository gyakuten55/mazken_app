import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { createBranchOfficeSchema } from "@/lib/validations";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

export async function GET() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const branches = await prisma.branchOffice.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(branches);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = createBranchOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const dup = await prisma.branchOffice.findUnique({ where: { code: data.code } });
  if (dup) {
    return NextResponse.json(
      { error: "この営業所コードは既に使われています" },
      { status: 409 },
    );
  }

  const branch = await prisma.branchOffice.create({
    data: {
      name: data.name,
      code: data.code,
      color: data.color,
      address: data.address ?? null,
      phone: data.phone ?? null,
      fax: data.fax ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  return NextResponse.json(branch, { status: 201 });
}
