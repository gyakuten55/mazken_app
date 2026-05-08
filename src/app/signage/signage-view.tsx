"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatDateISO, isSunday } from "@/lib/date-utils";
import { getHolidayName } from "@/lib/holidays";
import { Sun, Moon, X, Users, User, Check, CircleDot, Coffee, ArrowLeft } from "lucide-react";

type Branch = {
  id: number;
  name: string;
  code: string;
  color: string;
};

type Assignment = {
  id: number; // AssignmentDay id
  date: string;
  shiftType: string;
  status: string;
  acknowledgedAt: string | null;
  staffId: number;
  staffName: string;
  staffCode: string;
  siteId: number;
  siteName: string;
  clientName: string | null;
  siteBranchColor: string;
  startTime: string;
  endTime: string;
  assignmentId: number;
};

type StaffLite = {
  id: number;
  name: string;
  employeeCode: string;
};

type Props = {
  branches: Branch[];
  selectedBranchCode: string;
  selectedBranchName: string;
  startDate: string;
  daysAhead: number;
  assignments: Assignment[];
  staffList: StaffLite[];
  isAdmin: boolean;
};

export function SignageView({
  branches,
  selectedBranchCode,
  selectedBranchName,
  startDate,
  daysAhead,
  assignments: initialAssignments,
  staffList,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [assignments, setAssignments] = useState(initialAssignments);
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  // Sync when parent refreshes
  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const dates = useMemo(() => {
    const out: Date[] = [];
    const base = parseISO(startDate);
    for (let i = 0; i < daysAhead; i++) {
      out.push(addDays(base, i));
    }
    return out;
  }, [startDate, daysAhead]);

  const byDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    return map;
  }, [assignments]);

  const selectedAssignments = selectedDate
    ? (byDate.get(selectedDate) ?? []).sort((a, b) =>
        a.siteName.localeCompare(b.siteName),
      )
    : [];

  const selectedStaff = selectedStaffId
    ? staffList.find((s) => s.id === selectedStaffId) ?? null
    : null;

  const personalAssignments = selectedStaffId
    ? assignments
        .filter((a) => a.staffId === selectedStaffId)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  async function patchDay(dayId: number, body: Record<string, unknown>, assignmentId: number) {
    setPendingId(dayId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/days/${dayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error("更新に失敗しました", await res.text());
        return;
      }
      const updated = await res.json();
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === dayId
            ? {
                ...a,
                status: updated.status,
                acknowledgedAt: updated.acknowledgedAt ?? null,
              }
            : a,
        ),
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-10 py-6 flex items-end justify-between gap-6">
        <div className="flex items-baseline gap-4 min-w-0">
          <h1 className="text-4xl font-bold tracking-tight truncate">
            {selectedStaff ? selectedStaff.name : selectedBranchName}
          </h1>
          <span className="text-base text-slate-400">
            {selectedStaff ? "個人予定" : "配置予定"}
          </span>
          {isAdmin && !selectedStaff && (
            <span className="text-xs text-amber-300 bg-amber-900/40 rounded px-2 py-0.5">
              管理モード
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {selectedStaff && (
            <button
              onClick={() => setSelectedStaffId(null)}
              className="flex items-center gap-2 h-12 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-base font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              全体に戻る
            </button>
          )}
          {!selectedStaff && staffList.length > 0 && (
            <button
              onClick={() => setStaffPickerOpen(true)}
              className="flex items-center gap-2 h-12 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-base font-medium"
            >
              <User className="h-5 w-5" />
              個人を選ぶ
            </button>
          )}
          <div className="text-right shrink-0">
            <div className="text-6xl font-bold tabular-nums tracking-tight leading-none">
              {format(now, "HH:mm")}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {format(now, "yyyy年M月d日 (E)", { locale: ja })}
            </div>
          </div>
        </div>
      </header>

      {/* Branch tabs */}
      {!selectedStaff && branches.length > 1 && (
        <nav className="px-10 pb-2 flex items-center gap-2 overflow-x-auto">
          {branches.map((b) => {
            const isActive = b.code === selectedBranchCode;
            return (
              <Link
                key={b.id}
                href={`/signage?branch=${b.code}`}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 border",
                  isActive
                    ? "bg-slate-100 text-slate-900 border-slate-100"
                    : "bg-transparent text-slate-300 border-slate-700 hover:border-slate-500 hover:text-slate-100",
                )}
                style={
                  isActive
                    ? { boxShadow: `inset 0 -3px 0 ${b.color}` }
                    : undefined
                }
              >
                {b.name}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Main content */}
      <main className="flex-1 px-10 pb-10 pt-4">
        {selectedStaff ? (
          /* Personal view */
          <div className="max-w-3xl mx-auto space-y-2">
            {personalAssignments.length === 0 ? (
              <div className="text-center text-slate-500 py-24">
                <Users className="h-14 w-14 mx-auto mb-4 opacity-30" />
                <div className="text-lg">この期間の配置はありません</div>
              </div>
            ) : (
              dates.map((date) => {
                const dateStr = formatDateISO(date);
                const items = personalAssignments.filter((a) => a.date === dateStr);
                const sunday = isSunday(date);
                const holiday = getHolidayName(dateStr);
                const isRed = sunday || !!holiday;
                const isToday = dateStr === formatDateISO(new Date());
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "rounded-xl p-4 border flex items-start gap-4",
                      isToday
                        ? "border-blue-400 bg-slate-800/80"
                        : items.length > 0
                          ? "border-slate-800 bg-slate-900"
                          : "border-slate-800/50 bg-slate-900/30",
                    )}
                  >
                    <div className="w-20 shrink-0">
                      <div className={cn(
                        "text-3xl font-bold tabular-nums",
                        isRed ? "text-rose-400" : "text-slate-100",
                      )}>
                        {format(date, "M/d")}
                      </div>
                      <div className={cn(
                        "text-xs",
                        isRed ? "text-rose-400/80" : "text-slate-400",
                      )}>
                        {format(date, "E曜日", { locale: ja })}
                        {holiday && ` · ${holiday}`}
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {items.length === 0 ? (
                        <div className="text-slate-500 text-sm">-</div>
                      ) : (
                        items.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 p-3"
                            style={{ borderLeftColor: a.siteBranchColor, borderLeftWidth: 4 }}
                          >
                            <div className="min-w-0">
                              {a.clientName && (
                                <div className="text-xs text-slate-400 truncate">{a.clientName}</div>
                              )}
                              <div className="font-bold truncate">{a.siteName}</div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                {a.shiftType === "night" ? (
                                  <span className="flex items-center gap-1 text-indigo-300">
                                    <Moon className="h-3 w-3" />夜勤
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-amber-300">
                                    <Sun className="h-3 w-3" />日勤
                                  </span>
                                )}
                                <span>{a.startTime}-{a.endTime}</span>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                patchDay(
                                  a.id,
                                  { acknowledged: !a.acknowledgedAt },
                                  a.assignmentId,
                                )
                              }
                              disabled={pendingId === a.id}
                              className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 flex items-center gap-2",
                                a.acknowledgedAt
                                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                  : "bg-slate-700 text-slate-200 hover:bg-slate-600",
                              )}
                            >
                              <Check className="h-4 w-4" />
                              {a.acknowledgedAt ? "見ました" : "見ましたボタン"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Day grid (default) */
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {dates.map((date) => {
              const dateStr = formatDateISO(date);
              const entries = byDate.get(dateStr) ?? [];
              const dayCount = entries.filter((e) => e.shiftType !== "night").length;
              const nightCount = entries.filter((e) => e.shiftType === "night").length;
              const totalCount = dayCount + nightCount;
              const sunday = isSunday(date);
              const holiday = getHolidayName(dateStr);
              const isRed = sunday || !!holiday;
              const isToday = dateStr === formatDateISO(new Date());
              const hasAssignments = totalCount > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "relative rounded-2xl p-5 transition-all text-left min-h-[200px] flex flex-col",
                    "active:scale-[0.98]",
                    isToday
                      ? "bg-slate-800/90 ring-2 ring-blue-400"
                      : hasAssignments
                        ? "bg-slate-900 hover:bg-slate-800/70"
                        : "bg-slate-900/40 hover:bg-slate-900",
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className={cn(
                        "text-3xl font-bold tabular-nums leading-none",
                        isRed ? "text-rose-400" : "text-slate-100",
                      )}>
                        {format(date, "d")}
                      </div>
                      <div className={cn(
                        "text-sm font-medium mt-1",
                        isRed ? "text-rose-400/80" : "text-slate-400",
                      )}>
                        {format(date, "M月 E曜日", { locale: ja })}
                      </div>
                    </div>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold tracking-wide">
                        本日
                      </span>
                    )}
                  </div>

                  {holiday && (
                    <div className="text-xs text-rose-400 mt-2">{holiday}</div>
                  )}

                  <div className="mt-auto pt-4 flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Sun className={cn("h-5 w-5", dayCount > 0 ? "text-amber-400" : "text-slate-600")} />
                      <span className={cn(
                        "text-3xl font-bold tabular-nums leading-none",
                        dayCount > 0 ? "text-slate-100" : "text-slate-600",
                      )}>
                        {dayCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Moon className={cn("h-5 w-5", nightCount > 0 ? "text-indigo-400" : "text-slate-600")} />
                      <span className={cn(
                        "text-3xl font-bold tabular-nums leading-none",
                        nightCount > 0 ? "text-slate-100" : "text-slate-600",
                      )}>
                        {nightCount}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-10 py-4 text-[11px] text-slate-500 flex items-center justify-end">
        <div>最終更新 {format(now, "HH:mm")}</div>
      </footer>

      {/* Staff picker modal */}
      {staffPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setStaffPickerOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="text-xl font-bold">個人を選ぶ</div>
              <button
                onClick={() => setStaffPickerOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {staffList.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStaffId(s.id);
                    setStaffPickerOpen(false);
                  }}
                  className="rounded-xl p-4 bg-slate-800 hover:bg-slate-700 text-left"
                >
                  <div className="font-bold">{s.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{s.employeeCode}</div>
                </button>
              ))}
              {staffList.length === 0 && (
                <div className="col-span-full text-center text-slate-500 py-8">
                  この営業所のアクティブスタッフはいません
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Day detail modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="text-2xl font-bold">
                {format(parseISO(selectedDate), "M月d日 (E)", { locale: ja })}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex items-center gap-1">
                    <Sun className="h-4 w-4 text-amber-400" />
                    日勤 {selectedAssignments.filter((a) => a.shiftType !== "night").length}
                  </span>
                  <span className="flex items-center gap-1">
                    <Moon className="h-4 w-4 text-indigo-400" />
                    夜勤 {selectedAssignments.filter((a) => a.shiftType === "night").length}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2">
              {selectedAssignments.length === 0 ? (
                <div className="text-center text-slate-500 py-16">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <div>この日の配置はありません</div>
                </div>
              ) : (
                Array.from(
                  selectedAssignments.reduce((acc, a) => {
                    const key = a.siteId;
                    if (!acc.has(key)) {
                      acc.set(key, {
                        siteName: a.siteName,
                        clientName: a.clientName,
                        color: a.siteBranchColor,
                        staff: [] as Assignment[],
                      });
                    }
                    acc.get(key)!.staff.push(a);
                    return acc;
                  }, new Map<number, { siteName: string; clientName: string | null; color: string; staff: Assignment[] }>()).values(),
                ).map((group, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-800 p-4"
                    style={{ borderLeftColor: group.color, borderLeftWidth: 4 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        {group.clientName && (
                          <div className="text-xs text-slate-400">{group.clientName}</div>
                        )}
                        <div className="font-bold text-lg">{group.siteName}</div>
                      </div>
                      <div className="text-sm text-slate-400">{group.staff.length}名</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.staff.map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            "relative rounded-lg px-3 py-2 flex items-center gap-2",
                            s.shiftType === "night"
                              ? "bg-indigo-500/20 text-indigo-200"
                              : "bg-amber-500/20 text-amber-100",
                          )}
                        >
                          {s.shiftType === "night" ? (
                            <Moon className="h-3 w-3" />
                          ) : (
                            <Sun className="h-3 w-3" />
                          )}
                          <span className="text-sm font-medium">{s.staffName}</span>
                          <span className="text-[10px] opacity-60">
                            {s.startTime}-{s.endTime}
                          </span>

                          {/* Acknowledgement indicator */}
                          <button
                            onClick={() =>
                              patchDay(
                                s.id,
                                { acknowledged: !s.acknowledgedAt },
                                s.assignmentId,
                              )
                            }
                            disabled={pendingId === s.id}
                            title={s.acknowledgedAt ? "確認済み（クリックで取消）" : "見ました（タップで既読）"}
                            className={cn(
                              "ml-1 rounded-full w-6 h-6 flex items-center justify-center transition-colors",
                              s.acknowledgedAt
                                ? "bg-emerald-500 text-white hover:bg-emerald-400"
                                : "bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200",
                            )}
                          >
                            {s.acknowledgedAt ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <CircleDot className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Admin: toggle rest */}
                          {isAdmin && (
                            <button
                              onClick={() =>
                                patchDay(
                                  s.id,
                                  { status: s.status === "scheduled" ? "cancelled" : "scheduled" },
                                  s.assignmentId,
                                )
                              }
                              disabled={pendingId === s.id}
                              title={s.status === "scheduled" ? "休みに切替" : "配置に戻す"}
                              className="rounded-full w-6 h-6 flex items-center justify-center bg-slate-700/60 text-slate-400 hover:bg-rose-500 hover:text-white transition-colors"
                            >
                              <Coffee className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
