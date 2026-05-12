"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Branch = { id: number; name: string; code: string; color: string };

type StaffInfo = {
  id: number;
  employeeCode: string;
  name: string;
  displayName: string | null;
  dailyRate: number | null;
  hasLicense: boolean;
  branchOffice: { id: number; name: string; code: string; color: string };
};

type SiteRef = {
  id: number;
  siteCode: string;
  name: string;
  clientCode: string | null;
  clientName: string | null;
};

type DailyPaymentView = {
  id: number;
  staffId: number;
  site1: SiteRef | null;
  site1BaseFee: number;
  site1Driving: number;
  site1Holiday: number;
  site1Lift: number;
  site1Skill: number;
  site1Other: number;
  site1Additional: number;
  site2: SiteRef | null;
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
  paymentTotal: number;
  offsetTotal: number;
  todayBalance: number;
};

type Row = {
  staff: StaffInfo;
  dailyPayment: DailyPaymentView | null;
  priorBalance: number;
  cumulativeBalance: number;
};

type Props = {
  initialDate: string;
  initialBranchCode: string;
  branches: Branch[];
};

function yen(n: number): string {
  if (n === 0 || n === null || n === undefined) return "";
  return n.toLocaleString("ja-JP");
}

function wareki(date: string): string {
  try {
    const d = parseISO(date);
    const y = d.getFullYear() - 2018; // 令和元年 = 2019
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `令和${y === 0 ? "元" : y}年${m}月${day}日`;
  } catch {
    return date;
  }
}

export function TallyPrint({ initialDate, initialBranchCode, branches }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [branchCode, setBranchCode] = useState(initialBranchCode);
  const [paperSize, setPaperSize] = useState<"a3" | "a4">("a3");
  const [rowsByBranch, setRowsByBranch] = useState<Map<string, Row[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Dynamic @page rule based on paper size
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-tally-print-page", "");
    styleEl.textContent = `@media print { @page { size: ${paperSize === "a3" ? "A3" : "A4"} landscape; margin: 6mm; } }`;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [paperSize]);

  // Portal readiness
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // If branchCode is set, fetch just that branch. Otherwise fetch all branches separately
        // so each branch can render on its own page.
        const targets = branchCode ? [branches.find((b) => b.code === branchCode)!] : branches;
        const results = await Promise.all(
          targets.map(async (b) => {
            const params = new URLSearchParams();
            params.set("branchOfficeId", String(b.id));
            const res = await fetch(`/api/daily-payments/${date}?${params}`);
            if (!res.ok) return [b.code, [] as Row[]] as const;
            const data = await res.json();
            return [b.code, data.rows as Row[]] as const;
          }),
        );
        if (cancelled) return;
        const map = new Map<string, Row[]>();
        for (const [code, rows] of results) map.set(code, rows);
        setRowsByBranch(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [date, branchCode, branches]);

  const branchesToRender = useMemo(() => {
    if (branchCode) {
      const b = branches.find((x) => x.code === branchCode);
      return b ? [b] : [];
    }
    return branches.filter((b) => (rowsByBranch.get(b.code)?.length ?? 0) > 0);
  }, [branchCode, branches, rowsByBranch]);

  const paperWidthPx = paperSize === "a3" ? 1498 : 1050;

  if (!mounted) return null;

  const content = (
    <div className="print-form fixed inset-0 z-[200] bg-white overflow-auto">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => window.print()}
          disabled={loading || branchesToRender.length === 0}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          印刷
        </button>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
        >
          閉じる
        </button>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-muted-foreground">日付:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 px-2 border rounded-md text-sm"
          />
        </div>

        <div className="flex items-center gap-1 border-l pl-3">
          <span className="text-xs text-muted-foreground">用紙:</span>
          <button
            onClick={() => setPaperSize("a3")}
            className={cn(
              "px-3 h-9 border rounded text-xs font-medium",
              paperSize === "a3" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
          >
            A3横
          </button>
          <button
            onClick={() => setPaperSize("a4")}
            className={cn(
              "px-3 h-9 border rounded text-xs font-medium",
              paperSize === "a4" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
          >
            A4横
          </button>
        </div>

        <div className="flex items-center gap-1 border-l pl-3 flex-wrap">
          <span className="text-xs text-muted-foreground">営業所:</span>
          <button
            onClick={() => setBranchCode("")}
            className={cn(
              "px-3 h-9 border rounded text-xs font-medium",
              branchCode === "" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
          >
            全営業所
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchCode(b.code)}
              className={cn(
                "px-3 h-9 border rounded text-xs font-medium flex items-center gap-1",
                branchCode === b.code
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
              {b.name}
            </button>
          ))}
        </div>

        {loading && <span className="text-xs text-muted-foreground animate-pulse">読込中...</span>}
      </div>

      {/* Printable pages */}
      {!loading && branchesToRender.length === 0 && (
        <div className="p-12 text-center text-muted-foreground">
          該当データがありません
        </div>
      )}

      {branchesToRender.map((branch, bi) => {
        const rows = rowsByBranch.get(branch.code) ?? [];
        return (
          <TallyPage
            key={branch.code}
            branch={branch}
            rows={rows}
            date={date}
            paperWidthPx={paperWidthPx}
            isLast={bi === branchesToRender.length - 1}
          />
        );
      })}
    </div>
  );

  return createPortal(content, document.body);
}

function TallyPage({
  branch,
  rows,
  date,
  paperWidthPx,
  isLast,
}: {
  branch: Branch;
  rows: Row[];
  date: string;
  paperWidthPx: number;
  isLast: boolean;
}) {
  return (
    <section
      className="p-2 print-content mx-auto"
      style={{
        maxWidth: `${paperWidthPx}px`,
        breakAfter: isLast ? "auto" : "page",
        pageBreakAfter: isLast ? "auto" : "always",
      }}
    >
      {/* Title */}
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-base font-bold">
          日計表 <span className="text-sm ml-2">{wareki(date)}</span>
        </h1>
        <div className="text-xs text-gray-600">
          {branch.name} ・ {rows.length}名
        </div>
      </div>

      <table className="w-full border-collapse text-[9px] leading-tight table-fixed">
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: 18 }} />
          <col style={{ width: 16 }} />
          <col style={{ width: 66 }} />
          <col style={{ width: 28 }} />
          <col style={{ width: 60 }} />
          <col style={{ width: 28 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 42 }} />
          <col style={{ width: 34 }} />
          <col style={{ width: 34 }} />
          <col style={{ width: 34 }} />
          <col style={{ width: 34 }} />
          <col style={{ width: 34 }} />
          <col style={{ width: 46 }} />
          <col style={{ width: 32 }} />
          <col style={{ width: 34 }} />
          <col style={{ width: 34 }} />
          <col style={{ width: 36 }} />
          <col style={{ width: 46 }} />
          <col style={{ width: 46 }} />
          <col style={{ width: 54 }} />
        </colgroup>
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-500 p-1" rowSpan={2}>社員<br />コード</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>No</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>免</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>氏名</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>得意先<br />コード</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>得意先名</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>現場<br />コード</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>現場名</th>
            <th className="border border-gray-500 p-1" colSpan={6}>支払明細</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>支払い<br />合計</th>
            <th className="border border-gray-500 p-1" colSpan={4}>相殺明細</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>相殺<br />合計</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>当日残</th>
            <th className="border border-gray-500 p-1" rowSpan={2}>累計残</th>
          </tr>
          <tr className="bg-gray-50 text-[8px]">
            <th className="border border-gray-400 p-0.5">基本料金</th>
            <th className="border border-gray-400 p-0.5">現場運転</th>
            <th className="border border-gray-400 p-0.5">自社計画</th>
            <th className="border border-gray-400 p-0.5">特殊</th>
            <th className="border border-gray-400 p-0.5">他</th>
            <th className="border border-gray-400 p-0.5">追加料金</th>
            <th className="border border-gray-400 p-0.5">安全会費</th>
            <th className="border border-gray-400 p-0.5">宿泊</th>
            <th className="border border-gray-400 p-0.5">その他</th>
            <th className="border border-gray-400 p-0.5">前渡金</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const dp = row.dailyPayment;
            // 2 現場ある場合は 2 行に分けて表示（支払明細は現場ごと）
            const hasSite2 = !!dp?.site2;
            return (
              <Fragment key={row.staff.id}>
                <tr className="align-middle">
                  <td
                    className="border border-gray-400 px-1 py-0.5 font-mono text-[8px] text-center whitespace-nowrap"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {row.staff.employeeCode}
                  </td>
                  <td
                    className="border border-gray-400 px-1 py-0.5 text-center tabular-nums"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {idx + 1}
                  </td>
                  <td
                    className="border border-gray-400 px-0 py-0.5 text-center text-[9px] font-bold text-blue-700"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {row.staff.hasLicense ? "⦿" : ""}
                  </td>
                  <td
                    className="border border-gray-400 px-1 py-0.5 whitespace-nowrap overflow-hidden"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    <div className="truncate font-medium">{row.staff.name}</div>
                  </td>
                  {/* 得意先コード／得意先名（親） */}
                  <td className="border border-gray-400 px-1 py-0.5 text-center font-mono text-[8px]">
                    {dp?.site1?.clientCode ?? ""}
                  </td>
                  <td className="border border-gray-400 px-1 py-0.5 overflow-hidden">
                    <div className="truncate text-[9px] text-gray-700">
                      {dp?.site1?.clientName ?? ""}
                    </div>
                  </td>
                  {/* 現場コード／現場名（子） */}
                  <td className="border border-gray-400 px-1 py-0.5 text-center font-mono text-[8px]">
                    {dp?.site1?.siteCode ?? ""}
                  </td>
                  <td className="border border-gray-400 px-1 py-0.5 overflow-hidden">
                    <div className="truncate text-[9px] font-medium">
                      {dp?.site1?.name ?? ""}
                    </div>
                  </td>
                  {/* 支払明細1（リフト列は削除） */}
                  <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp?.site1BaseFee ?? 0)}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp?.site1Driving ?? 0)}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp?.site1Holiday ?? 0)}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp?.site1Skill ?? 0)}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp?.site1Other ?? 0)}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp?.site1Additional ?? 0)}</td>
                  {/* 支払合計（両現場合算、1行目のみ表示して rowSpan） */}
                  <td
                    className="border border-gray-400 px-1 py-0.5 text-right tabular-nums font-semibold bg-amber-50/60"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {yen(dp?.paymentTotal ?? 0)}
                  </td>
                  {/* 相殺明細（1行目に集約） */}
                  <td
                    className="border border-gray-400 px-1 py-0.5 text-right tabular-nums"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {yen(dp?.safetyOffset ?? 0)}
                  </td>
                  <td
                    className="border border-gray-400 px-1 py-0.5 text-right tabular-nums"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {yen(dp?.lodgingOffset ?? 0)}
                  </td>
                  <td
                    className="border border-gray-400 px-1 py-0.5 text-right tabular-nums"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {yen(dp?.otherOffset ?? 0)}
                  </td>
                  <td
                    className="border border-gray-400 px-1 py-0.5 text-right tabular-nums"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {yen(dp?.advanceOffset ?? 0)}
                  </td>
                  <td
                    className="border border-gray-400 px-1 py-0.5 text-right tabular-nums font-semibold bg-indigo-50/60"
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {yen(dp?.offsetTotal ?? 0)}
                  </td>
                  <td
                    className={cn(
                      "border border-gray-400 px-1 py-0.5 text-right tabular-nums font-bold",
                      (dp?.todayBalance ?? 0) < 0 && "text-rose-700",
                    )}
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {dp?.todayBalance === 0 ? "" : yen(dp?.todayBalance ?? 0)}
                  </td>
                  <td
                    className={cn(
                      "border border-gray-400 px-1 py-0.5 text-right tabular-nums font-bold bg-gray-50",
                      row.cumulativeBalance < 0 && "text-rose-700",
                    )}
                    rowSpan={hasSite2 ? 2 : 1}
                  >
                    {row.cumulativeBalance === 0 ? "" : row.cumulativeBalance.toLocaleString("ja-JP")}
                  </td>
                </tr>
                {hasSite2 && dp && (
                  <tr className="align-middle">
                    <td className="border border-gray-400 px-1 py-0.5 text-center font-mono text-[8px]">
                      {dp.site2?.clientCode ?? ""}
                    </td>
                    <td className="border border-gray-400 px-1 py-0.5 overflow-hidden">
                      <div className="truncate text-[9px] text-gray-700">
                        {dp.site2?.clientName ?? ""}
                      </div>
                    </td>
                    <td className="border border-gray-400 px-1 py-0.5 text-center font-mono text-[8px]">
                      {dp.site2?.siteCode ?? ""}
                    </td>
                    <td className="border border-gray-400 px-1 py-0.5 overflow-hidden">
                      <div className="truncate text-[9px] font-medium">
                        {dp.site2?.name ?? ""}
                      </div>
                    </td>
                    <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp.site2BaseFee)}</td>
                    <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp.site2Driving)}</td>
                    <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp.site2Holiday)}</td>
                    <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp.site2Skill)}</td>
                    <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp.site2Other)}</td>
                    <td className="border border-gray-400 px-1 py-0.5 text-right tabular-nums">{yen(dp.site2Additional)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
