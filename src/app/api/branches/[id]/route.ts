import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { updateBranchOfficeSchema, parseId } from "@/lib/validations";
import {
  parseJsonBody,
  jsonBodyError,
  isPrismaNotFound,
  notFoundError,
} from "@/lib/api-json";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const branch = await prisma.branchOffice.findUnique({ where: { id: numId } });
  if (!branch) return notFoundError("営業所が見つかりません");

  return NextResponse.json(branch);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = updateBranchOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.code) {
    const dup = await prisma.branchOffice.findFirst({
      where: { code: data.code, NOT: { id: numId } },
    });
    if (dup) {
      return NextResponse.json(
        { error: "この営業所コードは既に使われています" },
        { status: 409 },
      );
    }
  }

  try {
    const branch = await prisma.branchOffice.update({
      where: { id: numId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.fax !== undefined && { fax: data.fax }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
    return NextResponse.json(branch);
  } catch (error) {
    if (isPrismaNotFound(error)) return notFoundError("営業所が見つかりません");
    throw error;
  }
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

  const [staffCount, siteCount, userCount] = await Promise.all([
    prisma.staff.count({ where: { branchOfficeId: numId } }),
    prisma.jobSite.count({ where: { branchOfficeId: numId } }),
    prisma.user.count({ where: { branchOfficeId: numId } }),
  ]);

  if (staffCount > 0 || siteCount > 0 || userCount > 0) {
    return NextResponse.json(
      {
        error: "この営業所はまだ使われているため削除できません",
        details: {
          staff: staffCount,
          jobSites: siteCount,
          users: userCount,
        },
      },
      { status: 409 },
    );
  }

  try {
    await prisma.branchOffice.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFound(error)) return notFoundError("営業所が見つかりません");
    throw error;
  }
}
