import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isAuthError } from "@/lib/api-auth";
import { bulkAssignmentSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await requireRole("admin", "manager", "office");
  if (isAuthError(auth)) return auth;

  const body = await request.json();
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
      select: { requiredInsurance: true, name: true },
    });
    let insuranceWarning: { siteRequirement: string; siteName: string; staffNames: string[] } | null = null;
    if (site?.requiredInsurance && site.requiredInsurance !== "any") {
      const staffList = await prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, name: true, hasShaho: true, hasKokuho: true },
      });
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

    if (conflictsByStaff.size > 0 || insuranceWarning || vehicleConflicts.length > 0) {
      return NextResponse.json(
        {
          hasWarnings: true,
          conflicts: Array.from(conflictsByStaff.values()),
          insuranceWarning,
          vehicleConflicts,
        },
        { status: 409 },
      );
    }
  }

  const cleanAllowances = (allowances ?? []).filter((a) => a.name.trim() && a.amount > 0);
  const results = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const staffId of staffIds) {
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
          dailyRateOverride: dailyRateOverride ?? null,
          belongings: belongings ?? null,
          contactName: contactName ?? null,
          contactTel: contactTel ?? null,
          transportation: transportation ?? null,
          notes: notes ?? null,
          assignmentDays: { create: dates.map((date) => ({ date, status: "scheduled" })) },
          ...(cleanAllowances.length > 0
            ? {
                allowances: {
                  create: cleanAllowances.map((al) => ({
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
  });

  return NextResponse.json(
    {
      created: results.length,
      assignmentIds: results.map((r) => r.id),
    },
    { status: 201 },
  );
}
