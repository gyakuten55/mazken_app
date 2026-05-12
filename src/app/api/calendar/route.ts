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
          allowances: { orderBy: { id: "asc" } },
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
      sitesInRange: [],
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
      allowances: { orderBy: { id: "asc" } },
    },
    orderBy: { startDate: "asc" },
  });

  // Calculate daily headcounts（事前断り・キャンセルは合計から除外）
  const headcounts = await prisma.assignmentDay.groupBy({
    by: ["date"],
    where: {
      date: { gte: startDate, lte: endDate },
      status: "scheduled",
    },
    _count: { id: true },
  });

  // Headcount by site per day（scheduled / pre_declined を区別して集計）
  const headcountRaw = await prisma.assignmentDay.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: { in: ["scheduled", "pre_declined"] },
    },
    select: {
      date: true,
      status: true,
      assignment: {
        select: {
          jobSiteId: true,
          jobSite: { select: { name: true } },
        },
      },
    },
  });
  type SiteAggKey = string; // `${date}|${jobSiteId}`
  const aggMap = new Map<
    SiteAggKey,
    { date: string; jobSiteId: number; siteName: string; scheduledCount: number; preDeclinedCount: number }
  >();
  for (const r of headcountRaw) {
    const key = `${r.date}|${r.assignment.jobSiteId}`;
    const existing = aggMap.get(key) ?? {
      date: r.date,
      jobSiteId: r.assignment.jobSiteId,
      siteName: r.assignment.jobSite.name,
      scheduledCount: 0,
      preDeclinedCount: 0,
    };
    if (r.status === "scheduled") existing.scheduledCount += 1;
    else if (r.status === "pre_declined") existing.preDeclinedCount += 1;
    aggMap.set(key, existing);
  }
  const headcountBySite = Array.from(aggMap.values()).map((agg) => ({
    date: agg.date,
    jobSiteId: agg.jobSiteId,
    siteName: agg.siteName,
    count: agg.scheduledCount,
    preDeclinedCount: agg.preDeclinedCount,
  }));

  // 期間内に配置がある現場の必要人数 / 階層情報を返す（カレンダー表示で利用）
  const siteIdsInRange = Array.from(new Set(headcountBySite.map((h) => h.jobSiteId)));
  const sitesInRange =
    siteIdsInRange.length > 0
      ? await prisma.jobSite.findMany({
          where: { id: { in: siteIdsInRange } },
          select: {
            id: true,
            siteCode: true,
            name: true,
            clientCode: true,
            clientName: true,
            requiredHeadcount: true,
            workCategory: true,
            belongings: true,
            siteMemo: true,
            genDoMen: true,
            mapUrl: true,
          },
        })
      : [];

  return NextResponse.json({
    staff,
    dailyHeadcounts: headcounts.map((h) => ({
      date: h.date,
      total: h._count.id,
    })),
    headcountBySite,
    unassignedAssignments,
    sitesInRange,
  });
}
