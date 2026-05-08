import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const branchOfficeIds = searchParams.get("branchOfficeIds");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  // Build staff filter. staffロールは自分の予定だけ見える
  const isStaffRole = auth.role === "staff" && auth.staffId;
  const staffWhere: Record<string, unknown> = { isActive: true };
  if (isStaffRole) {
    staffWhere.id = auth.staffId;
  } else if (branchOfficeIds) {
    staffWhere.branchOfficeId = {
      in: branchOfficeIds.split(",").map(Number),
    };
  }

  // Fetch all active staff with their assignments in date range
  const staff = await prisma.staff.findMany({
    where: staffWhere,
    include: {
      branchOffice: true,
      assignments: {
        where: {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        include: {
          jobSite: { include: { branchOffice: true } },
          vehicle: true,
          assignmentDays: {
            where: {
              date: { gte: startDate, lte: endDate },
            },
            orderBy: { date: "asc" },
          },
        },
      },
    },
    orderBy: [{ branchOfficeId: "asc" }, { employeeCode: "asc" }],
  });

  // staffロールは集計情報を返さない（他人の情報が漏れないように）
  if (isStaffRole) {
    return NextResponse.json({
      staff,
      dailyHeadcounts: [],
      headcountBySite: [],
      unassignedAssignments: [],
    });
  }

  // 未割当配置（staffId が null のもの）も期間内分を返す
  const unassignedAssignments = await prisma.assignment.findMany({
    where: {
      staffId: null,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: {
      jobSite: { include: { branchOffice: true } },
      vehicle: true,
      assignmentDays: {
        where: { date: { gte: startDate, lte: endDate } },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Calculate daily headcounts
  const headcounts = await prisma.assignmentDay.groupBy({
    by: ["date"],
    where: {
      date: { gte: startDate, lte: endDate },
      status: "scheduled",
    },
    _count: { id: true },
  });

  // Headcount by site per day
  const headcountBySite = await prisma.$queryRawUnsafe<
    { date: string; jobSiteId: number; siteName: string; count: number }[]
  >(
    `SELECT ad.date, a."jobSiteId" as jobSiteId, js.name as siteName, COUNT(*) as count
     FROM assignment_days ad
     JOIN assignments a ON ad."assignmentId" = a.id
     JOIN job_sites js ON a."jobSiteId" = js.id
     WHERE ad.date >= ? AND ad.date <= ? AND ad.status = 'scheduled'
     GROUP BY ad.date, a."jobSiteId"
     ORDER BY ad.date, count DESC`,
    startDate,
    endDate
  );

  return NextResponse.json({
    staff,
    dailyHeadcounts: headcounts.map((h) => ({
      date: h.date,
      total: h._count.id,
    })),
    headcountBySite: headcountBySite.map((h) => ({
      ...h,
      count: Number(h.count),
    })),
    unassignedAssignments,
  });
}
