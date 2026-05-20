import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { createAssignmentSchema } from "@/lib/validations";
import { checkAssignmentConflicts, checkOrderHeadcountOverflow } from "@/lib/assignment-validation";
import { parseJsonBody, jsonBodyError } from "@/lib/api-json";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staffId");
  const jobSiteId = searchParams.get("jobSiteId");
  const date = searchParams.get("date");

  // staffロールは自分のスタッフIDで強制フィルタ
  const isStaffRole = auth.role === "staff" && auth.staffId;

  // If date+jobSiteId: return staff assigned to that site on that date
  if (date && jobSiteId) {
    if (isStaffRole) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    const assignmentDays = await prisma.assignmentDay.findMany({
      where: {
        date,
        status: "scheduled",
        assignment: { jobSiteId: parseInt(jobSiteId) },
      },
      include: {
        assignment: {
          include: {
            staff: { include: { branchOffice: true } },
            jobSite: true,
            vehicle: true,
          },
        },
      },
    });
    return NextResponse.json(assignmentDays);
  }

  const where: Record<string, unknown> = {};
  if (isStaffRole) {
    where.staffId = auth.staffId;
  } else if (staffId) {
    where.staffId = parseInt(staffId);
  }
  if (jobSiteId) where.jobSiteId = parseInt(jobSiteId);

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      staff: { include: { branchOffice: true } },
      jobSite: true,
      vehicle: true,
      assignmentDays: { orderBy: { date: "asc" } },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(assignments);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const body = await parseJsonBody(request);
  if (body === null) return jsonBodyError();
  const parsed = createAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const {
    staffId,
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

  // Generate individual day records（日曜も含む。休みは日別トグルで管理）
  const dates: string[] = [];
  const cur = new Date(startDate);
  const last = new Date(endDate);
  while (cur <= last) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }

  // --- Conflict & Insurance & Vehicle & Order-Headcount Check ---
  if (!force && dates.length > 0) {
    const [{ conflicts, insuranceWarning, vehicleConflicts }, orderHeadcountWarnings] =
      await Promise.all([
        checkAssignmentConflicts({
          staffId: staffId ?? null,
          jobSiteId,
          dates,
          vehicleId,
        }),
        // staffId が null（未割当の確保）は人数カウントに含めない
        checkOrderHeadcountOverflow({
          jobSiteId,
          dates,
          addedStaffCount: staffId != null ? 1 : 0,
          newOrderHeadcount: orderHeadcount ?? null,
        }),
      ]);
    if (
      conflicts.length > 0 ||
      insuranceWarning ||
      (vehicleConflicts && vehicleConflicts.length > 0) ||
      orderHeadcountWarnings.length > 0
    ) {
      return NextResponse.json(
        {
          hasWarnings: true,
          conflicts,
          insuranceWarning,
          vehicleConflicts: vehicleConflicts ?? [],
          orderHeadcountWarnings,
        },
        { status: 409 }
      );
    }
  }

  const assignment = await prisma.assignment.create({
    data: {
      staffId: staffId ?? null,
      jobSiteId,
      vehicleId: vehicleId ?? null,
      startDate,
      endDate,
      assignmentType: assignmentType || "commute",
      shiftType: shiftType || "day",
      startTime: startTime || "08:00",
      endTime: endTime || "18:00",
      dailyRateOverride: dailyRateOverride ?? null,
      belongings: belongings ?? null,
      contactName: contactName ?? null,
      contactTel: contactTel ?? null,
      transportation: transportation ?? null,
      notes,
      assignmentDays: {
        create: dates.map((date) => ({
          date,
          status: "scheduled",
          orderHeadcount: orderHeadcount ?? null,
        })),
      },
      ...(allowances && allowances.length > 0
        ? {
            allowances: {
              create: allowances.map((a) => ({
                name: a.name,
                amount: a.amount,
                category: a.category,
              })),
            },
          }
        : {}),
    },
    include: {
      staff: { include: { branchOffice: true } },
      jobSite: true,
      vehicle: true,
      assignmentDays: { orderBy: { date: "asc" } },
      allowances: true,
    },
  });

  return NextResponse.json(assignment, { status: 201 });
}
