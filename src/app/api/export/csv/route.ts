import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { csvExportSchema } from "@/lib/validations";
import { INSURANCE_TYPES, ASSIGNMENT_TYPES, type InsuranceType, type AssignmentType } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = csvExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const { startDate, endDate, branchOfficeIds, columns } = parsed.data;

  const where: Record<string, unknown> = {
    date: { gte: startDate, lte: endDate },
    status: "scheduled",
  };

  const assignmentDays = await prisma.assignmentDay.findMany({
    where,
    include: {
      assignment: {
        include: {
          staff: { include: { branchOffice: true } },
          jobSite: { include: { branchOffice: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }],
  });

  // 未割当配置は CSV 対象外
  let filtered = assignmentDays.filter((ad) => ad.assignment.staff != null);
  if (branchOfficeIds && branchOfficeIds.length > 0) {
    const ids = branchOfficeIds.map(Number);
    filtered = filtered.filter((ad) =>
      ids.includes(ad.assignment.staff!.branchOfficeId)
    );
  }

  // Build CSV
  const allColumns = [
    { key: "date", label: "日付" },
    { key: "staffCode", label: "社員コード" },
    { key: "staffName", label: "スタッフ名" },
    { key: "branchOffice", label: "営業所" },
    { key: "insuranceType", label: "保険種別" },
    { key: "siteCode", label: "現場コード" },
    { key: "siteName", label: "現場名" },
    { key: "clientName", label: "元請け" },
    { key: "assignmentType", label: "区分" },
    { key: "startTime", label: "開始時間" },
    { key: "endTime", label: "終了時間" },
  ];

  const selectedColumns = columns && columns.length > 0
    ? allColumns.filter((c) => columns.includes(c.key))
    : allColumns;

  const header = selectedColumns.map((c) => c.label).join(",");

  const rows = filtered.map((ad) => {
    const s = ad.assignment.staff!; // フィルタ済み
    const js = ad.assignment.jobSite;
    const a = ad.assignment;

    const data: Record<string, string> = {
      date: ad.date,
      staffCode: s.employeeCode,
      staffName: s.name,
      branchOffice: `${s.branchOffice.code}_${s.branchOffice.name}`,
      insuranceType: INSURANCE_TYPES[s.insuranceType as InsuranceType] || s.insuranceType,
      siteCode: js.siteCode,
      siteName: js.name,
      clientName: js.clientName || "",
      assignmentType: ASSIGNMENT_TYPES[a.assignmentType as AssignmentType] || a.assignmentType,
      startTime: a.startTime,
      endTime: a.endTime,
    };

    return selectedColumns
      .map((c) => {
        const val = data[c.key] || "";
        // Escape CSV fields with commas or quotes
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(",");
  });

  // UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF";
  const csv = BOM + header + "\n" + rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="matsken_export_${startDate}_${endDate}.csv"`,
    },
  });
}
