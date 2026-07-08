import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError, canEditMoney } from "@/lib/api-auth";
import { bulkAssignmentSchema } from "@/lib/validations";
import { checkOrderHeadcountOverflow } from "@/lib/assignment-validation";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

export async function POST(request: NextRequest) {
  // 一括配置の新規作成は管理者・番頭のみ（スケジュール入力専用・個人は不可）
  const auth = await requireRole("admin", "office");
  if (isAuthError(auth)) return auth;
  // 議事録 §6: お金（単価・加算手当）は管理者のみ
  const editMoney = canEditMoney(auth.role);

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = bulkAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const {
    staffIds,
    jobSiteId,
    vehicleId,
    startDate,
    endDate,
    assignmentType,
    shiftType,
    startTime,
    endTime,
    dailyRateOverride,
    orderHeadcount,
    belongings,
    contactName,
    contactTel,
    transportation,
    notes,
    allowances,
    force,
  } = parsed.data;

  // Generate day records（日曜も含む。休みは日別トグルで管理）
  const dates: string[] = [];
  const cur = new Date(startDate);
  const last = new Date(endDate);
  while (cur <= last) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }

  // 競合・保険・車両重複チェック（force=false の場合）
  if (!force) {
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
    const conflictsByStaff = new Map<number, { staffName: string; sites: string[] }>();
    for (const c of conflictDays) {
      if (!c.assignment.staff) continue;
      const sid = c.assignment.staff.id;
      const siteName = c.assignment.jobSite.name;
      const entry = conflictsByStaff.get(sid) ?? { staffName: c.assignment.staff.name, sites: [] };
      if (!entry.sites.includes(siteName)) entry.sites.push(siteName);
      conflictsByStaff.set(sid, entry);
    }

    const site = await prisma.jobSite.findUnique({
      where: { id: jobSiteId },
      select: {
        requiredInsurance: true,
        name: true,
        // 作業区分 / 必須資格チェック用（C-4）
        workCategory: true,
        qualificationBonuses: {
          where: { isRequired: true },
          include: { qualification: true },
        },
      },
    });
    // 保険・必須資格・作業区分チェックで共通のスタッフ情報を 1 回で取得
    const staffList = await prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: {
        id: true,
        name: true,
        hasShaho: true,
        hasKokuho: true,
        canChikuro: true,
        canRegular: true,
        canSpot: true,
        staffQualifications: { include: { qualification: true } },
      },
    });

    let insuranceWarning: { siteRequirement: string; siteName: string; staffNames: string[] } | null = null;
    if (site?.requiredInsurance && site.requiredInsurance !== "any") {
      const mismatched = staffList
        .filter((s) =>
          (site.requiredInsurance === "company_only" && !s.hasShaho) ||
          (site.requiredInsurance === "national_only" && !s.hasKokuho),
        )
        .map((s) => s.name);
      if (mismatched.length > 0) {
        insuranceWarning = {
          siteRequirement: site.requiredInsurance,
          siteName: site.name,
          staffNames: mismatched,
        };
      }
    }

    // 必須資格不足 / 作業区分不適合チェック（C-4）。
    // 単一保存(POST /api/assignments)の qualificationWarning と整合する形に、
    // bulk では「該当スタッフ名一覧」を付与（保険警告の staffNames と同じ流儀）。
    let qualificationWarning:
      | {
          siteName: string;
          missingQualifications: string[]; // 不足が生じた資格名の集合（誰か 1 人でも不足していれば含む）
          workCategoryMismatch: string | null; // 作業区分に対応不可なスタッフが居れば該当区分名
          staffNames: string[]; // 資格不足 or 作業区分不適合に該当したスタッフ名
        }
      | null = null;
    if (site) {
      const requiredQualifications = site.qualificationBonuses; // isRequired=true のみ
      const workCategoryLabel: Record<string, string> = {
        chikuro: "築炉工事",
        regular: "レギュラー",
        spot: "スポット",
      };
      const cat = site.workCategory;
      const missingQualSet = new Set<string>();
      const affectedStaff = new Set<string>();
      let workCategoryMismatch: string | null = null;
      for (const s of staffList) {
        const heldIds = new Set(s.staffQualifications.map((sq) => sq.qualificationId));
        const lacking = requiredQualifications.filter((qb) => !heldIds.has(qb.qualificationId));
        const canHandle =
          (cat === "chikuro" && s.canChikuro) ||
          (cat === "regular" && s.canRegular) ||
          (cat === "spot" && s.canSpot);
        const catMismatch = !canHandle && (cat === "chikuro" || cat === "regular" || cat === "spot");
        if (lacking.length > 0 || catMismatch) {
          affectedStaff.add(s.name);
        }
        for (const qb of lacking) missingQualSet.add(qb.qualification.name);
        if (catMismatch) workCategoryMismatch = workCategoryLabel[cat] ?? cat;
      }
      if (affectedStaff.size > 0) {
        qualificationWarning = {
          siteName: site.name,
          missingQualifications: Array.from(missingQualSet),
          workCategoryMismatch,
          staffNames: Array.from(affectedStaff),
        };
      }
    }

    let vehicleConflicts: {
      plateNumber: string;
      vehicleName: string | null;
      conflictingSiteName: string;
      dates: string[];
    }[] = [];
    if (vehicleId) {
      const vConflicts = await prisma.assignmentDay.findMany({
        where: {
          date: { in: dates },
          status: "scheduled",
          assignment: { vehicleId, NOT: { jobSiteId } },
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
      const grouped = new Map<
        string,
        { plateNumber: string; vehicleName: string | null; conflictingSiteName: string; dates: string[] }
      >();
      for (const d of vConflicts) {
        if (!d.assignment.vehicle) continue;
        const key = `${d.assignment.vehicle.plateNumber}|${d.assignment.jobSite.name}`;
        const ex = grouped.get(key);
        if (ex) ex.dates.push(d.date);
        else
          grouped.set(key, {
            plateNumber: d.assignment.vehicle.plateNumber,
            vehicleName: d.assignment.vehicle.name,
            conflictingSiteName: d.assignment.jobSite.name,
            dates: [d.date],
          });
      }
      vehicleConflicts = Array.from(grouped.values());
    }

    // オーダー人数 超過チェック
    const orderHeadcountWarnings = await checkOrderHeadcountOverflow({
      jobSiteId,
      dates,
      addedStaffCount: staffIds.length,
      newOrderHeadcount: orderHeadcount ?? null,
    });

    if (
      conflictsByStaff.size > 0 ||
      insuranceWarning ||
      qualificationWarning ||
      vehicleConflicts.length > 0 ||
      orderHeadcountWarnings.length > 0
    ) {
      return NextResponse.json(
        {
          hasWarnings: true,
          conflicts: Array.from(conflictsByStaff.values()),
          insuranceWarning,
          qualificationWarning,
          vehicleConflicts,
          orderHeadcountWarnings,
        },
        { status: 409 },
      );
    }
  }

  // 加算手当=お金なので管理者のみ。非管理者は空にする。
  const cleanAllowances = editMoney
    ? (allowances ?? []).filter((a) => a.name.trim() && a.amount > 0)
    : [];
  // 各スタッフに適用する手当を求めるヘルパ。
  // targetStaffIds が空 / 未指定の手当は全員に適用、指定されているならそのスタッフだけ。
  function allowancesFor(staffId: number) {
    return cleanAllowances.filter((al) => {
      const targets = al.targetStaffIds;
      if (!targets || targets.length === 0) return true;
      return targets.includes(staffId);
    });
  }

  // Turso などリモート DB ではレイテンシでデフォルト 5 秒タイムアウトに収まらない。
  const results = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const staffId of staffIds) {
      const staffAllowances = allowancesFor(staffId);
      const a = await tx.assignment.create({
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
          dailyRateOverride: editMoney ? (dailyRateOverride ?? null) : null,
          belongings: belongings ?? null,
          contactName: contactName ?? null,
          contactTel: contactTel ?? null,
          transportation: transportation ?? null,
          notes: notes ?? null,
          assignmentDays: {
            create: dates.map((date) => ({
              date,
              status: "scheduled",
              orderHeadcount: orderHeadcount ?? null,
            })),
          },
          ...(staffAllowances.length > 0
            ? {
                allowances: {
                  create: staffAllowances.map((al) => ({
                    name: al.name.trim(),
                    amount: al.amount,
                    category: al.category,
                  })),
                },
              }
            : {}),
        },
      });
      created.push(a);
    }
    return created;
  }, { timeout: 30000, maxWait: 10000 });

  return NextResponse.json(
    {
      created: results.length,
      assignmentIds: results.map((r) => r.id),
    },
    { status: 201 },
  );
}
