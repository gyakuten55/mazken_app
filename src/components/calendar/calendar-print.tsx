"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { format, addDays, parseISO, startOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatDateISO, isSunday, isWeekend } from "@/lib/date-utils";
import { getHolidayName } from "@/lib/holidays";
import type { StaffRow, Assignment } from "./types";

type SiteStaffEntry = {
  staffId: number;
  staffName: string;
  branchColor: string;
  shiftType: string;
  assignment: Assignment;
};

type SiteRowData = {
  id: number;
  name: string;
  siteCode: string;
  clientName: string | null;
  branchOffice: { color: string; name: string };
  staffByDate: Map<string, SiteStaffEntry[]>;
};

type Props = {
  viewMode: "staff" | "site";
  initialStart: string;
  initialEnd: string;
  branchOfficeIds: number[];
  onClose: () => void;
};

function buildDates(start: string, end: string): Date[] {
  const dates: Date[] = [];
  let current = parseISO(start);
  const last = parseISO(end);
  while (current <= last) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function buildSiteRows(staffRows: StaffRow[]): SiteRowData[] {
  const siteMap = new Map<number, SiteRowData>();
  for (const staff of staffRows) {
    for (const assignment of staff.assignments) {
      const site = assignment.jobSite;
      if (!siteMap.has(site.id)) {
        siteMap.set(site.id, {
          id: site.id,
          name: site.name,
          siteCode: site.siteCode,
          clientName: site.clientName ?? null,
          branchOffice: site.branchOffice,
          staffByDate: new Map(),
        });
      }
      const row = siteMap.get(site.id)!;
      for (const day of assignment.assignmentDays) {
        if (day.status !== "scheduled") continue;
        if (!row.staffByDate.has(day.date)) row.staffByDate.set(day.date, []);
        row.staffByDate.get(day.date)!.push({
          staffId: staff.id,
          staffName: staff.displayName || staff.name,
          branchColor: staff.branchOffice.color,
          shiftType: assignment.shiftType || "day",
          assignment,
        });
      }
    }
  }
  return Array.from(siteMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Snap to 1/5/10/15/20/25 start within the same month, then add N days
function snapToCycleStart(base: Date, cycleDays: number): { start: Date; end: Date } {
  const day = base.getDate();
  const snapPoints = [1, 5, 10, 15, 20, 25];
  let snappedDay = 1;
  for (const p of snapPoints) {
    if (day >= p) snappedDay = p;
  }
  const start = new Date(base.getFullYear(), base.getMonth(), snappedDay);
  const end = addDays(start, cycleDays - 1);
  return { start, end };
}

export function CalendarPrint({ viewMode, initialStart, initialEnd, branchOfficeIds, onClose }: Props) {
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteDisplay, setSiteDisplay] = useState<"count" | "names">("count");
  const [paperSize, setPaperSize] = useState<"a3" | "a4">("a3");

  // Apply @page rule based on selected paper size
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-calendar-print-page", "");
    styleEl.textContent = `@media print { @page { size: ${paperSize === "a3" ? "A3" : "A4"} landscape; margin: 6mm; } }`;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [paperSize]);

  // Fetch data for the selected range
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    if (branchOfficeIds.length > 0) {
      params.set("branchOfficeIds", branchOfficeIds.join(","));
    }
    fetch(`/api/calendar?${params}`)
      .then((r) => r.json())
      .then((data) => setStaffRows(data.staff))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate, branchOfficeIds]);

  const dates = useMemo(() => buildDates(startDate, endDate), [startDate, endDate]);
  const siteRows = useMemo(() => buildSiteRows(staffRows), [staffRows]);

  // Density computation: estimate printable width at 96dpi.
  // A3 landscape: 420mm × ~3.78 = ~1587px total → usable ~1498px after 12mm margin
  // A4 landscape: 297mm × ~3.78 = ~1123px total → usable ~1050px after 12mm margin
  const paperWidthPx = paperSize === "a3" ? 1498 : 1050;
  const labelColPx = paperSize === "a3" ? 78 : 82;
  const perDayPx = dates.length > 0
    ? Math.max(6, (paperWidthPx - labelColPx) / dates.length)
    : 28;
  const density: "loose" | "normal" | "tight" | "dense" =
    perDayPx >= 36 ? "loose"
    : perDayPx >= 22 ? "normal"
    : perDayPx >= 14 ? "tight"
    : "dense";

  const headerFont = density === "dense" ? "text-[7px]" : density === "tight" ? "text-[8px]" : "text-[9px]";
  const cellFont = density === "dense" ? "text-[7px]" : density === "tight" ? "text-[8px]" : "text-[9px]";
  const subFont = density === "dense" ? "text-[6px]" : density === "tight" ? "text-[7px]" : "text-[8px]";
  const showWeekday = density !== "dense";
  const showHolidayLabel = density === "loose" || density === "normal";

  const dateRange = dates.length > 0
    ? `${format(dates[0], "yyyy/MM/dd")} 〜 ${format(dates[dates.length - 1], "yyyy/MM/dd")}`
    : "";

  // Presets: snap-to-cycle starting from initial date
  function applyPreset(cycleDays: number) {
    const base = parseISO(startDate);
    const { start, end } = snapToCycleStart(base, cycleDays);
    setStartDate(formatDateISO(start));
    setEndDate(formatDateISO(end));
  }

  function applyMonthPreset(monthsAhead: number) {
    const base = startOfMonth(parseISO(startDate));
    const endBase = new Date(base.getFullYear(), base.getMonth() + monthsAhead, 0);
    setStartDate(formatDateISO(base));
    setEndDate(formatDateISO(endBase));
  }

  // For staff view: pick up to 2 chars each from client + site
  function pick2(value: string | null | undefined): string {
    if (!value) return "";
    return value.slice(0, 2);
  }

  // Ensure we render only on client (after mount) and portal to body
  // so the print-form is a direct child of <body>. This lets print CSS
  // cleanly hide all siblings via `body:has(.print-form) > *:not(.print-form)`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const content = (
    <div className="print-form fixed inset-0 z-[200] bg-white overflow-auto">
      {/* Screen-only toolbar */}
      <div className="no-print sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          disabled={loading || dates.length === 0}
        >
          印刷
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 border rounded-md text-sm hover:bg-muted"
        >
          閉じる
        </button>

        <div className="flex items-center gap-1.5 text-sm">
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          />
          <span className="text-muted-foreground">〜</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          />
          <span className="text-xs text-muted-foreground ml-1">{dates.length}日間</span>
          {loading && <span className="text-xs text-muted-foreground animate-pulse">読込中...</span>}
        </div>

        {/* Presets */}
        <div className="flex items-center gap-1 border-l pl-3">
          <span className="text-[10px] text-muted-foreground">プリセット:</span>
          <button
            onClick={() => applyPreset(14)}
            className="px-2 py-0.5 border rounded text-[11px] hover:bg-muted"
            title="開始日を1/5/10/15/20/25にスナップして2週間"
          >
            2週間
          </button>
          <button
            onClick={() => applyPreset(28)}
            className="px-2 py-0.5 border rounded text-[11px] hover:bg-muted"
          >
            4週間
          </button>
          <button
            onClick={() => applyMonthPreset(2)}
            className="px-2 py-0.5 border rounded text-[11px] hover:bg-muted"
            title="当月1日から2ヶ月分"
          >
            2ヶ月
          </button>
          <button
            onClick={() => applyMonthPreset(3)}
            className="px-2 py-0.5 border rounded text-[11px] hover:bg-muted"
          >
            3ヶ月
          </button>
        </div>

        {/* Paper size toggle */}
        <div className="flex items-center gap-1 border-l pl-3">
          <span className="text-[10px] text-muted-foreground">用紙:</span>
          <button
            onClick={() => setPaperSize("a3")}
            className={cn(
              "px-2 py-0.5 border rounded text-[11px]",
              paperSize === "a3" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
            title="A3 横向き（3ヶ月対応）"
          >
            A3横
          </button>
          <button
            onClick={() => setPaperSize("a4")}
            className={cn(
              "px-2 py-0.5 border rounded text-[11px]",
              paperSize === "a4" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
            title="A4 横向き（2週間〜1ヶ月向き）"
          >
            A4横
          </button>
        </div>

        {/* Site view display mode toggle */}
        {viewMode === "site" && (
          <div className="flex items-center gap-1 border-l pl-3">
            <span className="text-[10px] text-muted-foreground">表示:</span>
            <button
              onClick={() => setSiteDisplay("count")}
              className={cn(
                "px-2 py-0.5 border rounded text-[11px]",
                siteDisplay === "count" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
              )}
            >
              人数のみ
            </button>
            <button
              onClick={() => setSiteDisplay("names")}
              className={cn(
                "px-2 py-0.5 border rounded text-[11px]",
                siteDisplay === "names" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
              )}
            >
              氏名あり
            </button>
          </div>
        )}
      </div>

      {/* Printable content */}
      {!loading && dates.length > 0 && (
        <div
          className={cn("p-2 print-content mx-auto", density === "dense" && "print-dense")}
          data-paper={paperSize}
          data-density={density}
          style={{ maxWidth: `${paperWidthPx}px` }}
        >
          <div className="text-center mb-2">
            <h1 className="text-base font-bold">
              配置表 （{viewMode === "site" ? "現場別" : "スタッフ別"}）
            </h1>
            <p className="text-xs text-gray-500">
              {dateRange} ・ {dates.length}日間 ・ {paperSize === "a3" ? "A3横" : "A4横"}
            </p>
          </div>

          <table
            className={cn(
              "w-full border-collapse leading-tight table-fixed",
              cellFont,
            )}
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: `${labelColPx}px` }} />
              {dates.map((date) => (
                <col key={formatDateISO(date)} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  className={cn(
                    "border border-gray-400 bg-gray-100 p-1 text-left overflow-hidden",
                    headerFont,
                  )}
                >
                  {viewMode === "site" ? "現場" : "スタッフ"}
                </th>
                {dates.map((date) => {
                  const dateStr = formatDateISO(date);
                  const holiday = getHolidayName(dateStr);
                  const sunday = isSunday(date);
                  const weekend = isWeekend(date);
                  const isRed = sunday || !!holiday;
                  return (
                    <th
                      key={dateStr}
                      className={cn(
                        "border border-gray-400 p-0 text-center overflow-hidden",
                        headerFont,
                        isRed ? "bg-red-50 text-red-600" : weekend ? "bg-blue-50" : "bg-gray-100",
                      )}
                    >
                      <div className="truncate leading-none py-[1px]">
                        {format(date, "M/d")}
                      </div>
                      {showWeekday && (
                        <div className="truncate leading-none py-[1px]">
                          {format(date, "E", { locale: ja })}
                        </div>
                      )}
                      {holiday && showHolidayLabel && (
                        <div className={cn("text-red-500 truncate leading-none", subFont)}>
                          {holiday.slice(0, 4)}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {viewMode === "site" ? (
                siteRows.map((site) => (
                  <tr key={site.id}>
                    <td className="border border-gray-400 p-1 font-medium overflow-hidden">
                      <div className={cn("truncate", cellFont)}>
                        {site.clientName || site.branchOffice.name}
                      </div>
                      <div className={cn("font-bold truncate", cellFont)}>
                        {site.name}
                      </div>
                      {density !== "dense" && (
                        <div className={cn("text-gray-400 truncate", subFont)}>
                          {site.siteCode}
                        </div>
                      )}
                    </td>
                    {dates.map((date) => {
                      const dateStr = formatDateISO(date);
                      const entries = site.staffByDate.get(dateStr) || [];
                      const dayEntries = entries.filter((e) => e.shiftType !== "night");
                      const nightEntries = entries.filter((e) => e.shiftType === "night");
                      const sunday = isSunday(date);
                      const holiday = getHolidayName(dateStr);
                      const weekend = isWeekend(date);
                      const isRed = sunday || !!holiday;
                      const showNames =
                        siteDisplay === "names" && density !== "dense";
                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            "border border-gray-400 p-0 text-center align-top overflow-hidden",
                            isRed ? "bg-red-50/50" : weekend ? "bg-blue-50/50" : "",
                          )}
                        >
                          {/* Day shift - top */}
                          <div
                            className={cn(
                              "border-b border-gray-300 leading-none px-[1px] py-[1px]",
                              dayEntries.length > 0 ? "bg-amber-50 font-bold text-amber-800" : "text-gray-300",
                            )}
                            title="日勤"
                          >
                            {dayEntries.length > 0 ? dayEntries.length : ""}
                            {showNames && dayEntries.length > 0 && (
                              <div
                                className={cn(
                                  "mt-[1px] font-normal text-amber-900 leading-[1.1]",
                                  subFont,
                                )}
                              >
                                {dayEntries.map((e, i) => (
                                  <div key={i} className="truncate">
                                    {pick2(e.staffName)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Night shift - bottom */}
                          <div
                            className={cn(
                              "leading-none px-[1px] py-[1px]",
                              nightEntries.length > 0 ? "bg-indigo-50 font-bold text-indigo-800" : "text-gray-300",
                            )}
                            title="夜勤"
                          >
                            {nightEntries.length > 0 ? nightEntries.length : ""}
                            {showNames && nightEntries.length > 0 && (
                              <div
                                className={cn(
                                  "mt-[1px] font-normal text-indigo-900 leading-[1.1]",
                                  subFont,
                                )}
                              >
                                {nightEntries.map((e, i) => (
                                  <div key={i} className="truncate">
                                    {pick2(e.staffName)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                staffRows.map((staff) => (
                  <tr key={staff.id}>
                    <td className="border border-gray-400 p-1 font-medium overflow-hidden">
                      <div className={cn("truncate font-semibold", cellFont)}>
                        {staff.displayName || staff.name}
                      </div>
                      {density !== "dense" && (
                        <div className={cn("text-gray-400 truncate", subFont)}>
                          {staff.employeeCode} · {staff.branchOffice.name}
                        </div>
                      )}
                    </td>
                    {dates.map((date) => {
                      const dateStr = formatDateISO(date);
                      const sunday = isSunday(date);
                      const holiday = getHolidayName(dateStr);
                      const weekend = isWeekend(date);
                      const isRed = sunday || !!holiday;
                      const assignmentsOnDate = staff.assignments.filter((a) =>
                        a.assignmentDays.some((d) => d.date === dateStr && d.status === "scheduled")
                      );
                      const dayOnes = assignmentsOnDate.filter((a) => a.shiftType !== "night");
                      const nightOnes = assignmentsOnDate.filter((a) => a.shiftType === "night");
                      const renderAssign = (a: typeof assignmentsOnDate[number], i: number) => {
                        const clientShort = pick2(a.jobSite.clientName || a.jobSite.branchOffice.name);
                        const siteShort = pick2(a.jobSite.name);
                        if (density === "dense") {
                          // Ultra-compact: show only client 2-char
                          return (
                            <div key={i} className="leading-none truncate font-semibold">
                              {clientShort}
                            </div>
                          );
                        }
                        return (
                          <div key={i} className="leading-[1.1] py-[1px]">
                            <div className="font-semibold truncate">{clientShort}</div>
                            {density !== "tight" && (
                              <div className="text-gray-500 truncate">{siteShort}</div>
                            )}
                          </div>
                        );
                      };
                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            "border border-gray-400 p-0 text-center align-top overflow-hidden",
                            isRed ? "bg-red-50/50" : weekend ? "bg-blue-50/50" : "",
                          )}
                        >
                          {/* Day shift - top */}
                          <div
                            className={cn(
                              "border-b border-gray-300 px-[1px] py-[1px] min-h-[12px]",
                              dayOnes.length > 0 ? "bg-amber-50/70 text-amber-900" : "",
                            )}
                            title="日勤"
                          >
                            {dayOnes.map(renderAssign)}
                          </div>
                          {/* Night shift - bottom */}
                          <div
                            className={cn(
                              "px-[1px] py-[1px] min-h-[12px]",
                              nightOnes.length > 0 ? "bg-indigo-50/70 text-indigo-900" : "",
                            )}
                            title="夜勤"
                          >
                            {nightOnes.map(renderAssign)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Legend */}
          {viewMode === "site" && (
            <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-600">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-amber-50 border border-amber-800" />
                <span>日勤（上段）</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-indigo-50 border border-indigo-800" />
                <span>夜勤（下段）</span>
              </div>
            </div>
          )}
          {viewMode === "staff" && (
            <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-600">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-amber-50/70 border border-amber-800" />
                <span>日勤（上段）</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-indigo-50/70 border border-indigo-800" />
                <span>夜勤（下段）</span>
              </div>
              <span>セル内: 上=会社名 下=現場名（各2文字）</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
