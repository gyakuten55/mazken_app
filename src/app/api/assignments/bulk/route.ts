import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { bulkAssignmentSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = bulkAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const { staffIds, jobSiteId, vehicleId, startDate, endDate, assignmentType, shiftType, startTime, endTime } = parsed.data;

  // Generate day records（日曜も含む。休みは日別トグルで管理）
  const dates: string[] = [];
  const cur = new Date(startDate);
  const last = new Date(endDate);
  while (cur <= last) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }

  // Check for conflicts per staff
  const conflictDays = await prisma.assignmentDay.findMany({
    where: {
      date: { in: dates },
      status: "scheduled",
      assignment: { staffId: { in: staffIds } },
    },
    include: {
      assignment: {
        include: {
          staff: { select: { id: true, name: true } },
          jobSite: { select: { name: true } },
        },
      },
    },
  });

  // Group conflicts by staff（未割当配置はスキップ）
  const conflictsByStaff = new Map<number, { staffName: string; sites: string[] }>();
  for (const c of conflictDays) {
    if (!c.assignment.staff) continue;
    const sid = c.assignment.staff.id;
    if (!conflictsByStaff.has(sid)) {
      conflictsByStaff.set(sid, { staffName: c.assignment.staff.name, sites: [] });
    }
    const siteName = c.assignment.jobSite.name;
    const entry = conflictsByStaff.get(sid)!;
    if (!entry.sites.includes(siteName)) entry.sites.push(siteName);
  }

  // Create all assignments in a transaction
  const results = await prisma.$transaction(
    staffIds.map((staffId: number) =>
      prisma.assignment.create({
        data: {
          staffId,
          jobSiteId,
          vehicleId: vehicleId ?? null,
          startDate,
          endDate,
          assignmentType: assignmentType || "commute",
          shiftType: shiftType || "day",
          startTime: startTime || "08:00",
          endTime: endTime || "18:00",
          assignmentDays: {
            create: dates.map((date) => ({ date, status: "scheduled" })),
          },
        },
      })
    )
  );

  return NextResponse.json({
    created: results.length,
    conflicts: Array.from(conflictsByStaff.values()),
  }, { status: 201 });
}
