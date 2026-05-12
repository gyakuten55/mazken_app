import { prisma } from "@/lib/prisma";

export type ConflictInfo = { siteName: string; dates: string[] };

export type InsuranceWarning = {
  staffInsurance: string;
  siteRequirement: string;
  siteName: string;
};

export type VehicleConflict = {
  plateNumber: string;
  vehicleName: string | null;
  conflictingSiteName: string;
  dates: string[];
};

export type AssignmentCheckResult = {
  conflicts: ConflictInfo[];
  insuranceWarning: InsuranceWarning | null;
  vehicleConflicts?: VehicleConflict[];
};

/**
 * Assignment作成・割当時の競合（二重ブッキング）と保険種別ミスマッチを検査する。
 * POST /api/assignments と PUT /api/assignments/[id]（staffId変更時）で共有。
 *
 * @param excludeAssignmentId PUT時、自分自身の assignmentDay を競合扱いしないために渡す
 * @param vehicleId 指定された場合、同一日に同一車両が他の現場で使われていないかも検査
 */
export async function checkAssignmentConflicts(args: {
  staffId: number | null;
  jobSiteId: number;
  dates: string[];
  excludeAssignmentId?: number;
  vehicleId?: number | null;
}): Promise<AssignmentCheckResult> {
  const { staffId, jobSiteId, dates, excludeAssignmentId, vehicleId } = args;
  if (dates.length === 0) {
    return { conflicts: [], insuranceWarning: null };
  }

  const [conflictDays, staff, jobSite] = await Promise.all([
    staffId != null
      ? prisma.assignmentDay.findMany({
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
        })
      : Promise.resolve([]),
    staffId != null
      ? prisma.staff.findUnique({
          where: { id: staffId },
          select: { insuranceType: true, hasShaho: true, hasKokuho: true, hasIchiriOyakata: true, name: true },
        })
      : Promise.resolve(null),
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

  // 車両の二重利用チェック（同一日に同一車両が他の現場で使われている場合）
  let vehicleConflicts: VehicleConflict[] | undefined;
  if (vehicleId) {
    const vehicleConflictDays = await prisma.assignmentDay.findMany({
      where: {
        date: { in: dates },
        status: "scheduled",
        assignment: {
          vehicleId,
          // 同一現場の同一車両は OK（同じ車で複数人移動するため）
          NOT: { jobSiteId },
          ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
        },
      },
      include: {
        assignment: {
          include: {
            jobSite: { select: { name: true } },
            vehicle: { select: { plateNumber: true, name: true } },
          },
        },
      },
    });
    if (vehicleConflictDays.length > 0) {
      const grouped = new Map<string, VehicleConflict>();
      for (const d of vehicleConflictDays) {
        if (!d.assignment.vehicle) continue;
        const key = `${d.assignment.vehicle.plateNumber}|${d.assignment.jobSite.name}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.dates.push(d.date);
        } else {
          grouped.set(key, {
            plateNumber: d.assignment.vehicle.plateNumber,
            vehicleName: d.assignment.vehicle.name,
            conflictingSiteName: d.assignment.jobSite.name,
            dates: [d.date],
          });
        }
      }
      vehicleConflicts = Array.from(grouped.values());
    }
  }

  return {
    conflicts: Array.from(conflictSites.values()),
    insuranceWarning,
    vehicleConflicts,
  };
}
