import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import {
  seedDailyPaymentsForDate,
  computeCumulativeBalances,
  calcPaymentTotal,
  calcOffsetTotal,
  calcTodayBalance,
} from "@/lib/payment-utils";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const amountField = z.number().int().min(-9_999_999).max(9_999_999);
const rowPatchSchema = z.object({
  staffId: z.number().int().positive(),
  site1Id: z.number().int().nullable().optional(),
  site1BaseFee: amountField.optional(),
  site1Driving: amountField.optional(),
  site1Holiday: amountField.optional(),
  site1Lift: amountField.optional(),
  site1Skill: amountField.optional(),
  site1Other: amountField.optional(),
  site1Additional: amountField.optional(),
  site2Id: z.number().int().nullable().optional(),
  site2BaseFee: amountField.optional(),
  site2Driving: amountField.optional(),
  site2Holiday: amountField.optional(),
  site2Lift: amountField.optional(),
  site2Skill: amountField.optional(),
  site2Other: amountField.optional(),
  site2Additional: amountField.optional(),
  safetyOffset: amountField.optional(),
  lodgingOffset: amountField.optional(),
  otherOffset: amountField.optional(),
  advanceOffset: amountField.optional(),
  notes: z.string().nullable().optional(),
});

const patchBodySchema = z.object({
  rows: z.array(rowPatchSchema).min(1).max(500),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { date } = await params;
  if (!datePattern.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const branchOfficeIdParam = searchParams.get("branchOfficeId");
  const branchOfficeId = branchOfficeIdParam ? Number(branchOfficeIdParam) : null;

  // 初回アクセス時の自動 seed
  await seedDailyPaymentsForDate(date);

  // 対象スタッフ一覧（active のみ、営業所フィルター）
  const staff = await prisma.staff.findMany({
    where: {
      isActive: true,
      ...(branchOfficeId ? { branchOfficeId } : {}),
    },
    orderBy: { employeeCode: "asc" },
    include: {
      branchOffice: { select: { id: true, name: true, code: true, color: true } },
      staffQualifications: {
        include: { qualification: { select: { name: true, category: true } } },
      },
    },
  });

  const staffIds = staff.map((s) => s.id);

  // 対象日の DailyPayment 一覧
  const dailyPayments = await prisma.dailyPayment.findMany({
    where: { date, staffId: { in: staffIds } },
    include: {
      site1: { select: { id: true, siteCode: true, name: true, clientName: true } },
      site2: { select: { id: true, siteCode: true, name: true, clientName: true } },
    },
  });
  const dpByStaff = new Map(dailyPayments.map((dp) => [dp.staffId, dp]));

  // 前日末までの累計残
  const priorBalances = await computeCumulativeBalances(staffIds, date, {
    exclusiveOfDate: true,
  });

  // 各行を組み立て
  const rows = staff.map((s) => {
    const dp = dpByStaff.get(s.id);
    const payload = dp
      ? {
          site1BaseFee: dp.site1BaseFee,
          site1Driving: dp.site1Driving,
          site1Holiday: dp.site1Holiday,
          site1Lift: dp.site1Lift,
          site1Skill: dp.site1Skill,
          site1Other: dp.site1Other,
          site1Additional: dp.site1Additional,
          site2BaseFee: dp.site2BaseFee,
          site2Driving: dp.site2Driving,
          site2Holiday: dp.site2Holiday,
          site2Lift: dp.site2Lift,
          site2Skill: dp.site2Skill,
          site2Other: dp.site2Other,
          site2Additional: dp.site2Additional,
          safetyOffset: dp.safetyOffset,
          lodgingOffset: dp.lodgingOffset,
          otherOffset: dp.otherOffset,
          advanceOffset: dp.advanceOffset,
        }
      : null;
    const todayBalance = payload ? calcTodayBalance(payload) : 0;
    const priorBalance = priorBalances.get(s.id) ?? 0;
    const cumulativeBalance = priorBalance + todayBalance;
    const hasLicense = s.staffQualifications.some(
      (sq) => sq.qualification.category === "license",
    );
    return {
      staff: {
        id: s.id,
        employeeCode: s.employeeCode,
        name: s.name,
        displayName: s.displayName,
        dailyRate: s.dailyRate,
        hasLicense,
        branchOffice: s.branchOffice,
      },
      dailyPayment: dp
        ? {
            ...dp,
            paymentTotal: calcPaymentTotal(dp),
            offsetTotal: calcOffsetTotal(dp),
            todayBalance,
          }
        : null,
      priorBalance,
      cumulativeBalance,
    };
  });

  return NextResponse.json({
    date,
    branchOfficeId,
    rows,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const { date } = await params;
  if (!datePattern.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Upsert each row
  for (const row of parsed.data.rows) {
    const { staffId, ...updatable } = row;
    await prisma.dailyPayment.upsert({
      where: { staffId_date: { staffId, date } },
      update: updatable,
      create: {
        staffId,
        date,
        ...updatable,
      },
    });
  }

  return NextResponse.json({ ok: true, count: parsed.data.rows.length });
}
