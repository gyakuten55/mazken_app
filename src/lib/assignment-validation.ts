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

// 必須資格不足 / 作業区分不適合の警告（C-4）。
// missingQualifications: 現場の必須資格のうちスタッフが保有していない資格名の一覧。
// workCategoryMismatch: スタッフが現場の作業区分に対応不可なら該当区分の日本語名、対応可なら null。
export type QualificationWarning = {
  siteName: string;
  missingQualifications: string[];
  workCategoryMismatch: string | null;
};

export type AssignmentCheckResult = {
  conflicts: ConflictInfo[];
  insuranceWarning: InsuranceWarning | null;
  qualificationWarning: QualificationWarning | null;
  vehicleConflicts?: VehicleConflict[];
};

// 発注人数 超過/不足 警告（オーダー人数以上の配置を防ぐためのアラート用）
export type OrderHeadcountWarning = {
  date: string;
  orderHeadcount: number;
  projectedCount: number; // この保存後に scheduled になるスタッフ数
  overflow: number; // projected - order（>0 で過剰）
};

/**
 * 指定現場・指定日付に対し「この保存が完了すると scheduled が何名になるか」を計算し、
 * その日のオーダー人数（既存 AssignmentDay.orderHeadcount または今回提示された newOrderHeadcount）
 * を超過する日があれば警告を返す。
 *
 * @param newOrderHeadcount POST 時に画面から指定された「全日適用の初期値」。
 *                          既に存在する AssignmentDay.orderHeadcount があればそちらを優先。
 * @param addedStaffCount   今回の保存で同一現場・同一日に追加される配置スタッフ数（POST: 1、bulk: N）。
 * @param excludeAssignmentId PUT で自分自身を計上対象から外したい場合に渡す。
 */
export async function checkOrderHeadcountOverflow(args: {
  jobSiteId: number;
  dates: string[];
  addedStaffCount: number;
  newOrderHeadcount?: number | null;
  excludeAssignmentId?: number;
}): Promise<OrderHeadcountWarning[]> {
  const { jobSiteId, dates, addedStaffCount, newOrderHeadcount, excludeAssignmentId } = args;
  if (dates.length === 0 || addedStaffCount <= 0) return [];

  // 既存の scheduled な AssignmentDay を (site, date) でまとめる
  const existing = await prisma.assignmentDay.findMany({
    where: {
      date: { in: dates },
      status: "scheduled",
      assignment: {
        jobSiteId,
        ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
      },
    },
    select: { date: true, orderHeadcount: true },
  });

  type Agg = { current: number; order: number | null };
  const byDate = new Map<string, Agg>();
  for (const d of dates) byDate.set(d, { current: 0, order: null });
  for (const e of existing) {
    const agg = byDate.get(e.date);
    if (!agg) continue;
    agg.current += 1;
    if (e.orderHeadcount != null) {
      agg.order = agg.order == null ? e.orderHeadcount : Math.max(agg.order, e.orderHeadcount);
    }
  }

  const warnings: OrderHeadcountWarning[] = [];
  for (const [date, agg] of byDate) {
    // 既存オーダーが無ければ今回送られた初期値を採用
    const effectiveOrder = agg.order ?? newOrderHeadcount ?? null;
    if (effectiveOrder == null) continue;
    const projected = agg.current + addedStaffCount;
    if (projected > effectiveOrder) {
      warnings.push({
        date,
        orderHeadcount: effectiveOrder,
        projectedCount: projected,
        overflow: projected - effectiveOrder,
      });
    }
  }
  // 日付順に揃える（API レスポンスでの安定性のため）
  warnings.sort((a, b) => a.date.localeCompare(b.date));
  return warnings;
}

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
    return { conflicts: [], insuranceWarning: null, qualificationWarning: null };
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
          select: {
            insuranceType: true,
            hasShaho: true,
            hasKokuho: true,
            hasIchiriOyakata: true,
            name: true,
            // 作業区分の対応可否（C-4）
            canChikuro: true,
            canRegular: true,
            canSpot: true,
            // 保有資格（必須資格チェック用）
            staffQualifications: { include: { qualification: true } },
          },
        })
      : Promise.resolve(null),
    prisma.jobSite.findUnique({
      where: { id: jobSiteId },
      select: {
        requiredInsurance: true,
        name: true,
        // 作業区分（C-4）
        workCategory: true,
        // この現場の必須資格（isRequired=true のみ）
        qualificationBonuses: {
          where: { isRequired: true },
          include: { qualification: true },
        },
      },
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

  // 必須資格 / 作業区分チェック（C-4）。
  // staffId が null（未割当の枠確保）の場合はスタッフが居ないので判定不能 → skip（保険警告と同じ流儀）。
  let qualificationWarning: QualificationWarning | null = null;
  if (staff && jobSite) {
    // 必須資格: 現場の isRequired=true な資格のうち、スタッフが保有していないものを収集
    const heldQualificationIds = new Set(staff.staffQualifications.map((sq) => sq.qualificationId));
    const missingQualifications = jobSite.qualificationBonuses
      .filter((qb) => !heldQualificationIds.has(qb.qualificationId))
      .map((qb) => qb.qualification.name);

    // 作業区分: 現場の workCategory にスタッフが対応不可なら不適合
    const workCategoryLabel: Record<string, string> = {
      chikuro: "築炉工事",
      regular: "レギュラー",
      spot: "スポット",
    };
    let workCategoryMismatch: string | null = null;
    const cat = jobSite.workCategory;
    const canHandle =
      (cat === "chikuro" && staff.canChikuro) ||
      (cat === "regular" && staff.canRegular) ||
      (cat === "spot" && staff.canSpot);
    if (!canHandle && (cat === "chikuro" || cat === "regular" || cat === "spot")) {
      workCategoryMismatch = workCategoryLabel[cat] ?? cat;
    }

    if (missingQualifications.length > 0 || workCategoryMismatch) {
      qualificationWarning = {
        siteName: jobSite.name,
        missingQualifications,
        workCategoryMismatch,
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
    qualificationWarning,
    vehicleConflicts,
  };
}
