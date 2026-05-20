"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  FileText,
  Search,
  X,
  Users,
  Building2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getWeekDates,
  formatDateJP,
  formatDateISO,
  formatDateRange,
  isWeekend,
  isSunday,
  addWeeks,
  subWeeks,
  addDays,
  parseISO,
  differenceInDays,
} from "@/lib/date-utils";
import { AssignmentPanel } from "./assignment-panel";
import { BulkAssignmentPanel } from "./bulk-assignment-panel";
import { CalendarPrint } from "./calendar-print";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { getHolidayName } from "@/lib/holidays";
import type { Assignment, StaffRow, HeadcountData, HeadcountBySite, BranchOffice, ContextMenu } from "./types";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function CalendarView({
  branchOffices,
}: {
  branchOffices: BranchOffice[];
}) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [today, setToday] = useState("");
  useEffect(() => { setToday(formatDateISO(new Date())); }, []);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  // パネルにそのまま渡せる完全な sites（必要保険・必須資格を含む）
  type FullSite = {
    id: number;
    name: string;
    siteCode: string;
    workCategory?: string;
    requiredHeadcount?: number | null;
    requiredInsurance?: string | null;
    branchOfficeId?: number;
    clientCode?: string | null;
    clientName?: string | null;
    notes?: string | null;
    belongings?: string | null;
    contactName1?: string | null;
    contactTel1?: string | null;
    qualificationBonuses?: { qualificationId: number; isRequired?: boolean }[];
    branchOffice: { color: string; name: string };
  };
  const [allSites, setAllSites] = useState<FullSite[]>([]);
  const [allVehicles, setAllVehicles] = useState<{ id: number; plateNumber: string; name: string | null; isActive: boolean }[]>([]);
  const [workCategoryFilter, setWorkCategoryFilter] = useState<string>("");

  // ドラッグ中の未割当 Assignment ID（HTML5 DnD）
  // 議事録: 「上に未割り当て案件を表示」「ボックスをドラッグして配置」
  const [draggingUnassignedId, setDraggingUnassignedId] = useState<number | null>(null);
  const [dropTargetCellKey, setDropTargetCellKey] = useState<string | null>(null);
  const [dropAssigning, setDropAssigning] = useState(false);
  const [unassignedAssignments, setUnassignedAssignments] = useState<Assignment[]>([]);
  const [headcounts, setHeadcounts] = useState<HeadcountData[]>([]);
  const [headcountBySite, setHeadcountBySite] = useState<HeadcountBySite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<number[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [weeksToShow, setWeeksToShow] = useState(1);
  // 任意の期間（日付範囲）を表示する。set されている間は週ベースの allDates ロジックを上書きする
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false);
  const [rangeDraftFrom, setRangeDraftFrom] = useState("");
  const [rangeDraftTo, setRangeDraftTo] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  // hoveredCell の state は廃止（500セル全体の再レンダーを誘発していた）。
  // 「+」ボタンのホバー表示は CSS の group-hover/cell クラスで実現する。
  const gridRef = useRef<HTMLDivElement>(null);

  const [showPrint, setShowPrint] = useState(false);
  const [printStart, setPrintStart] = useState("");
  const [printEnd, setPrintEnd] = useState("");
  const [printPopoverOpen, setPrintPopoverOpen] = useState(false);

  // --- View mode: staff / site ---
  const [viewMode, setViewMode] = useState<"staff" | "site">("site");

  function switchViewMode(mode: "staff" | "site") {
    setViewMode(mode);
    // Reset filters when switching modes
    setStaffFilter("");
    setSelectedStaffIds(new Set());
    setStaffPickerSearch("");
    setStaffPickerOpen(false);
  }

  // --- Staff filter (search or select mode) ---
  const [staffFilterMode, setStaffFilterMode] = useState<"search" | "select">("search");
  const [staffFilter, setStaffFilter] = useState("");
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<number>>(new Set());
  const [staffPickerSearch, setStaffPickerSearch] = useState("");

  function toggleSelectedStaff(id: number) {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearStaffFilter() {
    setStaffFilter("");
    setSelectedStaffIds(new Set());
    setStaffPickerSearch("");
  }

  // --- Bulk assignment mode ---
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);

  function toggleBulkStaff(id: number) {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitBulkMode() {
    setBulkMode(false);
    setBulkSelectedIds(new Set());
    setBulkPanelOpen(false);
  }

  // --- Drag-to-select (empty cell → new assignment) ---
  const [dragState, setDragState] = useState<{
    staffId: number;
    startDate: string;
    currentDate: string;
  } | null>(null);
  const isDragging = dragState !== null;

  // --- Drag-to-move (existing card → different staff / different date) ---
  const [moveDrag, setMoveDrag] = useState<{
    assignment: Assignment;
    fromStaffId: number;
    fromDate: string;
    currentStaffId: number;
    currentDate: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const isMoveDragging = moveDrag !== null;

  // --- Confirm move modal ---
  const [moveConfirm, setMoveConfirm] = useState<{
    assignment: Assignment;
    fromStaffName: string;
    toStaffId: number;
    toStaffName: string;
    dayShift: number; // positive = forward, negative = backward
  } | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);

  // Generate dates for the view。customRange が指定されていればそちら優先、無ければ週ベース。
  const allDates = useMemo(() => {
    if (customRange) {
      const from = parseISO(customRange.from);
      const to = parseISO(customRange.to);
      const len = Math.max(0, differenceInDays(to, from)) + 1;
      return Array.from({ length: len }, (_, i) => addDays(from, i));
    }
    const arr: Date[] = [];
    for (let w = 0; w < weeksToShow; w++) {
      const dates = getWeekDates(addWeeks(currentDate, w));
      arr.push(...dates);
    }
    return arr;
  }, [currentDate, weeksToShow, customRange]);
  const startDate = formatDateISO(allDates[0]);
  const endDate = formatDateISO(allDates[allDates.length - 1]);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({ startDate, endDate });
      if (selectedBranches.length > 0) {
        params.set("branchOfficeIds", selectedBranches.join(","));
      }

      try {
        const res = await fetch(`/api/calendar?${params}`);
        const data = await res.json();
        setStaffRows(data.staff);
        setHeadcounts(data.dailyHeadcounts);
        setHeadcountBySite(data.headcountBySite);
        setUnassignedAssignments(data.unassignedAssignments || []);
      } catch (err) {
        console.error("Failed to fetch calendar data:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate, selectedBranches]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 未割当バナー用の安定したハンドラ（参照同一性を保つことで memo の効果を出す）
  const handleUnassignedDragStart = useCallback((id: number) => {
    setDraggingUnassignedId(id);
  }, []);
  const handleUnassignedDragEnd = useCallback(() => {
    setDraggingUnassignedId(null);
    setDropTargetCellKey(null);
  }, []);
  const handleUnassignedCardClick = useCallback((a: Assignment) => {
    setSelectedStaffId(null);
    setSelectedSiteId(null);
    setSelectedDate(a.startDate || "");
    setSelectedAssignment(a);
    setPanelOpen(true);
  }, []);

  // 未割当配置をスタッフに割り当て（ドラッグ&ドロップで実行）
  // 議事録: 「ここに2割当てを入れますそこにアサインしたら消えてドラッグして落としていく」
  const assignUnassignedToStaff = useCallback(
    async (assignmentId: number, staffId: number, force = false) => {
      setDropAssigning(true);
      try {
        const res = await fetch(`/api/assignments/${assignmentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffId, force }),
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          const conflictNames = (data.conflicts as { siteName: string }[] | undefined)
            ?.map((c) => c.siteName)
            .join(", ");
          const insuranceMsg = data.insuranceWarning ? "保険種別不一致" : "";
          const orderOverflowMsg = Array.isArray(data.orderHeadcountWarnings) && data.orderHeadcountWarnings.length > 0
            ? `オーダー人数超過 ${data.orderHeadcountWarnings.length}日`
            : "";
          const msg = [
            conflictNames && `競合: ${conflictNames}`,
            insuranceMsg,
            orderOverflowMsg,
          ]
            .filter(Boolean)
            .join(" / ");
          if (window.confirm(`警告 (${msg})\nそれでも割り当てますか？`)) {
            return assignUnassignedToStaff(assignmentId, staffId, true);
          }
          return;
        }
        if (!res.ok) {
          alert("割り当てに失敗しました");
          return;
        }
        await fetchData(true);
      } finally {
        setDropAssigning(false);
        setDraggingUnassignedId(null);
        setDropTargetCellKey(null);
      }
    },
    [fetchData],
  );

  // 現場マスタと車両マスタは初回 1 回だけ取得し、AssignmentPanel にも props で渡す
  // （以前は AssignmentPanel が毎回 fetch していたためモーダルを開くたびに 200ms+ の遅延があった）
  useEffect(() => {
    fetch("/api/sites?status=active")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setAllSites(data);
      })
      .catch(() => {});
    fetch("/api/vehicles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setAllVehicles(data.filter((v: { isActive: boolean }) => v.isActive));
        }
      })
      .catch(() => {});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "Escape") {
        setPanelOpen(false);
        setContextMenu(null);
      }
      if (e.key === "ArrowLeft" && !panelOpen) {
        e.preventDefault();
        setCurrentDate((d) => subWeeks(d, 1));
      }
      if (e.key === "ArrowRight" && !panelOpen) {
        e.preventDefault();
        setCurrentDate((d) => addWeeks(d, 1));
      }
      if (e.key === "t" && !panelOpen) {
        setCurrentDate(new Date());
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [panelOpen]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  function goToday() {
    setCustomRange(null);
    setCurrentDate(new Date());
  }

  function goPrev() {
    if (customRange) {
      // 任意範囲の場合は範囲幅ぶん前にシフト
      const from = parseISO(customRange.from);
      const to = parseISO(customRange.to);
      const len = differenceInDays(to, from) + 1;
      setCustomRange({
        from: formatDateISO(addDays(from, -len)),
        to: formatDateISO(addDays(to, -len)),
      });
      return;
    }
    setCurrentDate((d) => subWeeks(d, 1));
  }

  function goNext() {
    if (customRange) {
      const from = parseISO(customRange.from);
      const to = parseISO(customRange.to);
      const len = differenceInDays(to, from) + 1;
      setCustomRange({
        from: formatDateISO(addDays(from, len)),
        to: formatDateISO(addDays(to, len)),
      });
      return;
    }
    setCurrentDate((d) => addWeeks(d, 1));
  }

  function applyCustomRange() {
    if (!rangeDraftFrom || !rangeDraftTo) return;
    if (rangeDraftFrom > rangeDraftTo) {
      toast.error("開始日は終了日以前にしてください");
      return;
    }
    const days = differenceInDays(parseISO(rangeDraftTo), parseISO(rangeDraftFrom)) + 1;
    if (days > 62) {
      toast.error("一度に表示できる範囲は 62 日までです");
      return;
    }
    setCustomRange({ from: rangeDraftFrom, to: rangeDraftTo });
    setRangePopoverOpen(false);
  }

  function toggleBranch(id: number) {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  }

  // Build a set of all visible date strings for fast lookup
  // 各セルから O(1) で日付インデックスを引けるようにキャッシュ
  const allDateStrings = useMemo(() => allDates.map(formatDateISO), [allDates]);
  const dateIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    allDateStrings.forEach((d, i) => m.set(d, i));
    return m;
  }, [allDateStrings]);
  // 各日付の表示メタを 1 度だけ計算（500+ セルそれぞれで isSunday/isWeekend/getHolidayName を
  // 呼ばない）
  const dateMeta = useMemo(
    () =>
      allDates.map((date, i) => {
        const dateStr = allDateStrings[i];
        const sunday = isSunday(date);
        const weekend = isWeekend(date);
        const holiday = getHolidayName(dateStr);
        return {
          date,
          dateStr,
          sunday,
          weekend,
          holiday,
          isRedDay: sunday || !!holiday,
        };
      }),
    [allDates, allDateStrings],
  );

  // 配置インデックス: staffId → date → Assignment[]（O(1) 参照、セル毎のフィルタを避ける）
  // 事前断り(pre_declined)もカレンダーに表示する（カウントには含まれないが、視覚的に残す）。
  // staffRows が変わったときだけ再計算するため useMemo
  const assignmentsByStaffDate = useMemo(() => {
    const map = new Map<number, Map<string, Assignment[]>>();
    for (const s of staffRows) {
      const dateMap = new Map<string, Assignment[]>();
      for (const a of s.assignments) {
        for (const d of a.assignmentDays) {
          if (d.status !== "scheduled" && d.status !== "pre_declined") continue;
          const list = dateMap.get(d.date);
          if (list) list.push(a);
          else dateMap.set(d.date, [a]);
        }
      }
      map.set(s.id, dateMap);
    }
    return map;
  }, [staffRows]);

  function getAssignmentsForDate(staffId: number, date: string) {
    return assignmentsByStaffDate.get(staffId)?.get(date) ?? [];
  }

  // 配置の当該日が事前断りかどうかを判定するヘルパ（セル描画のスタイル切替用）
  function isPreDeclinedOn(a: Assignment, date: string): boolean {
    return a.assignmentDays.some((d) => d.date === date && d.status === "pre_declined");
  }

  // 日付 → 未割当配置の一覧（日付ヘッダー Popover でその日の未割当を表示するため）
  const unassignedByDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of unassignedAssignments) {
      for (const d of a.assignmentDays) {
        if (d.status !== "scheduled") continue;
        const list = map.get(d.date);
        if (list) list.push(a);
        else map.set(d.date, [a]);
      }
    }
    return map;
  }, [unassignedAssignments]);

  // Determine the position of a date within an assignment's consecutive scheduled run
  // Returns: 'single' | 'start' | 'middle' | 'end'
  // dateIndexMap で O(1) ルックアップ。assignmentDays の Set 化はキャッシュ可能だが
  // 呼び出し回数が限定的なのでこのままにする。
  function getSpanPosition(
    assignment: Assignment,
    dateStr: string
  ): "single" | "start" | "middle" | "end" {
    const idx = dateIndexMap.get(dateStr) ?? -1;
    const prevDateStr = idx > 0 ? allDateStrings[idx - 1] : null;
    const nextDateStr =
      idx >= 0 && idx < allDateStrings.length - 1 ? allDateStrings[idx + 1] : null;

    const scheduledDates = new Set(
      assignment.assignmentDays
        .filter((d) => d.status === "scheduled")
        .map((d) => d.date)
    );

    const hasPrev = prevDateStr !== null && scheduledDates.has(prevDateStr);
    const hasNext = nextDateStr !== null && scheduledDates.has(nextDateStr);

    if (!hasPrev && !hasNext) return "single";
    if (!hasPrev && hasNext) return "start";
    if (hasPrev && hasNext) return "middle";
    return "end";
  }

  function getHeadcount(date: string): number {
    return headcounts.find((h) => h.date === date)?.total || 0;
  }

  function getSiteBreakdown(date: string): HeadcountBySite[] {
    return headcountBySite.filter((h) => h.date === date);
  }

  // Check if a staff member has 2+ assignments on a given date
  function hasDoubleBooking(staffAssignments: Assignment[], dateStr: string): boolean {
    const dayAssignments = staffAssignments.filter((a) =>
      a.assignmentDays.some((d) => d.date === dateStr && d.status === "scheduled")
    );
    return dayAssignments.length >= 2;
  }

  // --- Drag-to-select helpers ---
  function getDragRange(): { from: string; to: string } | null {
    if (!dragState) return null;
    const a = dragState.startDate;
    const b = dragState.currentDate;
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }

  function isCellInDragRange(staffId: number, dateStr: string): boolean {
    if (!dragState || dragState.staffId !== staffId) return false;
    const range = getDragRange();
    if (!range) return false;
    return dateStr >= range.from && dateStr <= range.to;
  }

  function handleCellMouseDown(staffId: number, dateStr: string, e: React.MouseEvent) {
    // Only left click, ignore if panel is open or on assignment cards
    if (e.button !== 0 || panelOpen) return;
    e.preventDefault();
    setDragState({ staffId, startDate: dateStr, currentDate: dateStr });
  }

  function handleCellMouseEnter(staffId: number, dateStr: string) {
    // Extend drag selection when mouse enters a cell on the same staff row
    if (dragState && dragState.staffId === staffId) {
      setDragState((prev) => prev ? { ...prev, currentDate: dateStr } : null);
    }
  }

  function finalizeDrag() {
    if (!dragState) return;
    const range = getDragRange();
    if (!range) { setDragState(null); return; }

    setSelectedStaffId(dragState.staffId);
    setSelectedSiteId(null);
    setSelectedDate(range.from);
    setSelectedAssignment(null);
    setPanelOpen(true);
    // Store the end date so the panel can pick it up
    setDragEndDate(range.to);
    setDragState(null);
  }

  // Global mouseup to finalize drag (also handles releasing outside the grid)
  useEffect(() => {
    if (!isDragging) return;
    function handleMouseUp() { finalizeDrag(); }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  });

  // Separate state for end date to pass to panel
  const [dragEndDate, setDragEndDate] = useState<string>("");

  // --- Site-view drag-to-select (空セル / 同一現場行のドラッグで期間を確保) ---
  const [siteDragState, setSiteDragState] = useState<{
    siteId: number;
    startDate: string;
    currentDate: string;
  } | null>(null);
  const isSiteDragging = siteDragState !== null;

  function getSiteDragRange(): { from: string; to: string } | null {
    if (!siteDragState) return null;
    const a = siteDragState.startDate;
    const b = siteDragState.currentDate;
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }

  function isSiteCellInDragRange(siteId: number, dateStr: string): boolean {
    if (!siteDragState || siteDragState.siteId !== siteId) return false;
    const range = getSiteDragRange();
    if (!range) return false;
    return dateStr >= range.from && dateStr <= range.to;
  }

  function handleSiteCellMouseDown(siteId: number, dateStr: string, e: React.MouseEvent) {
    if (e.button !== 0 || panelOpen) return;
    e.preventDefault();
    setSiteDragState({ siteId, startDate: dateStr, currentDate: dateStr });
  }

  function handleSiteCellMouseEnter(siteId: number, dateStr: string) {
    if (siteDragState && siteDragState.siteId === siteId) {
      setSiteDragState((prev) => prev ? { ...prev, currentDate: dateStr } : null);
    }
  }

  function finalizeSiteDrag() {
    if (!siteDragState) return;
    const range = getSiteDragRange();
    if (!range) { setSiteDragState(null); return; }
    setSelectedStaffId(null);
    setSelectedSiteId(siteDragState.siteId);
    setSelectedDate(range.from);
    setDragEndDate(range.to);
    setSelectedAssignment(null);
    setPanelOpen(true);
    setSiteDragState(null);
  }

  useEffect(() => {
    if (!isSiteDragging) return;
    function handleUp() { finalizeSiteDrag(); }
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  });

  // --- Move drag handlers ---
  function handleCardDragStart(assignment: Assignment, staffId: number, dateStr: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMoveDrag({
      assignment, fromStaffId: staffId, fromDate: dateStr,
      currentStaffId: staffId, currentDate: dateStr,
      mouseX: e.clientX, mouseY: e.clientY,
    });
  }

  function handleCellMouseEnterForMove(staffId: number, dateStr: string) {
    if (moveDrag) {
      setMoveDrag((prev) => prev ? { ...prev, currentStaffId: staffId, currentDate: dateStr } : null);
    }
  }

  function calcDayShift(fromDate: string, toDate: string): number {
    const from = new Date(fromDate + "T00:00:00");
    const to = new Date(toDate + "T00:00:00");
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  function finalizeMoveDrag() {
    if (!moveDrag) return;
    const staffChanged = moveDrag.currentStaffId !== moveDrag.fromStaffId;
    const dayShift = calcDayShift(moveDrag.fromDate, moveDrag.currentDate);

    if (staffChanged || dayShift !== 0) {
      const fromStaff = staffRows.find((s) => s.id === moveDrag.fromStaffId);
      const toStaff = staffRows.find((s) => s.id === moveDrag.currentStaffId);
      setMoveConfirm({
        assignment: moveDrag.assignment,
        fromStaffName: fromStaff?.name || "",
        toStaffId: moveDrag.currentStaffId,
        toStaffName: toStaff?.name || "",
        dayShift,
      });
    }
    setMoveDrag(null);
  }

  useEffect(() => {
    if (!isMoveDragging) return;
    function handleUp() { finalizeMoveDrag(); }
    function handleMouseMove(e: MouseEvent) {
      setMoveDrag((prev) => prev ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : null);
    }
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  });

  async function confirmMove() {
    if (!moveConfirm) return;
    setMoveLoading(true);
    try {
      const res = await fetch(`/api/assignments/${moveConfirm.assignment.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStaffId: moveConfirm.toStaffId,
          dayShift: moveConfirm.dayShift,
        }),
      });
      if (res.ok) {
        toast.success("配置を移動しました");
        fetchData(true);
      } else {
        toast.error("移動に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setMoveLoading(false);
      setMoveConfirm(null);
    }
  }

  function handleCellClick(staffId: number, date: string) {
    // Single click (no drag) is handled by mousedown+mouseup flow
    // This is a fallback for accessibility
    if (isDragging) return;
    setSelectedStaffId(staffId);
    setSelectedSiteId(null);
    setSelectedDate(date);
    setDragEndDate(date);
    setSelectedAssignment(null);
    setPanelOpen(true);
  }

  function handleAssignmentClick(assignment: Assignment, staffId: number | null) {
    setSelectedAssignment(assignment);
    setSelectedStaffId(staffId);
    setSelectedSiteId(null);
    setSelectedDate("");
    setDragEndDate("");
    setPanelOpen(true);
  }

  function handleContextMenu(
    e: React.MouseEvent,
    assignment: Assignment,
    staffId: number | null,
    date: string
  ) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      assignment,
      staffId,
      date,
    });
  }

  async function handleDeleteAssignment(id: number) {
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("配置を削除しました");
        fetchData(true);
      }
    } catch {
      toast.error("削除に失敗しました");
    }
    setContextMenu(null);
  }

  // Max headcount for heatmap intensity
  const maxHeadcount = Math.max(...headcounts.map((h) => h.total), 1);
  const isCompact = weeksToShow >= 4;

  // Filter staff rows by search text or selected IDs（参照を安定化）
  const filteredStaffRows = useMemo(() => {
    if (staffFilterMode === "search" && staffFilter.trim()) {
      const q = staffFilter.trim().toLowerCase();
      return staffRows.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.displayName && s.displayName.toLowerCase().includes(q)) ||
        s.employeeCode.toLowerCase().includes(q)
      );
    }
    if (staffFilterMode === "select" && selectedStaffIds.size > 0) {
      return staffRows.filter((s) => selectedStaffIds.has(s.id));
    }
    return staffRows;
  }, [staffRows, staffFilterMode, staffFilter, selectedStaffIds]);

  // --- Site-based view: pivot data by job site ---
  type SiteStaffEntry = {
    staffId: number | null; // null=未割当
    staffName: string;
    branchColor: string;
    assignmentType: string;
    assignment: Assignment;
    dayStatus: string; // "scheduled" | "pre_declined"（現状この2つだけ表示対象）
  };
  type SiteRow = {
    id: number;
    name: string;
    siteCode: string;
    clientCode?: string | null;
    clientName?: string | null;
    workCategory?: string;
    requiredHeadcount?: number | null;
    branchOffice: { color: string; name: string };
    staffByDate: Map<string, SiteStaffEntry[]>;
    hasUnassigned: boolean;
    // 期間内の未割当 Assignment.id の集合（1 Assignment = 1 スロット）
    unassignedIds: Set<number>;
    // 日付 → その日に現場から指示された発注人数（同一現場・同日の配置の最大値）。
    // 配置単位ではなく AssignmentDay 単位で管理しているので、日別に持つ。
    orderByDate: Map<string, number>;
  };

  const siteRows = useMemo<SiteRow[]>(() => {
    const siteMap = new Map<number, SiteRow>();
    // 現場マスタ全件をベースに行を作成（アサインメントが無い現場も表示）
    for (const site of allSites) {
      siteMap.set(site.id, {
        id: site.id,
        name: site.name,
        siteCode: site.siteCode,
        clientCode: site.clientCode,
        clientName: site.clientName,
        workCategory: site.workCategory,
        requiredHeadcount: site.requiredHeadcount,
        branchOffice: site.branchOffice,
        staffByDate: new Map(),
        hasUnassigned: false,
        unassignedIds: new Set(),
        orderByDate: new Map(),
      });
    }
    for (const staff of staffRows) {
      for (const assignment of staff.assignments) {
        const site = assignment.jobSite;
        if (!siteMap.has(site.id)) {
          siteMap.set(site.id, {
            id: site.id,
            name: site.name,
            siteCode: site.siteCode,
            branchOffice: site.branchOffice,
            staffByDate: new Map(),
            hasUnassigned: false,
            unassignedIds: new Set(),
            orderByDate: new Map(),
          });
        }
        const row = siteMap.get(site.id)!;
        for (const day of assignment.assignmentDays) {
          // 事前断り(pre_declined) も表示（取消線スタイルで残す）。キャンセルは非表示。
          if (day.status !== "scheduled" && day.status !== "pre_declined") continue;
          if (!row.staffByDate.has(day.date)) row.staffByDate.set(day.date, []);
          row.staffByDate.get(day.date)!.push({
            staffId: staff.id,
            staffName: staff.displayName || staff.name,
            branchColor: staff.branchOffice.color,
            assignmentType: assignment.assignmentType,
            assignment,
            dayStatus: day.status,
          });
          if (day.orderHeadcount != null) {
            row.orderByDate.set(
              day.date,
              Math.max(row.orderByDate.get(day.date) ?? 0, day.orderHeadcount),
            );
          }
        }
      }
    }
    // 未割当配置を各サイト行に統合
    for (const assignment of unassignedAssignments) {
      const site = assignment.jobSite;
      if (!siteMap.has(site.id)) {
        siteMap.set(site.id, {
          id: site.id,
          name: site.name,
          siteCode: site.siteCode,
          branchOffice: site.branchOffice,
          staffByDate: new Map(),
          hasUnassigned: false,
          unassignedIds: new Set(),
          orderByDate: new Map(),
        });
      }
      const row = siteMap.get(site.id)!;
      row.unassignedIds.add(assignment.id);
      for (const day of assignment.assignmentDays) {
        if (day.status !== "scheduled" && day.status !== "pre_declined") continue;
        if (!row.staffByDate.has(day.date)) row.staffByDate.set(day.date, []);
        row.staffByDate.get(day.date)!.push({
          staffId: null,
          staffName: "未割当",
          branchColor: "#9CA3AF",
          assignmentType: assignment.assignmentType,
          assignment,
          dayStatus: day.status,
        });
        row.hasUnassigned = true;
        if (day.orderHeadcount != null) {
          row.orderByDate.set(
            day.date,
            Math.max(row.orderByDate.get(day.date) ?? 0, day.orderHeadcount),
          );
        }
      }
    }
    // 並び順:
    //   1. 未割当を含む現場を最上部に固定（議事録: 「上に未割り当て案件を表示」）
    //   2. 同条件内では 得意先(親) → 現場(子) の階層順、最後に名前順
    return Array.from(siteMap.values()).sort((a, b) => {
      if (a.hasUnassigned !== b.hasUnassigned) return a.hasUnassigned ? -1 : 1;
      const ac = a.clientCode || "";
      const bc = b.clientCode || "";
      if (ac !== bc) return ac.localeCompare(bc);
      const an = a.clientName || "";
      const bn = b.clientName || "";
      if (an !== bn) return an.localeCompare(bn);
      return a.name.localeCompare(b.name);
    });
  }, [staffRows, allSites, unassignedAssignments]);

  // Filter site rows（参照を安定化、毎レンダーの再計算を抑止）
  const filteredSiteRows = useMemo(() => {
    let rows = siteRows;
    if (workCategoryFilter) {
      rows = rows.filter((s) => s.workCategory === workCategoryFilter);
    }
    if (staffFilterMode === "search" && staffFilter.trim()) {
      const q = staffFilter.trim().toLowerCase();
      rows = rows.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.siteCode.toLowerCase().includes(q) ||
        (s.clientName ?? "").toLowerCase().includes(q) ||
        (s.clientCode ?? "").toLowerCase().includes(q)
      );
    }
    if (staffFilterMode === "select" && selectedStaffIds.size > 0) {
      rows = rows.filter((s) => selectedStaffIds.has(s.id));
    }
    return rows;
  }, [siteRows, workCategoryFilter, staffFilterMode, staffFilter, selectedStaffIds]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] md:h-screen relative">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 px-2 py-2 md:p-3 border-b bg-card shrink-0">
        {/* Row 1: Navigation + Week toggle + View mode */}
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          <Button
            variant="outline"
            onClick={goToday}
            className="h-10 px-4 text-sm font-semibold"
            title="今日の週に戻る"
          >
            今日
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={goPrev}
            aria-label="前の期間へ"
            title="前の期間へ"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={goNext}
            aria-label="次の期間へ"
            title="次の期間へ"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Popover
            open={rangePopoverOpen}
            onOpenChange={(open) => {
              setRangePopoverOpen(open);
              if (open) {
                setRangeDraftFrom(customRange?.from ?? startDate);
                setRangeDraftTo(customRange?.to ?? endDate);
              }
            }}
          >
            <PopoverTrigger
              className={cn(
                "font-semibold text-xs sm:text-sm md:text-base ml-1 tabular-nums px-2 py-1 rounded-md transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer",
                customRange && "text-primary",
              )}
              title="期間をクリックして任意の範囲を指定"
              aria-label="表示する期間を設定"
            >
              {formatDateRange(allDates[0], allDates[allDates.length - 1])}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 space-y-3" align="start">
              <p className="text-sm font-semibold">表示する期間を選んでください</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={rangeDraftFrom}
                  onChange={(e) => setRangeDraftFrom(e.target.value)}
                  className="h-10 border rounded-md px-2.5 text-sm w-[150px]"
                  aria-label="開始日"
                />
                <span className="text-sm text-muted-foreground">〜</span>
                <input
                  type="date"
                  value={rangeDraftTo}
                  onChange={(e) => setRangeDraftTo(e.target.value)}
                  className="h-10 border rounded-md px-2.5 text-sm w-[150px]"
                  aria-label="終了日"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyCustomRange}
                  disabled={!rangeDraftFrom || !rangeDraftTo || rangeDraftFrom > rangeDraftTo}
                  className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  この範囲で表示
                </button>
                {customRange && (
                  <button
                    onClick={() => {
                      setCustomRange(null);
                      setRangePopoverOpen(false);
                    }}
                    className="h-10 px-3 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
                    title="週単位の表示に戻す"
                  >
                    週表示に戻す
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                最長 62 日まで指定できます
              </p>
            </PopoverContent>
          </Popover>
        </div>

        {/* Week toggle */}
        <div
          className="flex border rounded-lg overflow-hidden h-10"
          role="group"
          aria-label="表示する期間"
        >
          {[1, 2, 4].map((w) => (
            <button
              key={w}
              onClick={() => {
                setCustomRange(null);
                setWeeksToShow(w);
              }}
              aria-pressed={!customRange && weeksToShow === w}
              className={cn(
                "px-3 md:px-4 text-sm font-medium transition-colors",
                w > 1 && "border-l",
                !customRange && weeksToShow === w
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {w}週
            </button>
          ))}
        </div>

        {/* View mode toggle: site vs staff */}
        <div
          className="flex border rounded-lg overflow-hidden h-10"
          role="group"
          aria-label="表示モード"
        >
          <button
            onClick={() => switchViewMode("site")}
            aria-pressed={viewMode === "site"}
            className={cn(
              "px-3 md:px-4 text-sm font-medium transition-colors flex items-center gap-1.5",
              viewMode === "site"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">現場</span>
          </button>
          <button
            onClick={() => switchViewMode("staff")}
            aria-pressed={viewMode === "staff"}
            className={cn(
              "px-3 md:px-4 text-sm font-medium transition-colors border-l flex items-center gap-1.5",
              viewMode === "staff"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">スタッフ</span>
          </button>
        </div>

        {/* Bulk mode toggle */}
        <button
          onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
          aria-pressed={bulkMode}
          className={cn(
            "h-10 px-3 md:px-4 rounded-lg text-sm font-medium transition-colors border",
            bulkMode
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted",
          )}
        >
          一括配置
        </button>

        {/* 作業区分フィルタ（現場ビューのみ） */}
        {viewMode === "site" && (
          <select
            value={workCategoryFilter}
            onChange={(e) => setWorkCategoryFilter(e.target.value)}
            className="h-10 px-3 rounded-lg text-sm border border-border bg-background hover:bg-muted"
            aria-label="作業区分で絞り込み"
            title="作業区分で絞り込み"
          >
            <option value="">作業区分: すべて</option>
            <option value="chikuro">築炉工事</option>
            <option value="regular">レギュラー</option>
            <option value="spot">スポット</option>
          </select>
        )}

        {/* Print button with date range popover */}
        <Popover open={printPopoverOpen} onOpenChange={(open) => {
          setPrintPopoverOpen(open);
          if (open) {
            setPrintStart(startDate);
            setPrintEnd(endDate);
          }
        }}>
          <PopoverTrigger
            className="h-10 px-3 md:px-4 rounded-lg text-sm font-medium transition-colors border border-border hover:bg-muted flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            印刷
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="start">
            <p className="text-sm font-semibold">印刷範囲を選んでください</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={printStart}
                onChange={(e) => setPrintStart(e.target.value)}
                className="h-10 border rounded-md px-2.5 text-sm w-[150px]"
                aria-label="開始日"
              />
              <span className="text-sm text-muted-foreground">〜</span>
              <input
                type="date"
                value={printEnd}
                onChange={(e) => setPrintEnd(e.target.value)}
                className="h-10 border rounded-md px-2.5 text-sm w-[150px]"
                aria-label="終了日"
              />
            </div>
            <button
              onClick={() => {
                setPrintPopoverOpen(false);
                setShowPrint(true);
              }}
              disabled={!printStart || !printEnd || printStart > printEnd}
              className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              プレビュー・印刷
            </button>
          </PopoverContent>
        </Popover>

        {/* Staff filter: search / select toggle */}
        <div className="flex items-center gap-2">
          <div
            className="flex border rounded-lg overflow-hidden h-10 text-sm"
            role="group"
            aria-label="スタッフ絞り込み方法"
          >
            <button
              onClick={() => { setStaffFilterMode("search"); setSelectedStaffIds(new Set()); setStaffPickerOpen(false); }}
              aria-pressed={staffFilterMode === "search"}
              aria-label="名前で検索"
              title="名前で検索"
              className={cn(
                "px-3 transition-colors flex items-center",
                staffFilterMode === "search"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setStaffFilterMode("select"); setStaffFilter(""); }}
              aria-pressed={staffFilterMode === "select"}
              className={cn(
                "px-3 transition-colors border-l font-medium",
                staffFilterMode === "select"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              選択
            </button>
          </div>

          {staffFilterMode === "search" ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                placeholder={viewMode === "staff" ? "名前・コードで検索" : "現場名・コードで検索"}
                className="h-10 w-32 sm:w-48 rounded-lg border border-input bg-transparent pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                aria-label={viewMode === "staff" ? "スタッフを名前・コードで検索" : "現場を名前・コードで検索"}
              />
              {staffFilter && (
                <button
                  onClick={() => setStaffFilter("")}
                  aria-label="検索キーワードをクリア"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setStaffPickerOpen((p) => !p)}
                className={cn(
                  "h-10 px-3 md:px-4 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors",
                  selectedStaffIds.size > 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-input hover:bg-muted"
                )}
              >
                {selectedStaffIds.size > 0
                  ? `${selectedStaffIds.size}件選択中`
                  : viewMode === "staff" ? "スタッフを選択" : "現場を選択"}
                <ChevronRight className={cn("h-3 w-3 transition-transform", staffPickerOpen && "rotate-90")} />
              </button>

              {staffPickerOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setStaffPickerOpen(false)} />
                  <div className="absolute top-full right-0 sm:right-auto sm:left-0 mt-1 z-40 w-64 bg-card border rounded-lg shadow-xl overflow-hidden">
                    {/* Search within picker */}
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={staffPickerSearch}
                          onChange={(e) => setStaffPickerSearch(e.target.value)}
                          placeholder="絞り込み..."
                          className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                          autoFocus
                        />
                      </div>
                    </div>
                    {/* Item list — staff or sites */}
                    <div className="max-h-64 overflow-auto py-1">
                      {viewMode === "staff"
                        ? staffRows
                            .filter((s) => {
                              if (!staffPickerSearch.trim()) return true;
                              const q = staffPickerSearch.trim().toLowerCase();
                              return s.name.toLowerCase().includes(q) || (s.displayName && s.displayName.toLowerCase().includes(q)) || s.employeeCode.toLowerCase().includes(q);
                            })
                            .map((s) => {
                              const checked = selectedStaffIds.has(s.id);
                              return (
                                <button key={s.id} onClick={() => toggleSelectedStaff(s.id)} className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors", checked && "bg-primary/5")}>
                                  <div className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0", checked ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                                    {checked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.branchOffice.color }} />
                                  <span className="truncate">{s.displayName || s.name}</span>
                                  <span className="text-muted-foreground ml-auto shrink-0">{s.employeeCode}</span>
                                </button>
                              );
                            })
                        : siteRows
                            .filter((s) => {
                              if (!staffPickerSearch.trim()) return true;
                              const q = staffPickerSearch.trim().toLowerCase();
                              return s.name.toLowerCase().includes(q) || s.siteCode.toLowerCase().includes(q);
                            })
                            .map((s) => {
                              const checked = selectedStaffIds.has(s.id);
                              return (
                                <button key={s.id} onClick={() => toggleSelectedStaff(s.id)} className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors", checked && "bg-primary/5")}>
                                  <div className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0", checked ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                                    {checked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.branchOffice.color }} />
                                  <span className="truncate">{s.name}</span>
                                  <span className="text-muted-foreground ml-auto shrink-0">{s.siteCode}</span>
                                </button>
                              );
                            })
                      }
                    </div>
                    {/* Footer */}
                    {selectedStaffIds.size > 0 && (
                      <div className="p-2 border-t flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{selectedStaffIds.size}件選択中</span>
                        <button
                          onClick={() => setSelectedStaffIds(new Set())}
                          className="text-[11px] text-primary hover:underline"
                        >
                          全解除
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Clear all filter */}
          {(staffFilter || selectedStaffIds.size > 0) && (
            <button
              onClick={clearStaffFilter}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              リセット
            </button>
          )}
        </div>

        {/* Branch filters */}
        <div className="flex gap-1 md:gap-1.5 flex-wrap ml-auto">
          {branchOffices.map((bo) => {
            const active =
              selectedBranches.length === 0 || selectedBranches.includes(bo.id);
            return (
              <button
                key={bo.id}
                onClick={() => toggleBranch(bo.id)}
                className={cn(
                  "px-2 md:px-3 py-1 rounded-full text-[11px] md:text-xs font-medium transition-all border",
                  active
                    ? "text-white border-transparent shadow-sm"
                    : "text-muted-foreground border-border hover:border-foreground/30"
                )}
                style={
                  active ? { backgroundColor: bo.color, borderColor: bo.color } : {}
                }
              >
                {bo.name}
              </button>
            );
          })}
        </div>

        {/* Refreshing indicator */}
        {refreshing && (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* 未割当は staff ビューでは日付ヘッダーの Popover で扱う。
          site ビューだけ「未割当あり現場」のサマリを上部に固定表示する。 */}
      {viewMode === "site" && (() => {
        const rowsWithUnassigned = siteRows.filter((r) => r.unassignedIds.size > 0);
        if (rowsWithUnassigned.length === 0) return null;
        const totalSlots = rowsWithUnassigned.reduce((sum, r) => sum + r.unassignedIds.size, 0);
        return (
          <div className="border-b bg-rose-50/70 px-2 md:px-3 py-2">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-700 shrink-0" />
              <span className="text-xs font-bold text-rose-800">
                未割当あり {rowsWithUnassigned.length}現場 / 合計 {totalSlots}名
              </span>
              <span className="text-[10px] text-rose-700">
                スタッフを当ててください
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rowsWithUnassigned.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    // 該当現場行へスクロール
                    const el = gridRef.current?.querySelector<HTMLElement>(`[data-site-row-id="${r.id}"]`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] hover:bg-rose-100"
                  style={{
                    borderLeftWidth: "3px",
                    borderLeftColor: r.branchOffice.color,
                  }}
                  title={`${r.name} — 未割当 ${r.unassignedIds.size}名`}
                >
                  <span className="font-medium text-rose-900 truncate max-w-[140px]">{r.name}</span>
                  <span className="font-bold tabular-nums text-rose-700">{r.unassignedIds.size}名</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ===== TABLE VIEWS (staff / site) ===== */}
      <div
        ref={gridRef}
        className={cn(
          "flex-1 overflow-auto transition-opacity duration-200",
          refreshing && "opacity-60",
          isDragging && "cursor-crosshair",
          isMoveDragging && "cursor-grabbing"
        )}
      >
        <div className={isCompact ? "min-w-[900px]" : "min-w-[800px]"}>
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              <col className={isCompact ? "w-[120px]" : "w-[150px]"} />
              {allDates.map((d) => (
                <col key={formatDateISO(d)} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="border-b border-r p-2 text-left text-xs font-medium text-muted-foreground bg-card sticky left-0 z-20">
                  {viewMode === "staff" ? "スタッフ" : "現場"}
                </th>
                {dateMeta.map(({ date, dateStr, sunday, weekend, holiday, isRedDay }, dateIndex) => {
                  const hc = getHeadcount(dateStr);
                  const isToday = dateStr === today;
                  const intensity = hc > 0 ? Math.min(hc / maxHeadcount, 1) : 0;
                  const isWeekBoundary = isCompact && dateIndex > 0 && dateIndex % 7 === 0;
                  const dayUnassigned = unassignedByDate.get(dateStr) ?? [];
                  const hasPopover = hc > 0 || dayUnassigned.length > 0;
                  return (
                    <th
                      key={dateStr}
                      className={cn(
                        "border-b border-r text-center bg-card relative",
                        isCompact ? "p-0.5" : "p-1.5",
                        isRedDay && "bg-red-50",
                        weekend && !isRedDay && "bg-blue-50",
                        isToday && "!bg-primary/5",
                        isWeekBoundary && "border-l-2 border-l-primary/20"
                      )}
                    >
                      {isToday && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
                      )}
                      <div
                        className={cn(
                          "font-medium",
                          isCompact ? "text-[10px]" : "text-xs",
                          isToday && "text-primary font-bold",
                          isRedDay && "text-red-500"
                        )}
                      >
                        {formatDateJP(date)}
                      </div>
                      {!isCompact && holiday && (
                        <div className="text-[9px] text-red-400 leading-tight truncate">
                          {holiday}
                        </div>
                      )}
                      {hasPopover && (
                        <Popover>
                          <PopoverTrigger
                            className={cn(
                              "flex items-center justify-center gap-1 cursor-pointer hover:opacity-80 transition-opacity w-full",
                              isCompact ? "mt-0.5" : "mt-1"
                            )}
                          >
                            {!isCompact && hc > 0 && (
                              <div
                                className="h-1 rounded-full bg-primary/60 transition-all"
                                style={{ width: `${Math.max(intensity * 100, 10)}%` }}
                              />
                            )}
                            {hc > 0 && (
                              <span className={cn(
                                "font-bold tabular-nums text-primary",
                                isCompact ? "text-[9px]" : "text-xs"
                              )}>
                                {hc}名
                              </span>
                            )}
                            {dayUnassigned.length > 0 && (
                              <span
                                className={cn(
                                  "rounded px-1 font-bold tabular-nums bg-amber-100 text-amber-800",
                                  isCompact ? "text-[9px]" : "text-[10px]",
                                )}
                                title={`未割当 ${dayUnassigned.length}件`}
                              >
                                未{dayUnassigned.length}
                              </span>
                            )}
                          </PopoverTrigger>
                          <PopoverContent side="bottom" className="w-64 p-0">
                            <div className="px-3 py-2 border-b bg-muted/30">
                              <div className="font-medium text-xs">
                                {formatDateJP(date)} の配置内訳
                              </div>
                            </div>
                            {hc > 0 && (
                              <div className="p-2 space-y-1">
                                {getSiteBreakdown(dateStr).map((site) => (
                                  <div key={site.jobSiteId} className="flex items-center justify-between text-xs px-1 py-0.5">
                                    <span className="truncate mr-2">{site.siteName}</span>
                                    <span className="font-bold tabular-nums text-primary shrink-0">{site.count}名</span>
                                  </div>
                                ))}
                                <div className="border-t pt-1 mt-1 flex items-center justify-between text-xs px-1 font-medium">
                                  <span>合計</span>
                                  <span className="tabular-nums text-primary">{hc}名</span>
                                </div>
                              </div>
                            )}
                            {dayUnassigned.length > 0 && (
                              <div className="p-2 border-t bg-amber-50/40">
                                <div className="flex items-center gap-1 mb-1.5">
                                  <AlertTriangle className="h-3 w-3 text-amber-700" />
                                  <span className="text-[11px] font-semibold text-amber-800">
                                    未割当 {dayUnassigned.length}件
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {dayUnassigned.map((a) => {
                                    const dayOrder =
                                      a.assignmentDays.find((d) => d.date === dateStr)?.orderHeadcount ?? null;
                                    return (
                                      <div
                                        key={a.id}
                                        role="button"
                                        tabIndex={0}
                                        draggable
                                        onDragStart={(e) => {
                                          handleUnassignedDragStart(a.id);
                                          e.dataTransfer.setData("text/plain", String(a.id));
                                          e.dataTransfer.effectAllowed = "move";
                                        }}
                                        onDragEnd={handleUnassignedDragEnd}
                                        onClick={() => handleUnassignedCardClick(a)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            handleUnassignedCardClick(a);
                                          }
                                        }}
                                        className="w-full text-left rounded border bg-white px-2 py-1 hover:bg-amber-100/60 cursor-grab active:cursor-grabbing"
                                        style={{
                                          borderLeftWidth: "3px",
                                          borderLeftColor: a.jobSite.branchOffice.color,
                                        }}
                                      >
                                        <div className="text-[11px] font-medium text-amber-900 leading-tight truncate">
                                          {a.jobSite.name}
                                        </div>
                                        <div className="text-[9px] text-amber-700 leading-tight tabular-nums">
                                          {a.startTime}〜{a.endTime}
                                          {a.shiftType === "night" && <span className="ml-1">🌙</span>}
                                          {dayOrder != null && (
                                            <span className="ml-1">· 発注{dayOrder}名</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-amber-700 mt-1.5">
                                  クリックで編集 / スタッフ行へドラッグで配置
                                </p>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={allDates.length + 1}
                    className="text-center p-12"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        読み込み中...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : viewMode === "site" ? (
                /* ========== SITE VIEW ========== */
                filteredSiteRows.length === 0 ? (
                  <tr>
                    <td colSpan={allDates.length + 1} className="text-center p-12 text-muted-foreground">
                      {staffFilter ? `「${staffFilter}」に一致する現場が見つかりません` : "現場が見つかりません"}
                    </td>
                  </tr>
                ) : (
                  filteredSiteRows.map((siteRow) => {
                    // 期間内の代表日（最初の日）の配置済み人数で必要人数バッジを表示
                    const firstDateStr = formatDateISO(allDates[0]);
                    const dayStaffFirst = siteRow.staffByDate.get(firstDateStr) ?? [];
                    const scheduledFirst = dayStaffFirst.length;
                    const requiredHeadcount = siteRow.requiredHeadcount ?? null;
                    // 先頭日のオーダー人数（日毎に変わる）
                    const orderHeadcount = siteRow.orderByDate.get(firstDateStr) ?? null;
                    return (
                    <tr key={siteRow.id} data-site-row-id={siteRow.id} className="group/row">
                      {/* Site name - sticky left */}
                      <td className={cn(
                        "border-b border-r bg-card sticky left-0 z-[5] transition-colors",
                        isCompact ? "p-1 text-xs" : "p-1.5 text-sm",
                        "group-hover/row:bg-accent/30",
                        siteRow.hasUnassigned && "bg-amber-50/40",
                      )}>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn("rounded-full flex-shrink-0 ring-1 ring-white", isCompact ? "w-2 h-2" : "w-2.5 h-2.5")}
                            style={{ backgroundColor: siteRow.branchOffice.color }}
                          />
                          <div className="min-w-0">
                            <div className={cn("font-medium truncate leading-tight", isCompact ? "text-[11px]" : "text-[13px]")}>
                              {siteRow.name}
                              {requiredHeadcount != null && (
                                <span
                                  className={cn(
                                    "ml-1 text-[10px] px-1 rounded font-mono",
                                    scheduledFirst >= requiredHeadcount
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800",
                                  )}
                                  title={`必要 ${requiredHeadcount}名 / 配置 ${scheduledFirst}名（先頭日）`}
                                >
                                  {scheduledFirst}/{requiredHeadcount}
                                </span>
                              )}
                              {orderHeadcount != null && (
                                <span
                                  className={cn(
                                    "ml-1 text-[10px] px-1 rounded font-mono",
                                    scheduledFirst === orderHeadcount
                                      ? "bg-emerald-100 text-emerald-800"
                                      : scheduledFirst > orderHeadcount
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-amber-100 text-amber-800",
                                  )}
                                  title={
                                    scheduledFirst === orderHeadcount
                                      ? `発注 ${orderHeadcount}名 / 配置 ${scheduledFirst}名（一致・先頭日）`
                                      : scheduledFirst > orderHeadcount
                                        ? `⚠ 過剰: 発注 ${orderHeadcount}名 に対し ${scheduledFirst}名 配置済み（先頭日）`
                                        : `不足: 発注 ${orderHeadcount}名 に対し ${scheduledFirst}名 配置（先頭日）`
                                  }
                                >
                                  発{scheduledFirst}/{orderHeadcount}
                                  {scheduledFirst > orderHeadcount && <span className="ml-0.5">⚠</span>}
                                </span>
                              )}
                              {siteRow.unassignedIds.size > 0 && (
                                <span
                                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold tabular-nums"
                                  title={`未割当 ${siteRow.unassignedIds.size}名（クリックで該当現場へドラッグ&ドロップ可）`}
                                >
                                  未割 {siteRow.unassignedIds.size}名
                                </span>
                              )}
                            </div>
                            {!isCompact && (
                              <div className="text-[10px] text-muted-foreground leading-tight">
                                {siteRow.clientName ? `${siteRow.clientName} / ` : ""}{siteRow.siteCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date cells */}
                      {dateMeta.map(({ dateStr, sunday, weekend, isRedDay }, dateIdx) => {
                        const isToday = dateStr === today;
                        const isCellWeekBoundary = isCompact && dateIdx > 0 && dateIdx % 7 === 0;
                        const dayStaff = siteRow.staffByDate.get(dateStr) || [];

                        return (
                          <td
                            key={dateStr}
                            className={cn(
                              "border-b border-r p-0 align-top relative select-none cursor-pointer",
                              isRedDay && "bg-red-50/40",
                              weekend && !isRedDay && "bg-blue-50/40",
                              isToday && "!bg-primary/[0.03]",
                              "group-hover/row:bg-accent/10 transition-colors",
                              isCellWeekBoundary && "border-l-2 border-l-primary/20",
                              isSiteCellInDragRange(siteRow.id, dateStr) && "!bg-primary/15 ring-1 ring-primary/40",
                              isSiteDragging && "cursor-crosshair",
                            )}
                            onMouseDown={(e) => handleSiteCellMouseDown(siteRow.id, dateStr, e)}
                            onMouseEnter={() => handleSiteCellMouseEnter(siteRow.id, dateStr)}
                            onClick={() => {
                              if (isSiteDragging) return;
                              setSelectedStaffId(null);
                              setSelectedSiteId(siteRow.id);
                              setSelectedDate(dateStr);
                              setDragEndDate(dateStr);
                              setSelectedAssignment(null);
                              setPanelOpen(true);
                            }}
                          >
                            <div className={cn("space-y-0.5 py-0.5", isCompact ? "min-h-[24px]" : "min-h-[44px]")}>
                              {dayStaff.map((entry) => {
                                const isUnassigned = entry.staffId == null;
                                const isPreDeclined = entry.dayStatus === "pre_declined";
                                return (
                                  <div
                                    key={entry.assignment.id}
                                    className={cn(
                                      "mx-0.5 rounded cursor-pointer hover:brightness-95 transition-all",
                                      isCompact ? "px-1 py-0.5" : "px-1.5 py-1",
                                      isUnassigned && "border border-dashed border-amber-500 bg-amber-50",
                                      isPreDeclined && "opacity-60 line-through bg-rose-50 border border-rose-300 [&_*]:text-rose-700",
                                    )}
                                    style={
                                      isUnassigned || isPreDeclined
                                        ? undefined
                                        : { backgroundColor: entry.branchColor + "20" }
                                    }
                                    title={isPreDeclined ? "事前断り" : undefined}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAssignmentClick(entry.assignment, entry.staffId);
                                    }}
                                    onContextMenu={(e) =>
                                      handleContextMenu(e, entry.assignment, entry.staffId, dateStr)
                                    }
                                  >
                                    {isCompact ? (
                                      <div className={cn("text-[9px] leading-tight font-medium truncate", isUnassigned && "text-amber-700")}>
                                        {isPreDeclined && "🚫 "}{entry.staffName}
                                      </div>
                                    ) : (
                                      <>
                                        <div className={cn("text-[11px] leading-tight font-medium truncate flex items-center gap-1", isUnassigned && "text-amber-700")}>
                                          {isPreDeclined && <span className="text-[9px]">🚫</span>}
                                          {entry.staffName}
                                          {entry.assignmentType === "business_trip" && (
                                            <span className="text-[8px] px-0.5 rounded-sm shrink-0" style={{ backgroundColor: (isUnassigned ? "#F59E0B" : entry.branchColor) + "30" }}>
                                              出張
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground/70 leading-tight">
                                          {entry.assignment.startTime}〜{entry.assignment.endTime}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })
                )
              ) : (
                /* ========== STAFF VIEW (default) ========== */
                filteredStaffRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={allDates.length + 1}
                    className="text-center p-12 text-muted-foreground"
                  >
                    {staffFilter ? `「${staffFilter}」に一致するスタッフが見つかりません` : "スタッフが見つかりません"}
                  </td>
                </tr>
              ) : (
                (() => {
                  // ループの外で 1 回だけ計算（毎セル .find() を呼ばないため）
                  const draggingUnassigned =
                    draggingUnassignedId !== null
                      ? unassignedAssignments.find((u) => u.id === draggingUnassignedId) ?? null
                      : null;
                  const dragStart = draggingUnassigned?.startDate ?? null;
                  const dragEnd = draggingUnassigned?.endDate ?? null;
                  return filteredStaffRows.map((staff) => {
                  const isMoveTarget = isMoveDragging && moveDrag!.currentStaffId === staff.id && moveDrag!.fromStaffId !== staff.id;
                  return (
                  <tr
                    key={staff.id}
                    className={cn("group/row", isMoveTarget && "ring-2 ring-inset ring-primary/40")}
                  >
                    {/* Staff name - sticky left */}
                    <td
                      className={cn(
                        "border-b border-r bg-card sticky left-0 z-[5] transition-colors",
                        isCompact ? "p-1 text-xs" : "p-1.5 text-sm",
                        !isMoveDragging && "group-hover/row:bg-accent/30",
                        isMoveTarget && "!bg-primary/10",
                        bulkMode && "cursor-pointer",
                        bulkMode && bulkSelectedIds.has(staff.id) && "!bg-primary/10"
                      )}
                      onClick={bulkMode ? () => toggleBulkStaff(staff.id) : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        {bulkMode && (
                          <div className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            bulkSelectedIds.has(staff.id)
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          )}>
                            {bulkSelectedIds.has(staff.id) && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                        <div
                          className={cn("rounded-full flex-shrink-0 ring-1 ring-white", isCompact ? "w-2 h-2" : "w-2.5 h-2.5")}
                          style={{ backgroundColor: staff.branchOffice.color }}
                        />
                        <div className="min-w-0">
                          <div className={cn("font-medium truncate leading-tight", isCompact ? "text-[11px]" : "text-[13px]")}>
                            {staff.displayName || staff.name}
                          </div>
                          {!isCompact && (
                            <div className="text-[10px] text-muted-foreground leading-tight">
                              {staff.employeeCode}
                              <span className="ml-1 px-1 py-px rounded bg-muted text-[9px]">
                                {staff.insuranceType === "company" ? "社保" : "国保"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {dateMeta.map(({ dateStr, sunday, weekend, isRedDay }, dateIdx) => {
                      const isToday = dateStr === today;
                      const cellKey = `${staff.id}-${dateStr}`;
                      const inDrag = isCellInDragRange(staff.id, dateStr);
                      const dayAssignments = getAssignmentsForDate(staff.id, dateStr);
                      const isDoubleBooked = dayAssignments.length >= 2;
                      const isCellWeekBoundary = isCompact && dateIdx > 0 && dateIdx % 7 === 0;

                      const isUnassignedDropTarget =
                        draggingUnassignedId !== null && dropTargetCellKey === cellKey;
                      // 期間チェックのみ（draggingUnassigned 自体はループ外で 1 回計算済み）
                      const dropEligible = !!(
                        dragStart && dragEnd && dateStr >= dragStart && dateStr <= dragEnd
                      );
                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            // group/cell: 「+」ボタンを CSS hover で開閉する（state不要）
                            "group/cell border-b border-r p-0 align-top relative select-none",
                            isRedDay && "bg-red-50/40",
                            weekend && !isRedDay && "bg-blue-50/40",
                            isToday && "!bg-primary/[0.03]",
                            !isDragging && "group-hover/row:bg-accent/10",
                            inDrag && "!bg-primary/10 ring-1 ring-inset ring-primary/30",
                            isCellWeekBoundary && "border-l-2 border-l-primary/20",
                            isUnassignedDropTarget && dropEligible && "!bg-emerald-100 ring-2 ring-inset ring-emerald-500",
                            draggingUnassignedId !== null && !dropEligible && "opacity-60",
                          )}
                          onMouseEnter={() => {
                            // hoveredCell state は廃止。ドラッグ系の handler のみ呼ぶ
                            handleCellMouseEnter(staff.id, dateStr);
                            handleCellMouseEnterForMove(staff.id, dateStr);
                          }}
                          onMouseDown={(e) => handleCellMouseDown(staff.id, dateStr, e)}
                          onClick={() => {
                            if (!isDragging) handleCellClick(staff.id, dateStr);
                          }}
                          onDragOver={(e) => {
                            if (draggingUnassignedId !== null && dropEligible) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (dropTargetCellKey !== cellKey) setDropTargetCellKey(cellKey);
                            }
                          }}
                          onDragLeave={() => {
                            if (dropTargetCellKey === cellKey) setDropTargetCellKey(null);
                          }}
                          onDrop={(e) => {
                            if (draggingUnassignedId !== null && dropEligible) {
                              e.preventDefault();
                              const id = draggingUnassignedId;
                              assignUnassignedToStaff(id, staff.id);
                            }
                          }}
                        >
                          {isToday && (
                            <div className="absolute top-0 bottom-0 left-0 w-px bg-primary/20" />
                          )}
                          <div className={cn("space-y-0.5 py-0.5 relative", isCompact ? "min-h-[24px]" : "min-h-[44px]")}>
                            {isDoubleBooked && (
                              <div className="absolute top-0.5 right-0.5 z-[2]" title="二重配置">
                                <AlertTriangle className="h-3 w-3 text-red-500 fill-red-100" />
                              </div>
                            )}
                            {dayAssignments.map((a) => {
                              const pos = getSpanPosition(a, dateStr);
                              const color = a.jobSite.branchOffice.color;
                              const isStart = pos === "start" || pos === "single";
                              const isEnd = pos === "end" || pos === "single";
                              const isMiddle = pos === "middle";
                              const isPreDeclined = isPreDeclinedOn(a, dateStr);

                              const isBeingMoved = isMoveDragging && moveDrag!.assignment.id === a.id;

                              return (
                                <div
                                  key={a.id}
                                  className={cn(
                                    "relative cursor-grab transition-all text-[11px] leading-tight",
                                    "hover:brightness-95 active:cursor-grabbing",
                                    isStart && isEnd && "rounded-md mx-0.5",
                                    isStart && !isEnd && "rounded-l-md ml-0.5 -mr-px",
                                    isEnd && !isStart && "rounded-r-md mr-0.5 -ml-px",
                                    isMiddle && "-mx-px",
                                    isBeingMoved && "opacity-40 ring-2 ring-primary/50 ring-dashed",
                                    isPreDeclined && "opacity-60 line-through border border-rose-300 [&_*]:text-rose-700",
                                  )}
                                  style={{
                                    backgroundColor: isPreDeclined ? "#FFE4E6" : color + "20",
                                  }}
                                  title={isPreDeclined ? "事前断り" : undefined}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleCardDragStart(a, staff.id, dateStr, e);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isMoveDragging) handleAssignmentClick(a, staff.id);
                                  }}
                                  onContextMenu={(e) =>
                                    handleContextMenu(e, a, staff.id, dateStr)
                                  }
                                >
                                  {isCompact ? (
                                    <div className={cn("px-1 py-0.5", !isStart && "h-[18px]")}>
                                      {isStart && (
                                        <div className="font-medium truncate text-[9px] leading-tight">
                                          {a.jobSite.name}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      {isStart && (
                                        <div className="px-1.5 py-1">
                                          <div className="font-medium truncate flex items-center gap-1">
                                            <span className="truncate">
                                              {a.jobSite.name}
                                            </span>
                                            {a.assignmentType === "business_trip" && (
                                              <span
                                                className="flex-shrink-0 text-[8px] px-1 py-px rounded-sm font-normal"
                                                style={{ backgroundColor: color + "30" }}
                                              >
                                                出張
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-muted-foreground/70 text-[10px]">
                                            {a.startTime}-{a.endTime}
                                          </div>
                                        </div>
                                      )}
                                      {isMiddle && (
                                        <div className="h-[34px]" />
                                      )}
                                      {isEnd && !isStart && (
                                        <div className="h-[34px]" />
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add button - CSS hover で展開（再レンダー不要） */}
                            {!sunday && !isCompact && (
                              <div
                                className={cn(
                                  "overflow-hidden",
                                  inDrag ? "h-8 py-1" : "h-0 py-0 group-hover/cell:h-8 group-hover/cell:py-1",
                                )}
                              >
                                {!isDragging && (
                                  <div className="flex items-center justify-center">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center cursor-pointer">
                                      <Plus className="h-3.5 w-3.5 text-primary/70" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                });
                })()
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-card border rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
            onClick={() => {
              handleAssignmentClick(contextMenu.assignment, contextMenu.staffId);
              setContextMenu(null);
            }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            詳細を編集
          </button>
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
            onClick={() => {
              if (viewMode === "site") {
                // In site view, pre-fill site and let user pick staff
                setSelectedStaffId(null);
                setSelectedSiteId(contextMenu.assignment.jobSite.id);
              } else {
                // In staff view, pre-fill staff and let user pick site
                setSelectedStaffId(contextMenu.staffId);
                setSelectedSiteId(null);
              }
              setSelectedDate(contextMenu.date);
              setSelectedAssignment(null);
              setPanelOpen(true);
              setContextMenu(null);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            この日に追加
          </button>
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
            onClick={() => {
              const params = new URLSearchParams({
                jobSiteId: String(contextMenu.assignment.jobSite.id),
                date: contextMenu.date,
              });
              router.push(`/forms/new?${params}`);
              setContextMenu(null);
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            出来高確認書を作成
          </button>
          <div className="border-t my-1" />
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2 transition-colors"
            onClick={() =>
              handleDeleteAssignment(contextMenu.assignment.id)
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
            削除
          </button>
        </div>
      )}

      {/* Panel Overlay (window-modal) */}
      {panelOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-150"
          onClick={() => {
            setPanelOpen(false);
            setSelectedAssignment(null);
          }}
        />
      )}

      {/* Assignment Window Modal — 議事録: 「ウィンドウモーダル化」「PDF開いたみたいな感じでポッと出てくる」 */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-12 px-2 sm:px-4 pointer-events-none"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="pointer-events-auto w-full sm:w-[min(96vw,1080px)] max-w-full max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-4rem)] animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <AssignmentPanel
              staffId={selectedStaffId}
              preselectedSiteId={selectedSiteId}
              date={selectedDate}
              endDate={dragEndDate || selectedDate}
              assignment={selectedAssignment}
              cachedSites={allSites}
              cachedVehicles={allVehicles}
              onClose={() => {
                setPanelOpen(false);
                setSelectedAssignment(null);
              }}
              onSaved={() => {
                setPanelOpen(false);
                setSelectedAssignment(null);
                fetchData(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Floating ghost while dragging a card */}
      {moveDrag && (
        <div
          className="fixed z-[80] pointer-events-none"
          style={{
            left: moveDrag.mouseX,
            top: moveDrag.mouseY,
            transform: "translate(-50%, -60%)",
          }}
        >
          <div
            className="rounded-lg px-3 py-2 text-xs font-medium shadow-xl ring-1 ring-black/10 min-w-[100px] max-w-[180px] truncate"
            style={{
              backgroundColor: moveDrag.assignment.jobSite.branchOffice.color + "30",
              color: moveDrag.assignment.jobSite.branchOffice.color,
              opacity: 0.9,
            }}
          >
            {moveDrag.assignment.jobSite.name}
            <div className="text-[10px] opacity-70 mt-0.5">
              {moveDrag.assignment.startTime}〜{moveDrag.assignment.endTime}
            </div>
          </div>
        </div>
      )}

      {/* Move confirmation modal */}
      {/* Bulk mode floating bar */}
      {bulkMode && bulkSelectedIds.size > 0 && !bulkPanelOpen && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-xl shadow-2xl px-4 md:px-5 py-2.5 md:py-3 flex items-center gap-3 md:gap-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <span className="text-sm font-medium tabular-nums">
            <strong className="text-primary">{bulkSelectedIds.size}名</strong> 選択中
          </span>
          <Button
            size="sm"
            onClick={() => setBulkPanelOpen(true)}
          >
            配置を作成
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBulkSelectedIds(new Set())}
          >
            選択解除
          </Button>
        </div>
      )}

      {/* Bulk Panel Overlay */}
      {bulkPanelOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-150"
          onClick={() => setBulkPanelOpen(false)}
        />
      )}

      {/* Bulk Assignment Window Modal */}
      {bulkPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-12 px-2 sm:px-4 pointer-events-none"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="pointer-events-auto w-full sm:w-[min(96vw,1080px)] max-w-full max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-4rem)] animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <BulkAssignmentPanel
              selectedStaff={staffRows
                .filter((s) => bulkSelectedIds.has(s.id))
                .map((s) => ({
                  id: s.id,
                  name: s.displayName || s.name,
                  branchColor: s.branchOffice.color,
                }))}
              date={startDate}
              endDate={startDate}
              onClose={() => setBulkPanelOpen(false)}
              onSaved={() => {
                setBulkPanelOpen(false);
                exitBulkMode();
                fetchData(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Print view */}
      {showPrint && (
        <CalendarPrint
          viewMode={viewMode === "site" ? "site" : "staff"}
          initialStart={printStart}
          initialEnd={printEnd}
          branchOfficeIds={selectedBranches}
          onClose={() => setShowPrint(false)}
        />
      )}

      {moveConfirm && (() => {
        const staffChanged = moveConfirm.fromStaffName !== moveConfirm.toStaffName;
        const ds = moveConfirm.dayShift;
        const dayLabel = ds > 0 ? `${ds}日後ろへ` : ds < 0 ? `${Math.abs(ds)}日前へ` : "";
        return (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setMoveConfirm(null)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm bg-card rounded-xl border shadow-2xl p-5 md:p-6">
            <h3 className="font-bold text-base mb-4">配置を移動しますか？</h3>
            <div className="space-y-3 text-sm mb-6">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">現場</div>
                <div className="font-semibold">{moveConfirm.assignment.jobSite.name}</div>
              </div>

              {/* Staff change */}
              {staffChanged && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 p-3 rounded-lg bg-destructive/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">移動元</div>
                    <div className="font-medium">{moveConfirm.fromStaffName}</div>
                  </div>
                  <div className="text-muted-foreground text-lg">→</div>
                  <div className="flex-1 p-3 rounded-lg bg-primary/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">移動先</div>
                    <div className="font-medium text-primary">{moveConfirm.toStaffName}</div>
                  </div>
                </div>
              )}

              {/* Date shift */}
              {ds !== 0 && (
                <div className="p-3 rounded-lg bg-primary/5 text-center">
                  <div className="text-xs text-muted-foreground mb-1">日程変更</div>
                  <div className="font-medium text-primary">{dayLabel}</div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setMoveConfirm(null)}
                disabled={moveLoading}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1"
                onClick={confirmMove}
                disabled={moveLoading}
              >
                {moveLoading ? "移動中..." : "移動する"}
              </Button>
            </div>
          </div>
        </>
        );
      })()}
    </div>
  );
}

