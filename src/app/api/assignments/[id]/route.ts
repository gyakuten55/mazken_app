import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { updateAssignmentSchema, parseId } from "@/lib/validations";
import { checkAssignmentConflicts } from "@/lib/assignment-validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const assignment = await prisma.assignment.findUnique({
    where: { id: numId },
    include: {
      staff: { include: { branchOffice: true } },
      jobSite: { include: { branchOffice: true } },
      assignmentDays: { orderBy: { date: "asc" } },
    },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(assignment);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await request.json();
  const parsed = updateAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const { force, ...updateData } = parsed.data;

  // staffId が変更される（特に未割当→割当）場合は競合・保険チェック
  if (!force && updateData.staffId != null) {
    const current = await prisma.assignment.findUnique({
      where: { id: numId },
      select: {
        staffId: true,
        jobSiteId: true,
        assignmentDays: {
          where: { status: "scheduled" },
          select: { date: true },
        },
      },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (updateData.staffId !== current.staffId) {
      const dates = current.assignmentDays.map((d) => d.date);
      const { conflicts, insuranceWarning } = await checkAssignmentConflicts({
        staffId: updateData.staffId,
        jobSiteId: current.jobSiteId,
        dates,
        excludeAssignmentId: numId,
      });
      if (conflicts.length > 0 || insuranceWarning) {
        return NextResponse.json(
          { hasWarnings: true, conflicts, insuranceWarning },
          { status: 409 }
        );
      }
    }
  }

  const assignment = await prisma.assignment.update({
    where: { id: numId },
    data: updateData,
    include: {
      staff: { include: { branchOffice: true } },
      jobSite: true,
      assignmentDays: { orderBy: { date: "asc" } },
    },
  });

  return NextResponse.json(assignment);
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

  await prisma.assignment.delete({ where: { id: delId } });
  return NextResponse.json({ ok: true });
}
