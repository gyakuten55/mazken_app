import { prisma } from "@/lib/prisma";

export type ConflictInfo = { siteName: string; dates: string[] };

export type InsuranceWarning = {
  staffInsurance: string;
  siteRequirement: string;
  siteName: string;
};

export type AssignmentCheckResult = {
  conflicts: ConflictInfo[];
  insuranceWarning: InsuranceWarning | null;
};

/**
 * Assignment作成・割当時の競合（二重ブッキング）と保険種別ミスマッチを検査する。
 * POST /api/assignments と PUT /api/assignments/[id]（staffId変更時）で共有。
 *
 * @param excludeAssignmentId PUT時、自分自身の assignmentDay を競合扱いしないために渡す
 */
export async function checkAssignmentConflicts(args: {
  staffId: number;
  jobSiteId: number;
  dates: string[];
  excludeAssignmentId?: number;
}): Promise<AssignmentCheckResult> {
  const { staffId, jobSiteId, dates, excludeAssignmentId } = args;
  if (dates.length === 0) {
    return { conflicts: [], insuranceWarning: null };
  }

  const [conflictDays, staff, jobSite] = await Promise.all([
    prisma.assignmentDay.findMany({
      where: {
        date: { in: dates },
        status: "scheduled",
        assignment: {
          staffId,
          ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
        },
      },
      include: {
        assignment: {
          include: { jobSite: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.staff.findUnique({
      where: { id: staffId },
      select: { insuranceType: true, hasShaho: true, hasKokuho: true, hasIchiriOyakata: true, name: true },
    }),
    prisma.jobSite.findUnique({
      where: { id: jobSiteId },
      select: { requiredInsurance: true, name: true },
    }),
  ]);

  const conflictSites = new Map<number, ConflictInfo>();
  for (const c of conflictDays) {
    const siteId = c.assignment.jobSite.id;
    const existing = conflictSites.get(siteId);
    if (existing) {
      existing.dates.push(c.date);
    } else {
      conflictSites.set(siteId, {
        siteName: c.assignment.jobSite.name,
        dates: [c.date],
      });
    }
  }

  let insuranceWarning: InsuranceWarning | null = null;
  if (staff && jobSite && jobSite.requiredInsurance && jobSite.requiredInsurance !== "any") {
    // 新スキーマ（3 Bool）ベースで判定
    const mismatch =
      (jobSite.requiredInsurance === "company_only" && !staff.hasShaho) ||
      (jobSite.requiredInsurance === "national_only" && !staff.hasKokuho);
    if (mismatch) {
      insuranceWarning = {
        staffInsurance: staff.insuranceType,
        siteRequirement: jobSite.requiredInsurance,
        siteName: jobSite.name,
      };
    }
  }

  return { conflicts: Array.from(conflictSites.values()), insuranceWarning };
}
