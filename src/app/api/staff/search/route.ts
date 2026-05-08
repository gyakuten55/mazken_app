import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/api-auth";

function daysBetweenInclusive(start: string, end: string): number {
  const s = new Date(start + "T00:00:00").getTime();
  const e = new Date(end + "T00:00:00").getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const qualificationIds = searchParams.get("qualifications");
  const insuranceType = searchParams.get("insuranceType");
  const availableDate = searchParams.get("availableDate");
  const availableStartDate = searchParams.get("availableStartDate");
  const availableEndDate = searchParams.get("availableEndDate");
  const branchOfficeId = searchParams.get("branchOfficeId");

  const isRangeMode = !!availableStartDate && !!availableEndDate;
  const isSingleDateMode = !isRangeMode && !!availableDate;

  const where: Record<string, unknown> = { isActive: true };

  if (insuranceType) where.insuranceType = insuranceType;
  if (branchOfficeId) where.branchOfficeId = parseInt(branchOfficeId);

  // AND-based qualification search
  if (qualificationIds) {
    const qIds = qualificationIds.split(",").map(Number);
    // Staff must have ALL specified qualifications
    where.AND = qIds.map((qId) => ({
      staffQualifications: {
        some: { qualificationId: qId },
      },
    }));
  }

  const staff = await prisma.staff.findMany({
    where,
    include: {
      branchOffice: true,
      staffQualifications: { include: { qualification: true } },
      assignments: isRangeMode
        ? {
            where: {
              startDate: { lte: availableEndDate! },
              endDate: { gte: availableStartDate! },
            },
            include: {
              jobSite: { select: { id: true, name: true } },
              assignmentDays: {
                where: {
                  date: { gte: availableStartDate!, lte: availableEndDate! },
                  status: "scheduled",
                },
              },
            },
          }
        : isSingleDateMode
          ? {
              include: {
                assignmentDays: {
                  where: { date: availableDate!, status: "scheduled" },
                },
              },
            }
          : false,
    },
    orderBy: [{ branchOfficeId: "asc" }, { employeeCode: "asc" }],
  });

  // Single-date mode: filter to staff with no busy day on that date
  if (isSingleDateMode) {
    const filtered = staff.filter((s) => {
      const assignments = s.assignments as unknown as { assignmentDays: { date: string; status: string }[] }[];
      if (!Array.isArray(assignments)) return true;
      const busy = assignments.filter((a) => a.assignmentDays.length > 0);
      return busy.length === 0;
    });
    const result = filtered.map(({ assignments: _a, ...rest }) => rest);
    return NextResponse.json(result);
  }

  // Range mode: attach availability summary, sort by free days desc
  if (isRangeMode) {
    const totalDays = daysBetweenInclusive(availableStartDate!, availableEndDate!);
    type RangeAssignment = {
      jobSite: { id: number; name: string };
      assignmentDays: { date: string; status: string }[];
    };
    const result = staff.map((s) => {
      const assignments = s.assignments as unknown as RangeAssignment[];
      const conflictMap = new Map<number, { siteName: string; dates: string[] }>();
      const busyDates = new Set<string>();
      if (Array.isArray(assignments)) {
        for (const a of assignments) {
          for (const d of a.assignmentDays) {
            busyDates.add(d.date);
            const ex = conflictMap.get(a.jobSite.id);
            if (ex) {
              if (!ex.dates.includes(d.date)) ex.dates.push(d.date);
            } else {
              conflictMap.set(a.jobSite.id, {
                siteName: a.jobSite.name,
                dates: [d.date],
              });
            }
          }
        }
      }
      const busyDays = busyDates.size;
      const freeDays = Math.max(0, totalDays - busyDays);
      const conflicts = Array.from(conflictMap.values()).map((c) => ({
        siteName: c.siteName,
        dates: c.dates.slice().sort(),
      }));
      const { assignments: _a, ...rest } = s;
      return {
        ...rest,
        availability: { totalDays, busyDays, freeDays, conflicts },
      };
    });
    result.sort((a, b) => {
      const af = a.availability?.freeDays ?? 0;
      const bf = b.availability?.freeDays ?? 0;
      if (bf !== af) return bf - af;
      return a.employeeCode.localeCompare(b.employeeCode);
    });
    return NextResponse.json(result);
  }

  // Default: no availability filter — strip assignments key if it exists
  const result = staff.map((s) => {
    const { assignments: _a, ...rest } = s as typeof s & { assignments?: unknown };
    return rest;
  });
  return NextResponse.json(result);
}
