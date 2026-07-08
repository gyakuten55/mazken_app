"use client";

import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Printer, Save, Loader2, CalendarDays, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type SiteRefView = {
  id: number;
  siteCode: string;
  name: string;
  clientCode: string | null;
  clientName: string | null;
};

type DailyPaymentView = {
  id: number;
  staffId: number;
  date: string;
  site1Id: number | null;
  site1: SiteRefView | null;
  site1BaseFee: number;
  site1Driving: number;
  site1Holiday: number;
  site1Lift: number;
  site1Skill: number;
  site1Other: number;
  site1Additional: number;
  site2Id: number | null;
  site2: SiteRefView | null;
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
  notes: string | null;
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

const MONEY_FIELDS = [
  "site1BaseFee",
  "site1Driving",
  "site1Holiday",
  "site1Lift",
  "site1Skill",
  "site1Other",
  "site1Additional",
  "site2BaseFee",
  "site2Driving",
  "site2Holiday",
  "site2Lift",
  "site2Skill",
  "site2Other",
  "site2Additional",
  "safetyOffset",
  "lodgingOffset",
  "otherOffset",
  "advanceOffset",
] as const;

type MoneyField = (typeof MONEY_FIELDS)[number];

type EditableRowState = {
  [K in MoneyField]: number;
} & { notes: string | null };

function emptyEditable(): EditableRowState {
  return {
    site1BaseFee: 0,
    site1Driving: 0,
    site1Holiday: 0,
    site1Lift: 0,
    site1Skill: 0,
    site1Other: 0,
    site1Additional: 0,
    site2BaseFee: 0,
    site2Driving: 0,
    site2Holiday: 0,
    site2Lift: 0,
    site2Skill: 0,
    site2Other: 0,
    site2Additional: 0,
    safetyOffset: 0,
    lodgingOffset: 0,
    otherOffset: 0,
    advanceOffset: 0,
    notes: null,
  };
}

function fromDailyPayment(dp: DailyPaymentView | null): EditableRowState {
  if (!dp) return emptyEditable();
  return {
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
    notes: dp.notes ?? null,
  };
}

function rowTotal(edit: EditableRowState): {
  paymentTotal: number;
  offsetTotal: number;
  todayBalance: number;
} {
  // リフト(site*Lift)は合計に含めない（payment-utils.calcPaymentTotal と一致させる。
  // T-2: リフトは廃止項目。列はデータ保全のため温存するが金額計算からは除外）。
  const paymentTotal =
    edit.site1BaseFee +
    edit.site1Driving +
    edit.site1Holiday +
    edit.site1Skill +
    edit.site1Other +
    edit.site1Additional +
    edit.site2BaseFee +
    edit.site2Driving +
    edit.site2Holiday +
    edit.site2Skill +
    edit.site2Other +
    edit.site2Additional;
  const offsetTotal =
    edit.safetyOffset + edit.lodgingOffset + edit.otherOffset + edit.advanceOffset;
  return { paymentTotal, offsetTotal, todayBalance: paymentTotal - offsetTotal };
}

function yen(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("ja-JP");
}

type Props = {
  initialDate: string;
  branches: Branch[];
  initialBranchCode: string;
  // ユーザー1（office）は閲覧・印刷のみ可能。お金関連は編集不可。
  readOnly?: boolean;
};

export function TallyEditor({ initialDate, branches, initialBranchCode, readOnly = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [date, setDate] = useState(initialDate);
  const [branchCode, setBranchCode] = useState(initialBranchCode);
  // T-1: 得意先・現場・社員のコード/名称を横断する絞り込み検索（部分一致）
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [editState, setEditState] = useState<Map<number, EditableRowState>>(new Map());
  const [dirtyStaffIds, setDirtyStaffIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const branchId = useMemo(() => {
    if (!branchCode) return null;
    return branches.find((b) => b.code === branchCode)?.id ?? null;
  }, [branchCode, branches]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchOfficeId", String(branchId));
      const res = await fetch(`/api/daily-payments/${date}?${params}`);
      if (!res.ok) {
        toast.error("読み込みに失敗しました");
        return;
      }
      const data = await res.json();
      setRows(data.rows);
      const map = new Map<number, EditableRowState>();
      for (const r of data.rows as Row[]) {
        map.set(r.staff.id, fromDailyPayment(r.dailyPayment));
      }
      setEditState(map);
      setDirtyStaffIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [date, branchId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("date", date);
    if (branchCode) next.set("branch", branchCode);
    else next.delete("branch");
    router.replace(`/tally?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchCode]);

  function updateField(staffId: number, field: MoneyField, value: number) {
    if (readOnly) return;
    setEditState((prev) => {
      const next = new Map(prev);
      const current = next.get(staffId) ?? emptyEditable();
      next.set(staffId, { ...current, [field]: value });
      return next;
    });
    setDirtyStaffIds((prev) => new Set(prev).add(staffId));
  }

  async function saveAll() {
    if (dirtyStaffIds.size === 0) {
      toast.info("変更はありません");
      return;
    }
    setSaving(true);
    try {
      const body = {
        rows: Array.from(dirtyStaffIds).map((staffId) => {
          const edit = editState.get(staffId)!;
          return { staffId, ...edit };
        }),
      };
      const res = await fetch(`/api/daily-payments/${date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "保存に失敗しました");
        return;
      }
      toast.success(`${dirtyStaffIds.size}件を保存しました`);
      await fetchRows();
    } finally {
      setSaving(false);
    }
  }

  function goDay(delta: number) {
    const d = addDays(parseISO(date), delta);
    setDate(format(d, "yyyy-MM-dd"));
  }

  const dateLabel = useMemo(() => {
    try {
      return format(parseISO(date), "yyyy年M月d日 (E)", { locale: ja });
    } catch {
      return date;
    }
  }, [date]);

  // T-1: 得意先/現場/社員のコード・名称で絞り込み（単一日の取得済み行をクライアント側でフィルタ）
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const hit = (v: string | null | undefined) => !!v && v.toLowerCase().includes(q);
    const siteHit = (s: SiteRefView | null | undefined) =>
      !!s && (hit(s.siteCode) || hit(s.name) || hit(s.clientCode) || hit(s.clientName));
    return rows.filter(
      (r) =>
        hit(r.staff.employeeCode) ||
        hit(r.staff.name) ||
        hit(r.staff.displayName) ||
        siteHit(r.dailyPayment?.site1) ||
        siteHit(r.dailyPayment?.site2),
    );
  }, [rows, query]);

  const totalStaff = filteredRows.length;
  const totalToday = filteredRows.reduce((sum, r) => {
    const edit = editState.get(r.staff.id);
    if (!edit) return sum;
    return sum + rowTotal(edit).todayBalance;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 p-3 bg-card rounded-xl border shadow-sm">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goDay(-1)}
            aria-label="前日"
            className="h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 pl-9 pr-3 rounded-lg border border-input bg-transparent text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goDay(1)}
            aria-label="翌日"
            className="h-10 w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
            className="h-10 ml-1"
          >
            今日
          </Button>
          <span className="font-semibold text-base ml-3 hidden sm:inline">
            {dateLabel}
          </span>
        </div>

        {/* Branch tabs */}
        <div className="flex border rounded-lg overflow-hidden h-10 text-sm">
          <button
            onClick={() => setBranchCode("")}
            aria-pressed={branchCode === ""}
            className={cn(
              "px-3 font-medium transition-colors",
              branchCode === ""
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            全営業所
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchCode(b.code)}
              aria-pressed={branchCode === b.code}
              className={cn(
                "px-3 font-medium transition-colors border-l flex items-center gap-1.5",
                branchCode === b.code
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              {b.name}
            </button>
          ))}
        </div>

        {/* T-1: 得意先・現場・社員の検索（コード/名称・部分一致） */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="得意先・現場・社員で検索"
            className="h-10 w-44 md:w-56 pl-8 pr-8 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="検索をクリア"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {readOnly ? (
          <span className="text-xs text-amber-600 font-medium px-3 py-1 rounded bg-amber-50 border border-amber-200">
            閲覧モード（編集には管理者権限が必要）
          </span>
        ) : (
          <Button
            onClick={saveAll}
            disabled={saving || dirtyStaffIds.size === 0}
            size="lg"
            className="min-w-28"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存{dirtyStaffIds.size > 0 && `（${dirtyStaffIds.size}件）`}
          </Button>
        )}

        <Link
          href={`/print/daily-tally?date=${date}${branchCode ? `&branch=${branchCode}` : ""}`}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors"
        >
          <Printer className="h-4 w-4" />
          印刷
        </Link>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>対象: {totalStaff}名</span>
        <span>
          本日の当日残合計: <span className="font-bold text-foreground tabular-nums">{totalToday.toLocaleString("ja-JP")}円</span>
        </span>
        {dirtyStaffIds.size > 0 && (
          <span className="text-amber-600 font-semibold">
            未保存の変更 {dirtyStaffIds.size}件
          </span>
        )}
      </div>

      {/* Spreadsheet table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            読み込み中...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {query.trim() ? "検索条件に一致する行がありません" : "対象のスタッフがいません"}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <tr className="text-xs">
                <th className="border px-2 py-2 text-left min-w-[60px]" rowSpan={2}>社員<br />コード</th>
                <th className="border px-2 py-2 text-left min-w-[140px]" rowSpan={2}>氏名</th>
                <th className="border px-2 py-2 text-left min-w-[72px]" rowSpan={2}>得意先<br />コード</th>
                <th className="border px-2 py-2 text-left min-w-[140px]" rowSpan={2}>得意先名</th>
                <th className="border px-2 py-2 text-left min-w-[72px]" rowSpan={2}>現場<br />コード</th>
                <th className="border px-2 py-2 text-left min-w-[140px]" rowSpan={2}>現場名</th>
                <th className="border px-2 py-2 text-center" colSpan={6}>支払明細</th>
                <th className="border px-2 py-2 text-right min-w-[80px]" rowSpan={2}>支払<br />合計</th>
                <th className="border px-2 py-2 text-center" colSpan={4}>相殺明細</th>
                <th className="border px-2 py-2 text-right min-w-[80px]" rowSpan={2}>当日残</th>
              </tr>
              <tr className="text-[10px] text-muted-foreground">
                <th className="border px-1 py-1 min-w-[72px]">基本</th>
                <th className="border px-1 py-1 min-w-[64px]">運転</th>
                <th className="border px-1 py-1 min-w-[64px]">自社</th>
                <th className="border px-1 py-1 min-w-[64px]">特殊</th>
                <th className="border px-1 py-1 min-w-[64px]">他<br /><span className="text-[8px] opacity-70">(支払)</span></th>
                <th className="border px-1 py-1 min-w-[64px]">追加</th>
                <th className="border px-1 py-1 min-w-[56px]">安全</th>
                <th className="border px-1 py-1 min-w-[64px]">宿泊</th>
                <th className="border px-1 py-1 min-w-[64px]">他<br /><span className="text-[8px] opacity-70">(相殺)</span></th>
                <th className="border px-1 py-1 min-w-[72px]">前渡金</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const edit = editState.get(row.staff.id) ?? emptyEditable();
                const { paymentTotal, todayBalance } = rowTotal(edit);
                const isDirty = dirtyStaffIds.has(row.staff.id);
                const hasSite2 = !!row.dailyPayment?.site2;

                const staffCell = (
                  <>
                    <td
                      className="border px-2 py-1.5 font-mono text-xs whitespace-nowrap align-middle"
                      rowSpan={hasSite2 ? 2 : 1}
                    >
                      {row.staff.employeeCode}
                    </td>
                    <td
                      className="border px-2 py-1.5 whitespace-nowrap align-middle"
                      rowSpan={hasSite2 ? 2 : 1}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.staff.branchOffice.color }}
                        />
                        <span className="font-medium">{row.staff.displayName || row.staff.name}</span>
                        {row.staff.hasLicense && (
                          <span className="text-[9px] text-blue-600 font-bold">🅛</span>
                        )}
                      </div>
                    </td>
                  </>
                );

                const summaryCells = (
                  <>
                    <td
                      className="border px-2 py-1.5 text-right tabular-nums font-semibold bg-amber-50/60 whitespace-nowrap align-middle"
                      rowSpan={hasSite2 ? 2 : 1}
                    >
                      {yen(paymentTotal)}
                    </td>
                    {(["safetyOffset", "lodgingOffset", "otherOffset", "advanceOffset"] as const).map((f) => (
                      <MoneyCell
                        key={f}
                        value={edit[f]}
                        onChange={(v) => updateField(row.staff.id, f, v)}
                        rowSpan={hasSite2 ? 2 : 1}
                      />
                    ))}
                    <td
                      className={cn(
                        "border px-2 py-1.5 text-right tabular-nums font-bold whitespace-nowrap align-middle",
                        todayBalance > 0
                          ? "text-emerald-700"
                          : todayBalance < 0
                            ? "text-rose-700"
                            : "text-muted-foreground",
                      )}
                      rowSpan={hasSite2 ? 2 : 1}
                    >
                      {yen(todayBalance)}
                    </td>
                  </>
                );

                return (
                  <Fragment key={row.staff.id}>
                    <tr
                      className={cn(
                        "hover:bg-accent/40 transition-colors",
                        isDirty && "bg-amber-50/60",
                      )}
                    >
                      {staffCell}
                      <td className="border px-2 py-1.5 text-xs font-mono whitespace-nowrap text-muted-foreground">
                        {row.dailyPayment?.site1?.clientCode ?? ""}
                      </td>
                      <td className="border px-2 py-1.5 text-xs whitespace-nowrap text-muted-foreground max-w-[160px] truncate">
                        {row.dailyPayment?.site1?.clientName ?? ""}
                      </td>
                      <td className="border px-2 py-1.5 text-xs font-mono whitespace-nowrap">
                        {row.dailyPayment?.site1?.siteCode ?? ""}
                      </td>
                      <td className="border px-2 py-1.5 text-xs whitespace-nowrap font-medium max-w-[160px] truncate">
                        {row.dailyPayment?.site1?.name ?? ""}
                      </td>
                      {(["site1BaseFee", "site1Driving", "site1Holiday", "site1Skill", "site1Other", "site1Additional"] as const).map((f) => (
                        <MoneyCell
                          key={f}
                          value={edit[f]}
                          onChange={(v) => updateField(row.staff.id, f, v)}
                        />
                      ))}
                      {summaryCells}
                    </tr>
                    {hasSite2 && (
                      <tr
                        className={cn(
                          "hover:bg-accent/40 transition-colors",
                          isDirty && "bg-amber-50/60",
                        )}
                      >
                        <td className="border px-2 py-1.5 text-xs font-mono whitespace-nowrap text-muted-foreground">
                          {row.dailyPayment?.site2?.clientCode ?? ""}
                        </td>
                        <td className="border px-2 py-1.5 text-xs whitespace-nowrap text-muted-foreground max-w-[160px] truncate">
                          {row.dailyPayment?.site2?.clientName ?? ""}
                        </td>
                        <td className="border px-2 py-1.5 text-xs font-mono whitespace-nowrap">
                          {row.dailyPayment?.site2?.siteCode ?? ""}
                        </td>
                        <td className="border px-2 py-1.5 text-xs whitespace-nowrap font-medium max-w-[160px] truncate">
                          {row.dailyPayment?.site2?.name ?? ""}
                        </td>
                        {(["site2BaseFee", "site2Driving", "site2Holiday", "site2Skill", "site2Other", "site2Additional"] as const).map((f) => (
                          <MoneyCell
                            key={f}
                            value={edit[f]}
                            onChange={(v) => updateField(row.staff.id, f, v)}
                          />
                        ))}
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MoneyCell({
  value,
  onChange,
  rowSpan,
}: {
  value: number;
  onChange: (v: number) => void;
  rowSpan?: number;
}) {
  const [localValue, setLocalValue] = useState(value === 0 ? "" : String(value));

  useEffect(() => {
    setLocalValue(value === 0 ? "" : String(value));
  }, [value]);

  return (
    <td className="border p-0 align-middle" rowSpan={rowSpan}>
      <input
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9\-]/g, "");
          setLocalValue(raw);
        }}
        onBlur={() => {
          const n = localValue === "" || localValue === "-" ? 0 : Number(localValue);
          if (!Number.isFinite(n)) {
            setLocalValue(value === 0 ? "" : String(value));
            return;
          }
          // 値が変わっていなければ何もしない（dirty にしない）
          if (n === value) {
            // 表示を正規化（"00500" → "500"）
            setLocalValue(value === 0 ? "" : String(value));
            return;
          }
          onChange(n);
        }}
        className="w-full h-8 px-1.5 text-right tabular-nums text-xs bg-transparent focus:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-inset"
      />
    </td>
  );
}
