import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { moveAssignmentSchema, parseId } from "@/lib/validations";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// Move an assignment: change staff and/or shift dates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 既存配置の移動（入力）は管理者・番頭・スケジュール入力専用が可
  const auth = await requireRole("admin", "office", "schedule");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const assignmentId = parseId(id);
  if (!assignmentId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = moveAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const { newStaffId, dayShift, force } = parsed.data;

  // Conflict check before moving
  if (!force) {
    const current = await prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { assignmentDays: { where: { status: "scheduled" } } },
    });

    const targetStaffId = newStaffId || current.staffId;
    const targetDates = current.assignmentDays.map((d) =>
      dayShift ? shiftDate(d.date, dayShift) : d.date
    );

    if (targetDates.length > 0) {
      const conflictDays = await prisma.assignmentDay.findMany({
        where: {
          date: { in: targetDates },
          status: "scheduled",
          assignment: {
            staffId: targetStaffId,
            id: { not: assignmentId },
          },
        },
        include: {
          assignment: {
            include: { jobSite: { select: { id: true, name: true } } },
          },
        },
      });

      if (conflictDays.length > 0) {
        const conflictSites = new Map<number, { siteName: string; dates: string[] }>();
        for (const c of conflictDays) {
          const siteId = c.assignment.jobSite.id;
          const existing = conflictSites.get(siteId);
          if (existing) existing.dates.push(c.date);
          else conflictSites.set(siteId, { siteName: c.assignment.jobSite.name, dates: [c.date] });
        }
        return NextResponse.json(
          { hasWarnings: true, conflicts: Array.from(conflictSites.values()) },
          { status: 409 }
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update staff if changed
    const current = await tx.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { assignmentDays: true },
    });

    const updates: Record<string, unknown> = {};
    if (newStaffId && newStaffId !== current.staffId) {
      updates.staffId = newStaffId;
    }
    if (dayShift && dayShift !== 0) {
      updates.startDate = shiftDate(current.startDate, dayShift);
      updates.endDate = shiftDate(current.endDate, dayShift);
    }

    if (Object.keys(updates).length > 0) {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: updates,
      });
    }

    // Shift all assignment_days
    if (dayShift && dayShift !== 0) {
      for (const day of current.assignmentDays) {
        await tx.assignmentDay.update({
          where: { id: day.id },
          data: { date: shiftDate(day.date, dayShift) },
        });
      }
    }
  }, { timeout: 30000, maxWait: 10000 });

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      staff: { include: { branchOffice: true } },
      jobSite: true,
      assignmentDays: { orderBy: { date: "asc" } },
    },
  });

  return NextResponse.json(assignment);
}
