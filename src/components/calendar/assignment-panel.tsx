"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Trash2, MapPin, Clock, CalendarDays, AlertTriangle, ShieldAlert, Sun, Moon, Truck, Coins, StickyNote, Info } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ASSIGNMENT_TYPES } from "@/lib/constants";
import type { Assignment, AssignmentDay } from "./types";
import { SiteSelect } from "@/components/sites/site-select";

type JobSite = {
  id: number;
  name: string;
  siteCode: string;
  requiredInsurance?: string | null;
  notes?: string | null;
  branchOffice: { color: string; name: string };
};

type StaffAvailability = {
  totalDays: number;
  busyDays: number;
  freeDays: number;
  conflicts: { siteName: string; dates: string[] }[];
};

type StaffInfo = {
  id: number;
  name: string;
  employeeCode: string;
  insuranceType: string;
  branchOffice: { name: string; color: string };
  availability?: StaffAvailability;
};

type VehicleInfo = {
  id: number;
  plateNumber: string;
  name: string | null;
  isActive: boolean;
};

type ConflictWarning = {
  siteName: string;
  dates: string[];
};

type InsuranceWarning = {
  staffInsurance: string;
  siteRequirement: string;
  siteName: string;
};

export function AssignmentPanel({
  staffId: staffIdProp,
  preselectedSiteId,
  date,
  endDate: endDateProp,
  assignment: existingAssignment,
  onClose,
  onSaved,
}: {
  staffId: number | null;
  preselectedSiteId?: number | null;
  date: string;
  endDate?: string;
  assignment: Assignment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existingAssignment;
  const isSiteMode = !staffIdProp && !!preselectedSiteId;
  const isUnassignedEdit = isEdit && existingAssignment?.staffId == null;
  const needsStaffSelection = isSiteMode || isUnassignedEdit;
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(staffIdProp);
  const staffId = selectedStaffId;
  const [allStaff, setAllStaff] = useState<StaffInfo[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [sites, setSites] = useState<JobSite[]>([]);
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([]);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullAssignment, setFullAssignment] = useState<Assignment | null>(null);
  const siteSelectRef = useRef<HTMLSelectElement>(null);
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [insuranceWarning, setInsuranceWarning] = useState<InsuranceWarning | null>(null);
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  const [form, setForm] = useState<{
    jobSiteId: number;
    vehicleId: number | null;
    startDate: string;
    endDate: string;
    assignmentType: string;
    shiftType: string;
    startTime: string;
    endTime: string;
    dailyRateOverride: string;
    notes: string;
  }>({
    jobSiteId: existingAssignment?.jobSite.id || preselectedSiteId || 0,
    vehicleId: existingAssignment?.vehicleId ?? null,
    startDate: date || "",
    endDate: endDateProp || date || "",
    assignmentType: existingAssignment?.assignmentType || "commute",
    shiftType: existingAssignment?.shiftType || "day",
    startTime: existingAssignment?.startTime || "08:00",
    endTime: existingAssignment?.endTime || "18:00",
    dailyRateOverride:
      existingAssignment?.dailyRateOverride != null
        ? String(existingAssignment.dailyRateOverride)
        : "",
    notes: existingAssignment?.notes ?? "",
  });

  useEffect(() => {
    fetch("/api/sites?status=active")
      .then((r) => {
        if (!r.ok) throw new Error("認証エラー");
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setSites(data);
        }
        // Auto-focus site select on create mode
        if (!isEdit) {
          setTimeout(() => siteSelectRef.current?.focus(), 100);
        }
      })
      .catch(() => toast.error("現場データの取得に失敗しました"));

    fetch("/api/vehicles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setVehicles(data.filter((v: VehicleInfo) => v.isActive));
      })
      .catch(() => {});

    if (staffId) {
      fetch(`/api/staff/${staffId}`)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(setStaffInfo)
        .catch(() => {});
    }

    if (existingAssignment) {
      fetch(`/api/assignments/${existingAssignment.id}`)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((a: Assignment) => {
          setFullAssignment(a);
          setForm((p) => ({
            ...p,
            vehicleId: a.vehicleId ?? null,
            dailyRateOverride:
              a.dailyRateOverride != null ? String(a.dailyRateOverride) : "",
            notes: a.notes ?? "",
          }));
        })
        .catch(() => {});
    }
  }, [staffId, existingAssignment, isEdit]);

  // スタッフ選択が必要なとき（現場先行 or 未割当配置の編集）期間に応じて一覧を取得し空き状況を付与
  useEffect(() => {
    if (!needsStaffSelection) return;
    const startDate =
      isUnassignedEdit && existingAssignment?.startDate
        ? existingAssignment.startDate
        : form.startDate;
    const endDate =
      isUnassignedEdit && existingAssignment?.endDate
        ? existingAssignment.endDate
        : form.endDate;
    const params = new URLSearchParams();
    if (startDate && endDate && startDate <= endDate) {
      params.set("availableStartDate", startDate);
      params.set("availableEndDate", endDate);
    }
    const url = params.toString()
      ? `/api/staff/search?${params}`
      : `/api/staff`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setAllStaff(data);
      })
      .catch(() => {});
  }, [needsStaffSelection, isUnassignedEdit, existingAssignment?.startDate, existingAssignment?.endDate, form.startDate, form.endDate]);

  async function handleCreate(force = false) {
    // staffId 未指定でも OK（未割当配置として作成）
    if (!form.jobSiteId || !form.startDate || !form.endDate) {
      toast.error("現場と日付を選択してください");
      return;
    }
    setLoading(true);
    try {
      const rateNum = form.dailyRateOverride.trim()
        ? Math.max(0, Math.floor(Number(form.dailyRateOverride)))
        : null;
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: staffId ?? null,
          ...form,
          vehicleId: form.vehicleId ?? null,
          dailyRateOverride: rateNum,
          notes: form.notes.trim() || null,
          force,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setConflicts(data.conflicts || []);
        setInsuranceWarning(data.insuranceWarning || null);
        setShowForceConfirm(true);
        return;
      }
      if (res.ok) {
        toast.success("配置を作成しました");
        setConflicts([]);
        setInsuranceWarning(null);
        setShowForceConfirm(false);
        onSaved();
      } else {
        toast.error("作成に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(force = false) {
    if (!existingAssignment) return;
    setLoading(true);
    try {
      const rateNum = form.dailyRateOverride.trim()
        ? Math.max(0, Math.floor(Number(form.dailyRateOverride)))
        : null;
      // 「最初に未割当だったか」は最新状態 (fullAssignment) を優先
      const baselineStaffId = fullAssignment?.staffId ?? existingAssignment.staffId;
      const wasUnassigned = baselineStaffId == null;
      const res = await fetch(`/api/assignments/${existingAssignment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(wasUnassigned ? { staffId: staffId ?? null } : {}),
          assignmentType: form.assignmentType,
          shiftType: form.shiftType,
          startTime: form.startTime,
          endTime: form.endTime,
          vehicleId: form.vehicleId ?? null,
          dailyRateOverride: rateNum,
          notes: form.notes.trim() || null,
          force,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setConflicts(data.conflicts || []);
        setInsuranceWarning(data.insuranceWarning || null);
        setShowForceConfirm(true);
        return;
      }
      if (res.ok) {
        toast.success("配置を更新しました");
        setConflicts([]);
        setInsuranceWarning(null);
        setShowForceConfirm(false);
        onSaved();
      } else {
        toast.error("更新に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!existingAssignment) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments/${existingAssignment.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("配置を削除しました");
        onSaved();
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // Toggle a single day
  async function toggleDay(day: AssignmentDay) {
    if (!existingAssignment) return;
    const newStatus = day.status === "scheduled" ? "cancelled" : "scheduled";
    try {
      await fetch(
        `/api/assignments/${existingAssignment.id}/days/${day.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setFullAssignment((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assignmentDays: prev.assignmentDays.map((d) =>
            d.id === day.id ? { ...d, status: newStatus } : d
          ),
        };
      });
    } catch {
      toast.error("更新に失敗しました");
    }
  }

  // Toggle multiple days at once (for drag selection)
  async function toggleDays(days: AssignmentDay[], targetStatus: string) {
    if (!existingAssignment) return;
    const toUpdate = days.filter((d) => d.status !== targetStatus);
    if (toUpdate.length === 0) return;

    // Optimistic update
    setFullAssignment((prev) => {
      if (!prev) return prev;
      const ids = new Set(toUpdate.map((d) => d.id));
      return {
        ...prev,
        assignmentDays: prev.assignmentDays.map((d) =>
          ids.has(d.id) ? { ...d, status: targetStatus } : d
        ),
      };
    });

    // Fire API calls in parallel
    try {
      await Promise.all(
        toUpdate.map((day) =>
          fetch(
            `/api/assignments/${existingAssignment.id}/days/${day.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: targetStatus }),
            }
          )
        )
      );
    } catch {
      toast.error("一部の更新に失敗しました");
      // Refetch to get correct state
      if (existingAssignment) {
        fetch(`/api/assignments/${existingAssignment.id}`)
          .then((r) => r.json())
          .then(setFullAssignment);
      }
    }
  }

  // --- Day grid drag selection ---
  const [dayDragState, setDayDragState] = useState<{
    startIndex: number;
    currentIndex: number;
    targetStatus: string; // what status to apply on release
  } | null>(null);

  function getDayDragRange(): [number, number] | null {
    if (!dayDragState) return null;
    const a = dayDragState.startIndex;
    const b = dayDragState.currentIndex;
    return a <= b ? [a, b] : [b, a];
  }

  function isDayInDragRange(index: number): boolean {
    const range = getDayDragRange();
    if (!range) return false;
    return index >= range[0] && index <= range[1];
  }

  function handleDayMouseDown(index: number, day: AssignmentDay) {
    // Determine what status to paint: opposite of clicked day
    const targetStatus = day.status === "scheduled" ? "cancelled" : "scheduled";
    setDayDragState({ startIndex: index, currentIndex: index, targetStatus });
  }

  function handleDayMouseEnter(index: number) {
    if (dayDragState) {
      setDayDragState((prev) => prev ? { ...prev, currentIndex: index } : null);
    }
  }

  function finalizeDayDrag() {
    if (!dayDragState || !displayAssignment) { setDayDragState(null); return; }
    const range = getDayDragRange();
    if (!range) { setDayDragState(null); return; }

    const days = displayAssignment.assignmentDays.slice(range[0], range[1] + 1);
    toggleDays(days, dayDragState.targetStatus);
    setDayDragState(null);
  }

  useEffect(() => {
    if (!dayDragState) return;
    function handleUp() { finalizeDayDrag(); }
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  });

  const displayAssignment = fullAssignment || existingAssignment;

  // Resolve the currently-selected site's notes (create or edit mode)
  const selectedSite = isEdit
    ? displayAssignment?.jobSite
    : sites.find((s) => s.id === form.jobSiteId);
  const siteNotes = selectedSite && "notes" in selectedSite ? (selectedSite as { notes?: string | null }).notes : null;

  // Count scheduled/cancelled days
  const scheduledCount =
    displayAssignment?.assignmentDays.filter((d) => d.status === "scheduled")
      .length || 0;
  const cancelledCount =
    displayAssignment?.assignmentDays.filter((d) => d.status === "cancelled")
      .length || 0;

  return (
    <div className="w-full sm:max-w-sm h-full bg-card border-l shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div>
          <h3 className="font-bold text-base">
            {isEdit ? "配置編集" : "新規配置"}
          </h3>
          {date && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(date + "T00:00:00"), "M月d日(E)", { locale: ja })}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Staff info */}
        {staffInfo && (
          <div className="flex items-center gap-2.5 p-2.5 bg-muted/50 rounded-lg">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: staffInfo.branchOffice?.color || "#666" }}
            >
              {staffInfo.name.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-sm">{staffInfo.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {staffInfo.employeeCode} · {staffInfo.branchOffice?.name}
              </div>
            </div>
          </div>
        )}

        {isEdit && displayAssignment ? (
          <>
            {/* 未割当配置: スタッフ割当 UI */}
            {isUnassignedEdit && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 font-medium text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  未割当配置 — スタッフを選んで割当
                </div>
                {staffInfo ? (
                  <div className="flex items-center gap-2.5 p-2 bg-white rounded">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: staffInfo.branchOffice?.color || "#666" }}
                    >
                      {staffInfo.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{staffInfo.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {staffInfo.employeeCode} · {staffInfo.branchOffice?.name}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setSelectedStaffId(null);
                        setStaffInfo(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Input
                      placeholder="スタッフ名で検索..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="text-xs h-9 bg-white"
                      autoFocus
                    />
                    {allStaff.length > 0 && (
                      <div className="max-h-[200px] overflow-auto border rounded-md bg-white">
                        {allStaff
                          .filter((s) =>
                            !staffSearch.trim() ||
                            s.name.toLowerCase().includes(staffSearch.trim().toLowerCase()) ||
                            s.employeeCode.toLowerCase().includes(staffSearch.trim().toLowerCase())
                          )
                          .map((s) => {
                            const av = s.availability;
                            const isFullyFree = !av || av.freeDays === av.totalDays;
                            const isFullyBusy = !!av && av.freeDays === 0 && av.totalDays > 0;
                            const isPartial = !!av && av.freeDays > 0 && av.busyDays > 0;
                            const conflictNames = av?.conflicts.map((c) => c.siteName).join(", ");
                            return (
                              <button
                                key={s.id}
                                className={cn(
                                  "w-full px-2.5 py-1.5 text-left hover:bg-accent flex items-center gap-2 text-xs transition-colors",
                                  isFullyBusy && "opacity-60"
                                )}
                                title={
                                  av
                                    ? `期間 ${av.totalDays}日中 空き ${av.freeDays}日 / 競合 ${av.busyDays}日${conflictNames ? `（${conflictNames}）` : ""}`
                                    : undefined
                                }
                                onClick={() => {
                                  setSelectedStaffId(s.id);
                                  setStaffInfo(s);
                                  setStaffSearch("");
                                }}
                              >
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                  style={{ backgroundColor: s.branchOffice?.color || "#666" }}
                                >
                                  {s.name.charAt(0)}
                                </div>
                                <span className="truncate">{s.name}</span>
                                <span className="text-muted-foreground ml-auto shrink-0">{s.employeeCode}</span>
                                {av && (
                                  <span
                                    className={cn(
                                      "shrink-0 rounded px-1 text-[10px] font-medium tabular-nums",
                                      isFullyFree && "bg-emerald-100 text-emerald-700",
                                      isPartial && "bg-amber-100 text-amber-700",
                                      isFullyBusy && "bg-rose-100 text-rose-700"
                                    )}
                                  >
                                    {isFullyFree && `空 ${av.totalDays}日`}
                                    {isPartial && `空${av.freeDays}/${av.totalDays}`}
                                    {isFullyBusy && `× ${av.totalDays}日`}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Site info */}
            <div
              className="p-3 rounded-lg flex items-start gap-2.5"
              style={{
                backgroundColor:
                  displayAssignment.jobSite.branchOffice.color + "12",
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: displayAssignment.jobSite.branchOffice.color }}
              />
              <div>
                <div className="font-medium text-sm">
                  {displayAssignment.jobSite.name}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {displayAssignment.jobSite.siteCode}
                </div>
              </div>
            </div>

            {/* Quick toggles row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  区分
                </Label>
                <div className="flex border rounded-md overflow-hidden">
                  <button
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium transition-colors",
                      form.assignmentType === "commute"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, assignmentType: "commute" }))
                    }
                  >
                    {ASSIGNMENT_TYPES.commute}
                  </button>
                  <button
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium transition-colors border-l",
                      form.assignmentType === "business_trip"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, assignmentType: "business_trip" }))
                    }
                  >
                    {ASSIGNMENT_TYPES.business_trip}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  シフト
                </Label>
                <div className="flex border rounded-md overflow-hidden">
                  <button
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1",
                      form.shiftType === "day"
                        ? "bg-amber-500 text-white"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, shiftType: "day" }))
                    }
                  >
                    <Sun className="h-3 w-3" /> 日勤
                  </button>
                  <button
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium transition-colors border-l flex items-center justify-center gap-1",
                      form.shiftType === "night"
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, shiftType: "night" }))
                    }
                  >
                    <Moon className="h-3 w-3" /> 夜勤
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> 時間
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startTime: e.target.value }))
                  }
                  className="text-xs h-8 px-1.5"
                />
                <span className="text-muted-foreground text-xs">-</span>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endTime: e.target.value }))
                  }
                  className="text-xs h-8 px-1.5"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                <Truck className="h-3 w-3" /> 車両
              </Label>
              <select
                value={form.vehicleId ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    vehicleId: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="w-full h-8 rounded-md border px-2 text-xs bg-background"
              >
                <option value="">— なし —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                    {v.name ? ` (${v.name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                <Coins className="h-3 w-3" /> 現場別日給 (上書き)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                placeholder="空欄=スタッフ基本日当を使用"
                value={form.dailyRateOverride}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dailyRateOverride: e.target.value }))
                }
                className="text-xs h-8"
              />
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> 備考
              </Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                rows={2}
                placeholder="この配置に関する注意点など"
                className="text-xs"
              />
            </div>

            {siteNotes && (
              <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-medium text-amber-800 uppercase tracking-wide">現場備考</div>
                  <div className="text-[11px] text-amber-900 whitespace-pre-wrap">{siteNotes}</div>
                </div>
              </div>
            )}

            {/* Conflict & Insurance Warnings (PUT 時の 409 レスポンス) */}
            {showForceConfirm && (
              <div className="space-y-2">
                {conflicts.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-700 font-medium text-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      二重配置の警告
                    </div>
                    {conflicts.map((c, i) => (
                      <div key={i} className="text-[11px] text-amber-600">
                        <span className="font-medium">{c.siteName}</span> に {c.dates.length}日間 配置済み
                      </div>
                    ))}
                  </div>
                )}
                {insuranceWarning && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-red-700 font-medium text-xs">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      保険種別の不一致
                    </div>
                    <div className="text-[11px] text-red-600">
                      この現場は
                      <span className="font-medium">
                        {insuranceWarning.siteRequirement === "company_only" ? "社保のみ" : "国保のみ"}
                      </span>
                      受入可能です
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Day-level toggle grid */}
            {displayAssignment.assignmentDays.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> 日別管理
                  </Label>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    出勤 <strong className="text-foreground">{scheduledCount}</strong>日
                    {cancelledCount > 0 && (
                      <> / 休み <strong className="text-destructive">{cancelledCount}</strong>日</>
                    )}
                  </span>
                </div>
                <div
                  className={cn(
                    "grid grid-cols-7 gap-1 select-none",
                    dayDragState && "cursor-crosshair"
                  )}
                >
                  {displayAssignment.assignmentDays.map((day, index) => {
                    const d = new Date(day.date + "T00:00:00");
                    const dayNum = d.getDate();
                    const dayOfWeek = d.getDay();
                    const inDrag = isDayInDragRange(index);
                    // Show preview: if in drag range, show the target status
                    const previewStatus = inDrag && dayDragState
                      ? dayDragState.targetStatus
                      : day.status;
                    const isScheduled = previewStatus === "scheduled";
                    const isTodayDay =
                      day.date === format(new Date(), "yyyy-MM-dd");
                    return (
                      <div
                        key={day.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleDayMouseDown(index, day);
                        }}
                        onMouseEnter={() => handleDayMouseEnter(index)}
                        className={cn(
                          "relative p-1 rounded-md text-center text-xs border cursor-pointer select-none",
                          "transition-all duration-75",
                          "hover:ring-2 hover:ring-primary/30",
                          isScheduled
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/50 text-muted-foreground border-transparent",
                          !isScheduled && "line-through opacity-60",
                          dayOfWeek === 0 && "!text-red-400",
                          isTodayDay && isScheduled && "ring-2 ring-primary/50",
                          inDrag && "ring-2 ring-primary/50 scale-105"
                        )}
                        title={`${day.date} ${format(d, "E", { locale: ja })} — ドラッグで範囲選択`}
                      >
                        <div className="text-[10px] leading-none mb-0.5 opacity-60">
                          {format(d, "E", { locale: ja })}
                        </div>
                        <div className="font-medium leading-none">{dayNum}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  クリックで切替 · ドラッグで範囲選択
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Create mode */}
            {isSiteMode && (
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
                  <span className="h-3 w-3 text-center">👤</span> スタッフ *
                </Label>
                {staffInfo ? (
                  <div className="flex items-center gap-2.5 p-2.5 bg-muted/50 rounded-lg">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: staffInfo.branchOffice?.color || "#666" }}
                    >
                      {staffInfo.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{staffInfo.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {staffInfo.employeeCode} · {staffInfo.branchOffice?.name}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setSelectedStaffId(null);
                        setStaffInfo(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Input
                      placeholder="スタッフ名で検索..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="text-xs h-9"
                      autoFocus
                    />
                    {allStaff.length > 0 && (
                      <div className="max-h-[200px] overflow-auto border rounded-md">
                        {allStaff
                          .filter((s) =>
                            !staffSearch.trim() ||
                            s.name.toLowerCase().includes(staffSearch.trim().toLowerCase()) ||
                            s.employeeCode.toLowerCase().includes(staffSearch.trim().toLowerCase())
                          )
                          .map((s) => {
                            const av = s.availability;
                            const isFullyFree = !av || av.freeDays === av.totalDays;
                            const isFullyBusy = !!av && av.freeDays === 0 && av.totalDays > 0;
                            const isPartial = !!av && av.freeDays > 0 && av.busyDays > 0;
                            const conflictNames = av?.conflicts.map((c) => c.siteName).join(", ");
                            return (
                              <button
                                key={s.id}
                                className={cn(
                                  "w-full px-2.5 py-1.5 text-left hover:bg-accent flex items-center gap-2 text-xs transition-colors",
                                  isFullyBusy && "opacity-60"
                                )}
                                title={
                                  av
                                    ? `期間 ${av.totalDays}日中 空き ${av.freeDays}日 / 競合 ${av.busyDays}日${conflictNames ? `（${conflictNames}）` : ""}`
                                    : undefined
                                }
                                onClick={() => {
                                  setSelectedStaffId(s.id);
                                  setStaffInfo(s);
                                  setStaffSearch("");
                                }}
                              >
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                  style={{ backgroundColor: s.branchOffice?.color || "#666" }}
                                >
                                  {s.name.charAt(0)}
                                </div>
                                <span className="truncate">{s.name}</span>
                                <span className="text-muted-foreground ml-auto shrink-0">{s.employeeCode}</span>
                                {av && (
                                  <span
                                    className={cn(
                                      "shrink-0 rounded px-1 text-[10px] font-medium tabular-nums",
                                      isFullyFree && "bg-emerald-100 text-emerald-700",
                                      isPartial && "bg-amber-100 text-amber-700",
                                      isFullyBusy && "bg-rose-100 text-rose-700"
                                    )}
                                  >
                                    {isFullyFree && `空 ${av.totalDays}日`}
                                    {isPartial && `空${av.freeDays}/${av.totalDays}`}
                                    {isFullyBusy && `× ${av.totalDays}日`}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div>
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
                <MapPin className="h-3 w-3" /> 現場 *
              </Label>
              <SiteSelect
                sites={sites}
                value={form.jobSiteId}
                onChange={(id) => setForm((p) => ({ ...p, jobSiteId: id }))}
                autoFocus={!isEdit && !isSiteMode}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">開始日 *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startDate: e.target.value }))
                  }
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">終了日 *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endDate: e.target.value }))
                  }
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5 block">
                  区分
                </Label>
                <div className="flex border rounded-md overflow-hidden">
                  <button
                    className={cn(
                      "flex-1 py-2 text-xs font-medium transition-colors",
                      form.assignmentType === "commute"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, assignmentType: "commute" }))
                    }
                  >
                    {ASSIGNMENT_TYPES.commute}
                  </button>
                  <button
                    className={cn(
                      "flex-1 py-2 text-xs font-medium transition-colors border-l",
                      form.assignmentType === "business_trip"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, assignmentType: "business_trip" }))
                    }
                  >
                    {ASSIGNMENT_TYPES.business_trip}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5 block">
                  シフト
                </Label>
                <div className="flex border rounded-md overflow-hidden">
                  <button
                    className={cn(
                      "flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1",
                      form.shiftType === "day"
                        ? "bg-amber-500 text-white"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, shiftType: "day" }))
                    }
                  >
                    <Sun className="h-3 w-3" /> 日勤
                  </button>
                  <button
                    className={cn(
                      "flex-1 py-2 text-xs font-medium transition-colors border-l flex items-center justify-center gap-1",
                      form.shiftType === "night"
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setForm((p) => ({ ...p, shiftType: "night" }))
                    }
                  >
                    <Moon className="h-3 w-3" /> 夜勤
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> 時間
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startTime: e.target.value }))
                  }
                  className="text-xs h-9"
                />
                <span className="text-muted-foreground text-sm">~</span>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endTime: e.target.value }))
                  }
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <Truck className="h-3 w-3" /> 車両
              </Label>
              <select
                value={form.vehicleId ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    vehicleId: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="w-full h-9 rounded-md border px-2 text-xs bg-background"
              >
                <option value="">— なし —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                    {v.name ? ` (${v.name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <Coins className="h-3 w-3" /> 現場別日給 (上書き)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                placeholder="空欄=スタッフ基本日当を使用"
                value={form.dailyRateOverride}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dailyRateOverride: e.target.value }))
                }
                className="text-xs h-9"
              />
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> 備考
              </Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                rows={2}
                placeholder="この配置に関する注意点など"
                className="text-xs"
              />
            </div>

            {siteNotes && (
              <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-medium text-amber-800 uppercase tracking-wide">現場備考</div>
                  <div className="text-[11px] text-amber-900 whitespace-pre-wrap">{siteNotes}</div>
                </div>
              </div>
            )}

            {/* Conflict & Insurance Warnings */}
            {showForceConfirm && (
              <div className="space-y-2">
                {conflicts.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-700 font-medium text-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      二重配置の警告
                    </div>
                    {conflicts.map((c, i) => (
                      <div key={i} className="text-[11px] text-amber-600">
                        <span className="font-medium">{c.siteName}</span> に {c.dates.length}日間 配置済み
                      </div>
                    ))}
                  </div>
                )}
                {insuranceWarning && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-red-700 font-medium text-xs">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      保険種別の不一致
                    </div>
                    <div className="text-[11px] text-red-600">
                      この現場は
                      <span className="font-medium">
                        {insuranceWarning.siteRequirement === "company_only" ? "社保のみ" : "国保のみ"}
                      </span>
                      受入可能です
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-muted/20 flex gap-2">
        {isEdit ? (
          showForceConfirm ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={() => {
                  setShowForceConfirm(false);
                  setConflicts([]);
                  setInsuranceWarning(null);
                }}
                disabled={loading}
              >
                戻る
              </Button>
              <Button
                onClick={() => handleUpdate(true)}
                disabled={loading}
                className="flex-1 h-9 bg-amber-600 hover:bg-amber-700"
                size="sm"
              >
                {loading ? "更新中..." : "それでも保存"}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => handleUpdate()}
                disabled={loading}
                className={cn(
                  "flex-1 h-9",
                  isUnassignedEdit && staffId && "bg-emerald-600 hover:bg-emerald-700"
                )}
                size="sm"
              >
                {loading
                  ? "更新中..."
                  : isUnassignedEdit && staffId
                    ? "スタッフを割当て保存"
                    : isUnassignedEdit
                      ? "未割当のまま保存"
                      : "更新する"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )
        ) : showForceConfirm ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9"
              onClick={() => {
                setShowForceConfirm(false);
                setConflicts([]);
                setInsuranceWarning(null);
              }}
              disabled={loading}
            >
              戻る
            </Button>
            <Button
              onClick={() => handleCreate(true)}
              disabled={loading}
              className="flex-1 h-9 bg-amber-600 hover:bg-amber-700"
              size="sm"
            >
              {loading ? "作成中..." : "それでも配置する"}
            </Button>
          </>
        ) : (
          <Button
            onClick={() => handleCreate()}
            disabled={loading || !form.jobSiteId}
            className={cn(
              "flex-1 h-9",
              isSiteMode && !staffId && "bg-amber-600 hover:bg-amber-700"
            )}
            size="sm"
          >
            {loading
              ? "作成中..."
              : isSiteMode && !staffId
                ? "未割当のまま作成"
                : "配置を作成"}
          </Button>
        )}
      </div>
    </div>
  );
}
