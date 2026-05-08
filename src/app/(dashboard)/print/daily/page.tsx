import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ASSIGNMENT_TYPES } from "@/lib/constants";
import { PrintButton } from "@/components/print/print-button";
import { PageHeader } from "@/components/layout/page-header";
import { getHolidayName } from "@/lib/holidays";

export default async function PrintDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam || format(new Date(), "yyyy-MM-dd");
  const holiday = getHolidayName(date);
  const dateDisplay = format(new Date(date + "T00:00:00"), "yyyy年M月d日(E)", { locale: ja })
    + (holiday ? ` 【${holiday}】` : "");

  const assignmentDays = await prisma.assignmentDay.findMany({
    where: { date, status: "scheduled" },
    include: {
      assignment: {
        include: {
          staff: {
            include: {
              branchOffice: true,
              staffQualifications: { include: { qualification: true } },
            },
          },
          jobSite: { include: { branchOffice: true } },
        },
      },
    },
  });

  type StaffEntry = {
    employeeCode: string;
    name: string;
    phone: string | null;
    type: string;
    startTime: string;
    endTime: string;
    branchOfficeName: string;
    insuranceType: string;
    qualifications: string[];
  };

  const siteMap = new Map<number, {
    site: typeof assignmentDays[0]["assignment"]["jobSite"];
    staff: StaffEntry[];
  }>();

  // 未割当配置は日報印刷の対象外
  const assignedDays = assignmentDays.filter((ad) => ad.assignment.staff != null);
  for (const ad of assignedDays) {
    const staff = ad.assignment.staff!;
    const site = ad.assignment.jobSite;
    if (!siteMap.has(site.id)) {
      siteMap.set(site.id, { site, staff: [] });
    }
    siteMap.get(site.id)!.staff.push({
      employeeCode: staff.employeeCode,
      name: staff.name,
      phone: staff.phone,
      type: ad.assignment.assignmentType,
      startTime: ad.startTime || ad.assignment.startTime,
      endTime: ad.endTime || ad.assignment.endTime,
      branchOfficeName: staff.branchOffice.name,
      insuranceType: staff.insuranceType,
      qualifications: staff.staffQualifications.map(
        (sq) => sq.qualification.name
      ),
    });
  }

  const siteEntries = Array.from(siteMap.values());
  const totalStaff = assignedDays.length;

  // Branch summary
  const branchSummary = new Map<string, number>();
  for (const ad of assignedDays) {
    const bn = ad.assignment.staff!.branchOffice.name;
    branchSummary.set(bn, (branchSummary.get(bn) || 0) + 1);
  }

  // Assignment type summary
  const commuteCount = assignedDays.filter((ad) => ad.assignment.assignmentType === "commute").length;
  const businessTripCount = assignedDays.filter((ad) => ad.assignment.assignmentType === "business_trip").length;

  return (
    <>
      {/* ===== 画面表示用 ===== */}
      <div className="print:hidden">
        <PageHeader
          breadcrumbs={[
            { label: "ホーム", href: "/dashboard" },
            { label: "印刷" },
            { label: "日報" },
          ]}
          title="配置日報"
          action={
            <div className="flex items-center gap-2 flex-wrap">
              <form className="flex items-center gap-2">
                <input
                  type="date"
                  name="date"
                  defaultValue={date}
                  className="h-9 rounded-md border border-input px-3 text-sm"
                />
                <Button type="submit" variant="outline" size="sm">表示</Button>
              </form>
              <PrintButton />
            </div>
          }
        />
        <div className="px-4 md:px-6 py-6">
          <div className="bg-card rounded-xl border shadow-sm max-w-5xl overflow-hidden">
            {/* Screen summary header */}
            <div className="px-4 md:px-6 py-4 border-b bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-base md:text-lg font-bold">{dateDisplay}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>総出動 <strong className="text-primary">{totalStaff}名</strong></span>
                  <span>現場数 <strong>{siteEntries.length}</strong></span>
                  <span>通い <strong>{commuteCount}名</strong></span>
                  {businessTripCount > 0 && (
                    <span className="text-amber-700">出張 <strong>{businessTripCount}名</strong></span>
                  )}
                </div>
              </div>
              {branchSummary.size > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {Array.from(branchSummary.entries()).map(([name, count]) => (
                    <span key={name}>{name}: {count}名</span>
                  ))}
                </div>
              )}
            </div>

            {siteEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">この日の配置はありません</p>
            ) : (
              <div className="divide-y">
                {siteEntries.map(({ site, staff }, idx) => (
                  <div key={site.id}>
                    {/* Site header */}
                    <div className="px-4 md:px-6 py-3 bg-muted/20 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                          <span className="font-semibold">{site.name}</span>
                          <span className="text-xs text-muted-foreground">{site.siteCode}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                          {site.clientName && <span>元請: {site.clientName}</span>}
                          {site.address && <span>{site.address}</span>}
                          {site.transportation && <span>交通: {site.transportation}</span>}
                        </div>
                        {site.contactName1 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            連絡先: {site.contactName1} {site.contactTel1}
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-bold shrink-0">{staff.length}名</span>
                    </div>
                    {/* Staff rows */}
                    <div className="divide-y divide-border/50">
                      {staff.map((s, i) => (
                        <div
                          key={i}
                          className={`px-4 md:px-6 py-2 grid grid-cols-[1.5rem_1fr_auto] md:grid-cols-[2rem_1fr_auto] gap-2 text-sm items-start ${
                            s.type === "business_trip" ? "bg-amber-50/60" : ""
                          }`}
                        >
                          <span className="text-xs text-muted-foreground pt-0.5">{i + 1}</span>
                          <div>
                            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-muted-foreground">{s.employeeCode}</span>
                              <span className="text-[10px] px-1.5 py-px rounded bg-muted">
                                {s.insuranceType === "company" ? "社保" : "国保"}
                              </span>
                              <span className={`text-[10px] px-1.5 py-px rounded font-medium ${
                                s.type === "business_trip"
                                  ? "bg-amber-200 text-amber-800"
                                  : "bg-muted"
                              }`}>
                                {ASSIGNMENT_TYPES[s.type as keyof typeof ASSIGNMENT_TYPES]}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                              <span>{s.branchOfficeName}</span>
                              {s.phone && <span>TEL: {s.phone}</span>}
                              {s.qualifications.length > 0 && (
                                <span>資格: {s.qualifications.join(", ")}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                            {s.startTime}〜{s.endTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 印刷専用レイアウト ===== */}
      <div className="print-form hidden print:block">
        <style>{`
          @media print {
            @page { size: A4 landscape; margin: 8mm; }
          }
          .dr-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .dr-table th, .dr-table td { border: 1px solid #444; padding: 2px 5px; vertical-align: top; }
          .dr-table th { background: #eee; font-weight: 600; text-align: center; white-space: nowrap; font-size: 9px; }
          .dr-site-name { font-weight: 700; font-size: 11px; }
          .dr-sub { font-size: 8px; color: #555; }
          .dr-total td { background: #eee; font-weight: 700; }
          .dr-trip { background: #fef9c3; }
          .dr-trip-badge { background: #f59e0b; color: #fff; padding: 0 4px; border-radius: 2px; font-size: 8px; font-weight: 700; }
        `}</style>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>配置日報</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{dateDisplay}</div>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4, color: "#444" }}>
          <span>株式会社マツケン</span>
          <span>
            総出動: {totalStaff}名 / {siteEntries.length}現場
            <span style={{ marginLeft: 8 }}>[通い:{commuteCount}名 / 出張:{businessTripCount}名]</span>
            {branchSummary.size > 0 && (
              <span style={{ marginLeft: 12 }}>
                ({Array.from(branchSummary.entries()).map(([n, c]) => `${n}:${c}名`).join("  ")})
              </span>
            )}
          </span>
          <span>出力: {format(new Date(), "yyyy/MM/dd HH:mm")}</span>
        </div>

        {/* Main table */}
        <table className="dr-table">
          <thead>
            <tr>
              <th style={{ width: 22 }}>No</th>
              <th style={{ width: 130 }}>現場名</th>
              <th style={{ width: 55 }}>元請け</th>
              <th style={{ width: 40 }}>担当</th>
              <th style={{ width: 35 }}>人数</th>
              <th style={{ width: 35 }}>コード</th>
              <th style={{ width: 90 }}>作業員名</th>
              <th style={{ width: 35 }}>種別</th>
              <th style={{ width: 35 }}>区分</th>
              <th style={{ width: 55 }}>時間</th>
              <th style={{ width: 70 }}>TEL</th>
              <th>保有資格</th>
            </tr>
          </thead>
          <tbody>
            {siteEntries.map(({ site, staff }, siteIdx) =>
              staff.map((s, staffIdx) => (
                <tr key={`${site.id}-${staffIdx}`} className={s.type === "business_trip" ? "dr-trip" : ""}>
                  {staffIdx === 0 && (
                    <>
                      <td rowSpan={staff.length} style={{ textAlign: "center", fontWeight: 700 }}>
                        {siteIdx + 1}
                      </td>
                      <td rowSpan={staff.length}>
                        <span className="dr-site-name">{site.name}</span>
                        <br />
                        <span className="dr-sub">
                          {site.siteCode}
                          {site.address ? ` / ${site.address}` : ""}
                        </span>
                        {site.contactName1 && (
                          <>
                            <br />
                            <span className="dr-sub">
                              連絡: {site.contactName1} {site.contactTel1 || ""}
                            </span>
                          </>
                        )}
                        {site.transportation && (
                          <>
                            <br />
                            <span className="dr-sub">交通: {site.transportation}</span>
                          </>
                        )}
                      </td>
                      <td rowSpan={staff.length} style={{ fontSize: 9 }}>
                        {site.clientName || ""}
                      </td>
                      <td rowSpan={staff.length} style={{ textAlign: "center", fontSize: 9 }}>
                        {site.branchOffice.name}
                      </td>
                      <td rowSpan={staff.length} style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                        {staff.length}
                      </td>
                    </>
                  )}
                  <td style={{ textAlign: "center", fontSize: 9, fontFamily: "monospace" }}>
                    {s.employeeCode}
                  </td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td style={{ textAlign: "center", fontSize: 9 }}>
                    {s.insuranceType === "company" ? "社保" : "国保"}
                  </td>
                  <td style={{ textAlign: "center", fontSize: 9, fontWeight: s.type === "business_trip" ? 700 : 400 }}>
                    {s.type === "business_trip" ? (
                      <span className="dr-trip-badge">出張</span>
                    ) : (
                      ASSIGNMENT_TYPES[s.type as keyof typeof ASSIGNMENT_TYPES]
                    )}
                  </td>
                  <td style={{ textAlign: "center", fontSize: 9, whiteSpace: "nowrap" }}>
                    {s.startTime}〜{s.endTime}
                  </td>
                  <td style={{ fontSize: 9 }}>
                    {s.phone || ""}
                  </td>
                  <td style={{ fontSize: 8, lineHeight: 1.3 }}>
                    {s.qualifications.length > 0 ? s.qualifications.join("、") : ""}
                  </td>
                </tr>
              ))
            )}
            {/* Total */}
            <tr className="dr-total">
              <td colSpan={4} style={{ textAlign: "right" }}>合計</td>
              <td style={{ textAlign: "center", fontSize: 14 }}>{totalStaff}</td>
              <td colSpan={7}></td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 8, color: "#999", marginTop: 8 }}>
          株式会社マツケン 配置管理システム
        </div>
      </div>
    </>
  );
}
