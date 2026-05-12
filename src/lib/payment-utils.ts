import { prisma } from "./prisma";
import { RESIDENCE_DAILY_COST } from "./constants";

// 寮区分から、現場の日給上書き（旧寮/新寮/通い）を選び取るユーティリティ
function pickJobSiteDailyRateOverride(
  residenceType: string | null | undefined,
  site: {
    dailyRateDorm1: number | null;
    dailyRateDorm2: number | null;
    dailyRateCommuter: number | null;
  } | null,
): number | null {
  if (!site) return null;
  switch (residenceType) {
    case "dorm1":
      return site.dailyRateDorm1;
    case "dorm2":
      return site.dailyRateDorm2;
    case "commuter":
      return site.dailyRateCommuter;
    default:
      return null;
  }
}

function residenceDailyCost(residenceType: string | null | undefined): number {
  if (!residenceType) return 0;
  return RESIDENCE_DAILY_COST[residenceType as keyof typeof RESIDENCE_DAILY_COST] ?? 0;
}

/**
 * 日計表の金額計算ユーティリティ。
 * DB には当日残・累計残を保存せず、都度計算することで編集時のリップル更新を回避する。
 */

export type DailyPaymentNumbers = {
  site1BaseFee: number;
  site1Driving: number;
  site1Holiday: number;
  site1Lift: number;
  site1Skill: number;
  site1Other: number;
  site1Additional: number;
  site2BaseFee: number;
  site2Driving: number;
  site2Holiday: number;
  site2Lift: number;
  site2Skill: number;
  site2Other: number;
  site2Additional: number;
  safetyOffset: number;
  lodgingOffset: number;
  otherOffset: number;
  advanceOffset: number;
};

export function calcPaymentTotal(dp: DailyPaymentNumbers): number {
  return (
    dp.site1BaseFee +
    dp.site1Driving +
    dp.site1Holiday +
    dp.site1Lift +
    dp.site1Skill +
    dp.site1Other +
    dp.site1Additional +
    dp.site2BaseFee +
    dp.site2Driving +
    dp.site2Holiday +
    dp.site2Lift +
    dp.site2Skill +
    dp.site2Other +
    dp.site2Additional
  );
}

export function calcOffsetTotal(dp: DailyPaymentNumbers): number {
  return dp.safetyOffset + dp.lodgingOffset + dp.otherOffset + dp.advanceOffset;
}

export function calcTodayBalance(dp: DailyPaymentNumbers): number {
  return calcPaymentTotal(dp) - calcOffsetTotal(dp);
}

/**
 * 指定日までの累計残高をスタッフごとに計算して返す。
 * cumulativeBalance(staff, date) = openingBalance + Σ(todayBalance) where
 *   openingBalanceDate <= record.date <= date (endInclusive)
 * 期首残高日未設定のスタッフは全期間を集計対象とする。
 */
export async function computeCumulativeBalances(
  staffIds: number[],
  upToDate: string, // YYYY-MM-DD 含む
  options?: { exclusiveOfDate?: boolean },
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (staffIds.length === 0) return result;

  const staff = await prisma.staff.findMany({
    where: { id: { in: staffIds } },
    select: {
      id: true,
      openingBalance: true,
      openingBalanceDate: true,
    },
  });

  // For date comparison: exclusive means we sum records STRICTLY before upToDate
  const dateFilter = options?.exclusiveOfDate
    ? { lt: upToDate }
    : { lte: upToDate };

  const payments = await prisma.dailyPayment.findMany({
    where: {
      staffId: { in: staffIds },
      date: dateFilter,
    },
    select: {
      staffId: true,
      date: true,
      site1BaseFee: true,
      site1Driving: true,
      site1Holiday: true,
      site1Lift: true,
      site1Skill: true,
      site1Other: true,
      site1Additional: true,
      site2BaseFee: true,
      site2Driving: true,
      site2Holiday: true,
      site2Lift: true,
      site2Skill: true,
      site2Other: true,
      site2Additional: true,
      safetyOffset: true,
      lodgingOffset: true,
      otherOffset: true,
      advanceOffset: true,
    },
  });

  // Group by staffId, filter by openingBalanceDate per staff
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  for (const sid of staffIds) {
    const s = staffMap.get(sid);
    const opening = s?.openingBalance ?? 0;
    result.set(sid, opening);
  }

  for (const p of payments) {
    const s = staffMap.get(p.staffId);
    if (!s) continue;
    // Skip records before openingBalanceDate
    if (s.openingBalanceDate && p.date < s.openingBalanceDate) continue;
    const today = calcTodayBalance(p);
    result.set(p.staffId, (result.get(p.staffId) ?? 0) + today);
  }

  return result;
}

/**
 * 指定日の DailyPayment 下書きを AssignmentDay から自動生成する。
 * 既に DailyPayment が存在するスタッフは触らない（ユーザー編集を尊重）。
 *
 * 加算ルール:
 *   - baseFee: AssignmentDay.dailyRateOverride > Assignment.dailyRateOverride
 *              > 現場別寮区分日給（dailyRateDorm1/2/Commuter） > Staff.dailyRate
 *   - site*Skill: 配置スタッフ保有資格 ∩ 現場の資格別加算
 *   - site*Other: 配置単位の AssignmentAllowance.category="other" の合計
 *   - site*Lift: 0 固定（議事録要件で UI 削除予定。互換のため枠は維持）
 *   - site*Skill には特殊枠 AssignmentAllowance.category="special" も加算
 *   - lodgingOffset: 寮区分（旧寮 1950 / 新寮 1350 / 通い 0）× 1 日（既存値があれば加算しない）
 */
export async function seedDailyPaymentsForDate(date: string): Promise<void> {
  // その日の scheduled な配置日をすべて取得（保有資格と現場の資格別加算、配置単位の手当も同時取得）
  const assignmentDays = await prisma.assignmentDay.findMany({
    where: { date, status: "scheduled" },
    include: {
      assignment: {
        include: {
          staff: {
            select: {
              id: true,
              dailyRate: true,
              residenceType: true,
              isActive: true,
              staffQualifications: { select: { qualificationId: true } },
            },
          },
          jobSite: {
            select: {
              id: true,
              dailyRateDorm1: true,
              dailyRateDorm2: true,
              dailyRateCommuter: true,
              qualificationBonuses: { select: { qualificationId: true, bonusAmount: true } },
            },
          },
          allowances: { select: { amount: true, category: true } },
        },
      },
    },
  });

  // スタッフごとに配置を集約（最大 2 現場まで）
  type SitePair = {
    site1?: { jobSiteId: number; baseFee: number; skillBonus: number; otherBonus: number };
    site2?: { jobSiteId: number; baseFee: number; skillBonus: number; otherBonus: number };
    residenceType: string | null;
    extras: number;
  };
  const byStaff = new Map<number, SitePair>();

  for (const ad of assignmentDays) {
    // 未割当配置は支払計算の対象外
    if (!ad.assignment.staff || !ad.assignment.staffId) continue;
    if (!ad.assignment.staff.isActive) continue;
    const staffId = ad.assignment.staffId;
    const jobSiteId = ad.assignment.jobSiteId;
    const residenceType = ad.assignment.staff.residenceType;

    // 現場別寮区分日給を優先順で評価
    const siteDormRate = pickJobSiteDailyRateOverride(residenceType, ad.assignment.jobSite);
    const baseFee =
      ad.dailyRateOverride ??
      ad.assignment.dailyRateOverride ??
      siteDormRate ??
      ad.assignment.staff.dailyRate ??
      0;

    // 特殊技能料金: スタッフ保有資格 ∩ 現場の資格別加算 の合計
    const heldQualIds = new Set(
      ad.assignment.staff.staffQualifications.map((sq) => sq.qualificationId)
    );
    const qualSkillBonus = ad.assignment.jobSite.qualificationBonuses
      .filter((b) => heldQualIds.has(b.qualificationId))
      .reduce((sum, b) => sum + b.bonusAmount, 0);

    // 配置単位の手当（路内・出張・とび・食事 …）を special / other に振り分け
    const specialAllowance = ad.assignment.allowances
      .filter((a) => a.category === "special")
      .reduce((sum, a) => sum + a.amount, 0);
    const otherAllowance = ad.assignment.allowances
      .filter((a) => a.category === "other")
      .reduce((sum, a) => sum + a.amount, 0);

    const skillBonus = qualSkillBonus + specialAllowance;
    const otherBonus = otherAllowance;

    const existing = byStaff.get(staffId) ?? { extras: 0, residenceType };
    if (!existing.site1) {
      existing.site1 = { jobSiteId, baseFee, skillBonus, otherBonus };
    } else if (!existing.site2) {
      existing.site2 = { jobSiteId, baseFee, skillBonus, otherBonus };
    } else {
      existing.extras += 1;
    }
    byStaff.set(staffId, existing);
  }

  // 既存の DailyPayment を一括取得
  const existingRows = await prisma.dailyPayment.findMany({
    where: { date, staffId: { in: Array.from(byStaff.keys()) } },
    select: { staffId: true },
  });
  const existingStaffIds = new Set(existingRows.map((r) => r.staffId));

  // 存在しないスタッフ分を create
  // 安全会費は配置があった日の初期値として 500 円を自動計上
  const DEFAULT_SAFETY_OFFSET = 500;
  const toCreate: Array<{
    date: string;
    staffId: number;
    site1Id: number | null;
    site1BaseFee: number;
    site1Skill: number;
    site1Other: number;
    site2Id: number | null;
    site2BaseFee: number;
    site2Skill: number;
    site2Other: number;
    safetyOffset: number;
    lodgingOffset: number;
    notes: string | null;
  }> = [];

  for (const [staffId, pair] of byStaff) {
    if (existingStaffIds.has(staffId)) continue;
    const lodging = residenceDailyCost(pair.residenceType);
    toCreate.push({
      date,
      staffId,
      site1Id: pair.site1?.jobSiteId ?? null,
      site1BaseFee: pair.site1?.baseFee ?? 0,
      site1Skill: pair.site1?.skillBonus ?? 0,
      site1Other: pair.site1?.otherBonus ?? 0,
      site2Id: pair.site2?.jobSiteId ?? null,
      site2BaseFee: pair.site2?.baseFee ?? 0,
      site2Skill: pair.site2?.skillBonus ?? 0,
      site2Other: pair.site2?.otherBonus ?? 0,
      safetyOffset: DEFAULT_SAFETY_OFFSET,
      lodgingOffset: lodging,
      notes: pair.extras > 0 ? `3件以上の配置あり（+${pair.extras}件は未反映）` : null,
    });
  }

  if (toCreate.length > 0) {
    await prisma.dailyPayment.createMany({
      data: toCreate,
    });
  }

  // 配置が無くなったスタッフの自動生成レコードを掃除する。
  // 「シード由来のレコードかどうか」は判別困難なので、その日の調整系フィールド
  // (advanceOffset / otherOffset / notes) が手付かずの行を削除候補とする。
  // 配置を消した直後に日計表に残り続ける問題への対応。
  const staffIdsWithAssignments = Array.from(byStaff.keys());
  await prisma.dailyPayment.deleteMany({
    where: {
      date,
      ...(staffIdsWithAssignments.length > 0
        ? { staffId: { notIn: staffIdsWithAssignments } }
        : {}),
      // 手入力された明示的な調整が残っていれば保持する
      advanceOffset: 0,
      otherOffset: 0,
      OR: [{ notes: null }, { notes: "" }],
    },
  });
}
