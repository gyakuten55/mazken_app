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

  // YYYY-MM-DD 形式・実在する日付・start <= end・最大日数のチェック
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    return NextResponse.json({ error: "日付形式が不正です (YYYY-MM-DD)" }, { status: 400 });
  }
  const startMs = Date.parse(startDate + "T00:00:00Z");
  const endMs = Date.parse(endDate + "T00:00:00Z");
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return NextResponse.json({ error: "日付形式が不正です" }, { status: 400 });
  }
  if (startMs > endMs) {
    return NextResponse.json(
      { error: "startDate は endDate 以前である必要があります" },
      { status: 400 },
    );
  }
  // カレンダーで一度に取得する範囲は最大 1 年（DoS / 取りすぎ防止）
  const MAX_RANGE_DAYS = 366;
  const rangeDays = Math.floor((endMs - startMs) / 86_400_000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `期間が長すぎます（最大 ${MAX_RANGE_DAYS} 日）` },
      { status: 400 },
    );
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
    // 議事録 §6: 個人(作業員)には金額（単価・加算手当）を返さない。
    // ただし、同じ現場のメンバーを表示するため、全スタッフの配置情報を（金額抜きで）返す。
    const sanitizedStaff = staff.map((s) => ({
      ...s,
      assignments: s.assignments.map((a) => ({
        ...a,
        dailyRateOverride: null,
        allowances: [],
        assignmentDays: a.assignmentDays.map((d) => ({ ...d, dailyRateOverride: null })),
      })),
    }));
    return NextResponse.json({
      staff: sanitizedStaff,
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

  // 車両の二重利用チェック（同日に別現場で同じ車が使われていないか）
  // 議事録 §7: 車両重複の警告
  const vehicleUsages = await prisma.assignmentDay.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: "scheduled",
      assignment: { vehicleId: { not: null } },
    },
    select: {
      date: true,
      assignment: { select: { vehicleId: true, jobSiteId: true } },
    },
  });

  type VehicleKey = string; // `${date}|${vehicleId}`
  const vehicleMap = new Map<VehicleKey, Set<number>>(); // Map<key, Set<jobSiteId>>
  const vehicleConflicts: { date: string; vehicleId: number }[] = [];

  for (const u of vehicleUsages) {
    const vid = u.assignment.vehicleId!;
    const key = `${u.date}|${vid}`;
    const sites = vehicleMap.get(key) ?? new Set<number>();
    sites.add(u.assignment.jobSiteId);
    vehicleMap.set(key, sites);
  }

  for (const [key, sites] of vehicleMap.entries()) {
    if (sites.size > 1) {
      const [date, vid] = key.split("|");
      vehicleConflicts.push({ date, vehicleId: parseInt(vid) });
    }
  }

  return NextResponse.json({
    staff,
    dailyHeadcounts: headcounts.map((h) => ({
      date: h.date,
      total: h._count.id,
    })),
    headcountBySite,
    unassignedAssignments,
    sitesInRange,
    vehicleConflicts,
  });
}
