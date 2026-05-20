"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Trash2, MapPin, Clock, CalendarDays, AlertTriangle, ShieldAlert, Sun, Moon, Truck, Coins, StickyNote, Info, Users } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ASSIGNMENT_TYPES, ALLOWANCE_PRESETS, ALLOWANCE_CATEGORIES } from "@/lib/constants";
import type { Assignment, AssignmentAllowance, AssignmentDay } from "./types";

type StaffMatchEntry = { s: StaffInfo; match: { ok: boolean; reasons: string[] } };

function MultiStaffPicker({
  allStaff,
  filteredStaffList,
  selectedIds,
  onToggle,
  onClearAll,
  staffSearch,
  setStaffSearch,
  hasAnyRequirement,
  filterByRequirements,
  setFilterByRequirements,
  compact = false,
}: {
  allStaff: StaffInfo[];
  filteredStaffList: StaffMatchEntry[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClearAll: () => void;
  staffSearch: string;
  setStaffSearch: (v: string) => void;
  hasAnyRequirement: boolean;
  filterByRequirements: boolean;
  setFilterByRequirements: (v: boolean) => void;
  compact?: boolean;
}) {
  const selectedStaffList = allStaff.filter((s) => selectedIds.includes(s.id));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
          <span className="h-3 w-3 text-center">👤</span>
          スタッフ（複数選択可）
          {selectedIds.length > 0 && (
            <span className="ml-1 text-primary font-semibold">{selectedIds.length}名</span>
          )}
        </Label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            クリア
          </button>
        )}
      </div>

      {/* 選択済みのチップ表示 */}
      {selectedStaffList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedStaffList.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]"
              style={{ backgroundColor: (s.branchOffice?.color || "#888") + "22" }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: s.branchOffice?.color || "#888" }}
              />
              <span>{s.name}</span>
              <button
                type="button"
                className="hover:text-rose-600"
                onClick={() => onToggle(s.id)}
                aria-label="解除"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 検索 + 要件フィルタ + チェックボックスリスト */}
      <Input
        placeholder="スタッフ名で検索..."
        value={staffSearch}
        onChange={(e) => setStaffSearch(e.target.value)}
        className={cn("text-xs", compact ? "h-8" : "h-9")}
      />
      {hasAnyRequirement && (
        <label className="flex items-center gap-1.5 text-[10px] text-amber-800 px-1">
          <input
            type="checkbox"
            checked={filterByRequirements}
            onChange={(e) => setFilterByRequirements(e.target.checked)}
          />
          要件（保険・必須資格）を満たすスタッフのみ表示
        </label>
      )}
      {allStaff.length > 0 && (
        <div className="max-h-[200px] overflow-auto border rounded-md bg-background">
          {filteredStaffList.map(({ s, match }) => {
            const av = s.availability;
            const isFullyFree = !av || av.freeDays === av.totalDays;
            const isFullyBusy = !!av && av.freeDays === 0 && av.totalDays > 0;
            const isPartial = !!av && av.freeDays > 0 && av.busyDays > 0;
            const checked = selectedIds.includes(s.id);
            const conflictNames = av?.conflicts.map((c) => c.siteName).join(", ");
            return (
              <label
                key={s.id}
                className={cn(
                  "w-full px-2.5 py-1.5 hover:bg-accent flex items-center gap-2 text-xs cursor-pointer",
                  isFullyBusy && "opacity-60",
                  !match.ok && "bg-rose-50/30",
                  checked && "bg-primary/10",
                )}
                title={
                  [
                    av
                      ? `期間 ${av.totalDays}日中 空き ${av.freeDays}日 / 競合 ${av.busyDays}日${conflictNames ? `（${conflictNames}）` : ""}`
                      : undefined,
                    !match.ok ? `要件不足: ${match.reasons.join(", ")}` : undefined,
                  ].filter(Boolean).join(" / ") || undefined
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(s.id)}
                  className="shrink-0"
                />
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: s.branchOffice?.color || "#666" }}
                >
                  {s.name.charAt(0)}
                </div>
                <span className="truncate">{s.name}</span>
                {!match.ok && (
                  <span className="text-[9px] px-1 rounded bg-rose-100 text-rose-700 shrink-0">
                    {match.reasons[0]}
                  </span>
                )}
                <span className="text-muted-foreground ml-auto shrink-0">{s.employeeCode}</span>
                {av && (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 text-[10px] font-medium tabular-nums",
                      isFullyFree && "bg-emerald-100 text-emerald-700",
                      isPartial && "bg-amber-100 text-amber-700",
                      isFullyBusy && "bg-rose-100 text-rose-700",
                    )}
                  >
                    {isFullyFree && `空 ${av.totalDays}日`}
                    {isPartial && `空${av.freeDays}/${av.totalDays}`}
                    {isFullyBusy && `× ${av.totalDays}日`}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 共有された Google マップ URL から緯度経度を抽出する。
 * 対応パターン:
 *   - .../@35.6895,139.6917,17z/...      （マップ画面 URL）
 *   - !3d35.6895!4d139.6917              （プレイス共有 URL）
 *   - ?q=35.6895,139.6917 / ?ll=...      （クエリ）
 */
function extractLatLng(url: string): { lat: string; lng: string; zoom: string } | null {
  const atMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/);
  if (atMatch) {
    return { lat: atMatch[1], lng: atMatch[2], zoom: atMatch[3] || "18" };
  }
  const dMatch = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dMatch) {
    return { lat: dMatch[1], lng: dMatch[2], zoom: "18" };
  }
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("query") || u.searchParams.get("ll");
    if (q && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(q)) {
      const [lat, lng] = q.split(",");
      return { lat, lng, zoom: "18" };
    }
  } catch {
    // 無視（不正な URL）
  }
  return null;
}

/**
 * Google Maps 埋め込み。
 * - mapUrl が embed URL ならそのまま使う
 * - mapUrl から座標が拾えればその座標で高ズーム表示
 * - そうでなければ address を q= で渡し、ズーム 18 で建物レベル表示
 * - 外部リンクボタンで Google マップ本体を新規タブで開ける
 */
function SiteMap({
  address,
  mapUrl,
  siteName,
}: {
  address: string | null;
  mapUrl: string | null;
  siteName: string;
}) {
  const trimmedAddress = address?.trim() || "";
  const trimmedMapUrl = mapUrl?.trim() || "";

  // 埋め込み用 URL の決定
  const embedSrc = (() => {
    if (trimmedMapUrl) {
      // 既に embed URL or /maps/embed パスのものはそのまま
      if (trimmedMapUrl.includes("output=embed") || trimmedMapUrl.includes("/maps/embed")) {
        return trimmedMapUrl;
      }
      // 共有 URL から座標を抽出できれば、その座標でピン留め
      const coords = extractLatLng(trimmedMapUrl);
      if (coords) {
        return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=${coords.zoom}&output=embed`;
      }
    }
    // 住所（または現場名）で検索、建物レベルまでズーム
    const query = trimmedAddress || siteName;
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=18&output=embed`;
  })();

  // 外部リンク用 URL
  const externalHref = trimmedMapUrl
    ? trimmedMapUrl
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedAddress || siteName)}`;

  // パネルを開くたびに iframe を即読み込みすると配置を順次確認するワークフローで
  // Google Maps SDK へのリクエストが繰り返されるため、ユーザーが地図を必要と
  // 判断したタイミングでだけ mount する。
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> 地図
        </Label>
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
        >
          Google マップで開く ↗
        </a>
      </div>
      {showMap ? (
        <div className="rounded-md overflow-hidden border bg-muted/30">
          <iframe
            key={embedSrc}
            src={embedSrc}
            className="w-full h-[220px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`${siteName} の地図`}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="w-full h-[60px] rounded-md border border-dashed bg-muted/30 hover:bg-muted/50 text-[11px] text-muted-foreground transition-colors flex items-center justify-center gap-1"
        >
          <MapPin className="h-3 w-3" />
          地図を表示
        </button>
      )}
      {trimmedAddress && (
        <p className="text-[10px] text-muted-foreground">{trimmedAddress}</p>
      )}
    </div>
  );
}

/**
 * 加算手当リスト + 対象スタッフ選択。
 * 選択中スタッフが 2 人以上のとき、各手当に「対象」ボタンが出る。
 * 1 人のときは対象選択は不要なので非表示にする。
 */
function AllowanceList({
  allowances,
  selectedStaffIds,
  allStaff,
  openTargetIdx,
  setOpenTargetIdx,
  updateAllowance,
  removeAllowance,
  toggleAllowanceTarget,
}: {
  allowances: AssignmentAllowance[];
  selectedStaffIds: number[];
  allStaff: StaffInfo[];
  openTargetIdx: number | null;
  setOpenTargetIdx: (n: number | null) => void;
  updateAllowance: (idx: number, patch: Partial<AssignmentAllowance>) => void;
  removeAllowance: (idx: number) => void;
  toggleAllowanceTarget: (idx: number, staffId: number) => void;
}) {
  // 選択中スタッフ ID → 表示名 / 営業所色 を引けるマップ
  const staffMap = new Map(allStaff.map((s) => [s.id, s]));
  const showTargetUI = selectedStaffIds.length >= 2;
  return (
    <>
      {allowances.map((a, idx) => {
        const isAll = !a.targetStaffIds || a.targetStaffIds.length === 0;
        const targetCount = isAll ? selectedStaffIds.length : a.targetStaffIds!.length;
        const isOpen = openTargetIdx === idx;
        return (
          <div key={idx} className={cn("space-y-1.5", showTargetUI && "rounded-md border border-border/60 p-2")}>
            <div className="flex items-center gap-1.5">
              <Input
                value={a.name}
                onChange={(e) => updateAllowance(idx, { name: e.target.value })}
                placeholder="名称（例: 路内手当）"
                className="text-xs h-8 flex-1"
              />
              <select
                value={a.category}
                onChange={(e) => updateAllowance(idx, { category: e.target.value as "special" | "other" })}
                className="text-xs h-8 px-1 rounded border bg-background"
              >
                {Object.entries(ALLOWANCE_CATEGORIES).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={a.amount === 0 ? "" : String(a.amount)}
                onChange={(e) => updateAllowance(idx, { amount: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                placeholder="円"
                className="text-xs h-8 w-20"
              />
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeAllowance(idx)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            {showTargetUI && (
              <>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setOpenTargetIdx(isOpen ? null : idx)}
                    className={cn(
                      "px-2 py-0.5 rounded border text-[10px] font-medium",
                      isAll ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary border-primary/30"
                    )}
                  >
                    対象: {isAll ? `全員 (${targetCount}名)` : `${targetCount} / ${selectedStaffIds.length}名`} {isOpen ? "▲" : "▼"}
                  </button>
                  {!isAll && (
                    <button
                      type="button"
                      onClick={() => updateAllowance(idx, { targetStaffIds: [] })}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      全員に戻す
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-2 rounded bg-muted/30">
                    {selectedStaffIds.map((sid) => {
                      const s = staffMap.get(sid);
                      if (!s) return null;
                      const checked = isAll || (a.targetStaffIds ?? []).includes(sid);
                      return (
                        <label key={sid} className="flex items-center gap-1 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAllowanceTarget(idx, sid)}
                          />
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: s.branchOffice.color }}
                          />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function PreDeclineSection({
  existingAssignment,
  displayAssignment,
  loading,
  onToggle,
}: {
  existingAssignment: Assignment | null;
  displayAssignment: Assignment | null | undefined;
  loading: boolean;
  onToggle: () => void;
}) {
  if (!existingAssignment) return null;
  const allDays = displayAssignment?.assignmentDays ?? [];
  const isDeclined =
    allDays.length > 0 && allDays.every((d) => d.status === "pre_declined");
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={isDeclined ? "default" : "outline"}
        size="sm"
        className={cn(
          "w-full h-9 text-xs",
          isDeclined && "bg-rose-600 hover:bg-rose-700 text-white",
        )}
        onClick={onToggle}
        disabled={loading}
      >
        {isDeclined ? "🚫 事前断り中（クリックで解除）" : "事前断りに変更"}
      </Button>
      <a
        href={`/assignments/${existingAssignment.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center h-9 leading-9 text-xs rounded-md border bg-background hover:bg-accent"
      >
        配置詳細ページを開く
      </a>
    </div>
  );
}
import { SiteSelect } from "@/components/sites/site-select";

type JobSite = {
  id: number;
  name: string;
  siteCode: string;
  requiredInsurance?: string | null;
  branchOfficeId?: number;
  notes?: string | null;
  belongings?: string | null;
  contactName1?: string | null;
  contactTel1?: string | null;
  qualificationBonuses?: {
    qualificationId: number;
    isRequired?: boolean;
    qualification?: { id: number; name: string };
  }[];
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
  hasShaho?: boolean;
  hasKokuho?: boolean;
  hasIchiriOyakata?: boolean;
  branchOfficeId?: number;
  branchOffice: { name: string; color: string };
  staffQualifications?: { qualification: { id: number; name: string } }[];
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

type VehicleConflictWarning = {
  plateNumber: string;
  vehicleName: string | null;
  conflictingSiteName: string;
  dates: string[];
};

type SiteRequirements = {
  requiredInsurance: string | null | undefined;
  branchOfficeId: number | undefined;
  requiredQualificationIds: number[];
};

// 配置先現場の要件をスタッフが満たしているかを判定。
// 「満たすスタッフのみ表示」フィルタや、リスト中の不適合バッジ表示に使う。
function staffMeetsSiteRequirements(
  staff: StaffInfo,
  req: SiteRequirements,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (req.requiredInsurance === "company_only" && !staff.hasShaho) {
    reasons.push("社保なし");
  }
  if (req.requiredInsurance === "national_only" && !staff.hasKokuho) {
    reasons.push("国保なし");
  }
  if (
    req.branchOfficeId !== undefined &&
    staff.branchOfficeId !== undefined &&
    staff.branchOfficeId !== req.branchOfficeId
  ) {
    // 同じ営業所に統一する厳しいモードでのみ NG とする運用。デモではフィルタで参考表示
    reasons.push("営業所違い");
  }
  if (req.requiredQualificationIds.length > 0) {
    const heldIds = new Set(
      (staff.staffQualifications ?? []).map((sq) => sq.qualification.id),
    );
    const missing = req.requiredQualificationIds.filter((id) => !heldIds.has(id));
    if (missing.length > 0) {
      reasons.push(`資格不足(${missing.length})`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

export function AssignmentPanel({
  staffId: staffIdProp,
  preselectedSiteId,
  date,
  endDate: endDateProp,
  assignment: existingAssignment,
  cachedSites,
  cachedVehicles,
  onClose,
  onSaved,
}: {
  staffId: number | null;
  preselectedSiteId?: number | null;
  date: string;
  endDate?: string;
  assignment: Assignment | null;
  cachedSites?: JobSite[];
  cachedVehicles?: VehicleInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existingAssignment;
  const isSiteMode = !staffIdProp && !!preselectedSiteId;
  const isUnassignedEdit = isEdit && existingAssignment?.staffId == null;
  const needsStaffSelection = isSiteMode || isUnassignedEdit;
  // 複数選択対応: 議事録メモ「配置複数人選択」
  // 新規作成モード: 0=未割当、1=単発作成、2+=bulk API
  // 編集モード:
  //   - selectedStaffIds[0] = 既存 Assignment のスタッフ（変更可、null=未割当へ）
  //   - selectedStaffIds[1..] = 追加で作成する新規 Assignment 用のスタッフ
  const initialIds: number[] = (() => {
    if (existingAssignment?.staffId != null) return [existingAssignment.staffId];
    if (staffIdProp != null) return [staffIdProp];
    return [];
  })();
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>(initialIds);
  const selectedStaffId = selectedStaffIds[0] ?? null;
  const staffId = selectedStaffId;
  // 複数トグルヘルパー
  function toggleStaff(id: number) {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  const [allStaff, setAllStaff] = useState<StaffInfo[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  // 議事録: 「必要保険・所属で登録 → 満たすスタッフのみ表示」
  const [filterByRequirements, setFilterByRequirements] = useState(true);
  // 親から渡された場合はキャッシュを優先（モーダル毎の再 fetch を回避してパフォーマンス改善）
  const [sites, setSites] = useState<JobSite[]>(cachedSites ?? []);
  const [vehicles, setVehicles] = useState<VehicleInfo[]>(cachedVehicles ?? []);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullAssignment, setFullAssignment] = useState<Assignment | null>(null);
  // 日別単価の編集中バッファ。onBlur で PATCH し、確定後は fullAssignment.assignmentDays に反映する。
  const [dayRateEdits, setDayRateEdits] = useState<Record<number, string>>({});
  const [savingRateDayId, setSavingRateDayId] = useState<number | null>(null);
  // 日別オーダー人数の編集中バッファ
  const [dayOrderEdits, setDayOrderEdits] = useState<Record<number, string>>({});
  const [savingOrderDayId, setSavingOrderDayId] = useState<number | null>(null);
  const siteSelectRef = useRef<HTMLSelectElement>(null);
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [insuranceWarning, setInsuranceWarning] = useState<InsuranceWarning | null>(null);
  const [vehicleConflicts, setVehicleConflicts] = useState<VehicleConflictWarning[]>([]);
  const [orderHeadcountWarnings, setOrderHeadcountWarnings] = useState<
    { date: string; orderHeadcount: number; projectedCount: number; overflow: number }[]
  >([]);
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
    orderHeadcount: string;
    belongings: string;
    contactName: string;
    contactTel: string;
    transportation: string;
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
    // 新規作成時に「全日に同じ初期値を入れる」用。編集時は日別単価表で個別管理する。
    orderHeadcount: "",
    belongings: existingAssignment?.belongings ?? "",
    contactName: existingAssignment?.contactName ?? "",
    contactTel: existingAssignment?.contactTel ?? "",
    transportation: existingAssignment?.transportation ?? "",
    notes: existingAssignment?.notes ?? "",
  });

  // 配置単位の手当（路内・出張・とび・食事 等）
  const [allowances, setAllowances] = useState<AssignmentAllowance[]>(
    existingAssignment?.allowances ?? [],
  );

  useEffect(() => {
    // 親からキャッシュを貰っていない場合のみ fetch（後方互換）
    if (!cachedSites || cachedSites.length === 0) {
      fetch("/api/sites?status=active")
        .then((r) => {
          if (!r.ok) throw new Error("認証エラー");
          return r.json();
        })
        .then((data) => {
          if (Array.isArray(data)) setSites(data);
        })
        .catch(() => toast.error("現場データの取得に失敗しました"));
    }
    if (!cachedVehicles || cachedVehicles.length === 0) {
      fetch("/api/vehicles")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setVehicles(data.filter((v: VehicleInfo) => v.isActive));
        })
        .catch(() => {});
    }
    // Auto-focus site select on create mode
    if (!isEdit) {
      setTimeout(() => siteSelectRef.current?.focus(), 100);
    }

    // 既に親（calendar-view）から渡っている existingAssignment は allowances / belongings / contactName /
    // contactTel など必要なフィールドを含むので、再フェッチをスキップして即座に form を初期化する。
    // モーダル開閉時の API 待ちによる描画遅延を解消するための最適化。
    if (existingAssignment) {
      setFullAssignment(existingAssignment);
      setForm((p) => ({
        ...p,
        vehicleId: existingAssignment.vehicleId ?? null,
        dailyRateOverride:
          existingAssignment.dailyRateOverride != null
            ? String(existingAssignment.dailyRateOverride)
            : "",
        belongings: existingAssignment.belongings ?? "",
        contactName: existingAssignment.contactName ?? "",
        contactTel: existingAssignment.contactTel ?? "",
        transportation: existingAssignment.transportation ?? "",
        notes: existingAssignment.notes ?? "",
      }));
      if (existingAssignment.allowances) {
        setAllowances(existingAssignment.allowances);
      }
    }

    // 配置済みのスタッフ情報も calendar-view が既に持っているはず（staffRows 内）。
    // ただしスタッフ詳細を取りに行くケースがあるので、staffInfo がまだ無いときだけフェッチ。
    if (staffId && !staffInfo) {
      fetch(`/api/staff/${staffId}`)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(setStaffInfo)
        .catch(() => {});
    }
    // cachedSites / cachedVehicles / staffInfo は深い比較が不要なので intentionally omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, existingAssignment, isEdit]);

  // 新規作成時：選択された現場マスタから持ち物・担当者・連絡先・交通手段を prefill（空欄のときだけ）
  // 議事録 L470: 「持ち物・搬送車（交通手段）・住所が自動で飛んでくる」
  useEffect(() => {
    if (isEdit) return;
    if (!form.jobSiteId) return;
    const site = sites.find((s) => s.id === form.jobSiteId);
    if (!site) return;
    setForm((p) => ({
      ...p,
      belongings: p.belongings || (site as { belongings?: string | null }).belongings || "",
      contactName: p.contactName || (site as { contactName1?: string | null }).contactName1 || "",
      contactTel: p.contactTel || (site as { contactTel1?: string | null }).contactTel1 || "",
      transportation:
        p.transportation || (site as { transportation?: string | null }).transportation || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.jobSiteId, sites, isEdit]);

  // スタッフ一覧の取得:
  //   - 編集モードでも MultiStaffPicker を表示するため全モードで取得する。
  const needsStaffList = true;
  useEffect(() => {
    if (!needsStaffList) return;
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
  }, [needsStaffList, isUnassignedEdit, existingAssignment?.startDate, existingAssignment?.endDate, form.startDate, form.endDate]);

  async function handleCreate(force = false) {
    if (!form.jobSiteId || !form.startDate || !form.endDate) {
      toast.error("現場と日付を選択してください");
      return;
    }
    setLoading(true);
    try {
      const rateNum = form.dailyRateOverride.trim()
        ? Math.max(0, Math.floor(Number(form.dailyRateOverride)))
        : null;
      const orderNum = form.orderHeadcount.trim()
        ? Math.max(0, Math.floor(Number(form.orderHeadcount)))
        : null;
      const cleanAllowances = allowances
        .filter((a) => a.name.trim() && a.amount > 0)
        .map((a) => ({
          name: a.name.trim(),
          amount: a.amount,
          category: a.category,
          // targetStaffIds は bulk 適用時のみ意味を持つ。空 / 未指定なら全員。
          ...(a.targetStaffIds && a.targetStaffIds.length > 0
            ? { targetStaffIds: a.targetStaffIds }
            : {}),
        }));

      // 共通ペイロード
      const sharedPayload = {
        jobSiteId: form.jobSiteId,
        vehicleId: form.vehicleId ?? null,
        startDate: form.startDate,
        endDate: form.endDate,
        assignmentType: form.assignmentType,
        shiftType: form.shiftType,
        startTime: form.startTime,
        endTime: form.endTime,
        dailyRateOverride: rateNum,
        orderHeadcount: orderNum,
        belongings: form.belongings.trim() || null,
        contactName: form.contactName.trim() || null,
        contactTel: form.contactTel.trim() || null,
        transportation: form.transportation.trim() || null,
        notes: form.notes.trim() || null,
        allowances: cleanAllowances,
        force,
      };

      // 議事録「配置複数人選択」: 2人以上選択時は bulk API を使用
      const isBulk = selectedStaffIds.length >= 2;
      const url = isBulk ? "/api/assignments/bulk" : "/api/assignments";
      const body = isBulk
        ? { ...sharedPayload, staffIds: selectedStaffIds }
        : { ...sharedPayload, staffId: selectedStaffIds[0] ?? null };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        const data = await res.json();
        setConflicts(
          isBulk
            ? // bulk のレスポンスは {staffName, sites[]} 形式 → ConflictWarning 形式に正規化
              (data.conflicts ?? []).flatMap((c: { staffName: string; sites: string[] }) =>
                c.sites.map((siteName: string) => ({ siteName: `${c.staffName} → ${siteName}`, dates: [] })),
              )
            : data.conflicts || [],
        );
        setInsuranceWarning(data.insuranceWarning || null);
        setVehicleConflicts(data.vehicleConflicts || []);
        setOrderHeadcountWarnings(data.orderHeadcountWarnings || []);
        setShowForceConfirm(true);
        return;
      }
      if (res.ok) {
        toast.success(isBulk ? `${selectedStaffIds.length}名を配置しました` : "配置を作成しました");
        setConflicts([]);
        setInsuranceWarning(null);
        setVehicleConflicts([]);
        setOrderHeadcountWarnings([]);
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
      const cleanAllowances = allowances
        .filter((a) => a.name.trim() && a.amount > 0)
        .map((a) => ({
          name: a.name.trim(),
          amount: a.amount,
          category: a.category,
          // targetStaffIds は bulk 適用時のみ意味を持つ。空 / 未指定なら全員。
          ...(a.targetStaffIds && a.targetStaffIds.length > 0
            ? { targetStaffIds: a.targetStaffIds }
            : {}),
        }));

      // 編集モードでは selectedStaffIds の先頭が「このカードのスタッフ」、
      // それ以降が「同条件で追加配置する新規 Assignment 用」のスタッフ。
      const primaryStaffId = selectedStaffIds[0] ?? null;
      const additionalStaffIds = selectedStaffIds.slice(1);

      // 1) 既存 Assignment を PUT 更新（スタッフ変更含む）
      const res = await fetch(`/api/assignments/${existingAssignment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: primaryStaffId,
          assignmentType: form.assignmentType,
          shiftType: form.shiftType,
          startTime: form.startTime,
          endTime: form.endTime,
          vehicleId: form.vehicleId ?? null,
          dailyRateOverride: rateNum,
          belongings: form.belongings.trim() || null,
          contactName: form.contactName.trim() || null,
          contactTel: form.contactTel.trim() || null,
          transportation: form.transportation.trim() || null,
          notes: form.notes.trim() || null,
          allowances: cleanAllowances,
          force,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setConflicts(data.conflicts || []);
        setInsuranceWarning(data.insuranceWarning || null);
        setVehicleConflicts(data.vehicleConflicts || []);
        setOrderHeadcountWarnings(data.orderHeadcountWarnings || []);
        setShowForceConfirm(true);
        return;
      }
      if (!res.ok) {
        toast.error("更新に失敗しました");
        return;
      }

      // 2) 追加スタッフがいれば、bulk POST で同条件の新規 Assignment を作成
      if (additionalStaffIds.length > 0) {
        const bulkRes = await fetch("/api/assignments/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffIds: additionalStaffIds,
            jobSiteId: existingAssignment.jobSite.id,
            vehicleId: form.vehicleId ?? null,
            startDate: existingAssignment.startDate ?? form.startDate,
            endDate: existingAssignment.endDate ?? form.endDate,
            assignmentType: form.assignmentType,
            shiftType: form.shiftType,
            startTime: form.startTime,
            endTime: form.endTime,
            dailyRateOverride: rateNum,
            // 追加スタッフ分の orderHeadcount は null。既存日の値を引き継ぎたい場合は日別単価表で個別調整。
            orderHeadcount: null,
            belongings: form.belongings.trim() || null,
            contactName: form.contactName.trim() || null,
            contactTel: form.contactTel.trim() || null,
            transportation: form.transportation.trim() || null,
            notes: form.notes.trim() || null,
            allowances: cleanAllowances,
            force,
          }),
        });
        if (bulkRes.status === 409) {
          const data = await bulkRes.json();
          setConflicts(
            (data.conflicts ?? []).flatMap((c: { staffName: string; sites: string[] }) =>
              c.sites.map((siteName: string) => ({
                siteName: `${c.staffName} → ${siteName}`,
                dates: [],
              })),
            ),
          );
          setInsuranceWarning(data.insuranceWarning || null);
          setVehicleConflicts(data.vehicleConflicts || []);
          setOrderHeadcountWarnings(data.orderHeadcountWarnings || []);
          setShowForceConfirm(true);
          return;
        }
        if (!bulkRes.ok) {
          toast.error("追加配置の作成に失敗しました（既存配置は更新済み）");
          // 既存は更新済みなので onSaved を呼んで画面をリフレッシュ
          onSaved();
          return;
        }
        toast.success(`配置を更新し、${additionalStaffIds.length}名を追加配置しました`);
      } else {
        toast.success("配置を更新しました");
      }
      setConflicts([]);
      setInsuranceWarning(null);
      setVehicleConflicts([]);
      setOrderHeadcountWarnings([]);
      setShowForceConfirm(false);
      onSaved();
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

  // 事前断りトグル：配置全期間の AssignmentDay.status を一括変更
  async function handleTogglePreDeclined() {
    if (!existingAssignment) return;
    const allDays = displayAssignment?.assignmentDays ?? [];
    const isCurrentlyDeclined =
      allDays.length > 0 && allDays.every((d) => d.status === "pre_declined");
    const nextStatus = isCurrentlyDeclined ? "scheduled" : "pre_declined";
    setLoading(true);
    try {
      const res = await fetch(
        `/api/assignments/${existingAssignment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (res.ok) {
        toast.success(isCurrentlyDeclined ? "事前断りを解除しました" : "事前断りに変更しました");
        // 楽観更新
        setFullAssignment((prev) =>
          prev
            ? {
                ...prev,
                assignmentDays: prev.assignmentDays.map((d) => ({ ...d, status: nextStatus })),
              }
            : prev,
        );
      } else {
        toast.error("更新に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // 手当の編集ヘルパ
  function addAllowance(preset?: { name: string; category: "special" | "other"; defaultAmount: number }) {
    if (preset) {
      setAllowances((prev) => [...prev, { name: preset.name, amount: preset.defaultAmount, category: preset.category, targetStaffIds: [] }]);
    } else {
      setAllowances((prev) => [...prev, { name: "", amount: 0, category: "special", targetStaffIds: [] }]);
    }
  }
  // 加算手当の対象スタッフトグル（複数選択中のみ意味を持つ）
  function toggleAllowanceTarget(idx: number, staffId: number) {
    setAllowances((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const currentTargets = (a.targetStaffIds && a.targetStaffIds.length > 0)
          ? a.targetStaffIds
          : selectedStaffIds; // 空 = 全員 を実体化
        const next = currentTargets.includes(staffId)
          ? currentTargets.filter((id) => id !== staffId)
          : [...currentTargets, staffId];
        // 全員選択中なら空に戻して「全員」表現
        const isAll = selectedStaffIds.length > 0
          && selectedStaffIds.every((id) => next.includes(id))
          && next.length === selectedStaffIds.length;
        return { ...a, targetStaffIds: isAll ? [] : next };
      })
    );
  }
  // 開いている対象選択 UI の index
  const [openTargetIdx, setOpenTargetIdx] = useState<number | null>(null);
  function updateAllowance(idx: number, patch: Partial<AssignmentAllowance>) {
    setAllowances((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }
  function removeAllowance(idx: number) {
    setAllowances((prev) => prev.filter((_, i) => i !== idx));
  }

  // 日別単価を保存（入力欄の blur 時に発火）
  async function saveDayRate(day: AssignmentDay, raw: string) {
    if (!existingAssignment) return;
    const trimmed = raw.trim();
    const nextOverride: number | null = trimmed
      ? Math.max(0, Math.floor(Number(trimmed)))
      : null;
    if (Number.isNaN(nextOverride as number)) {
      toast.error("数値で入力してください");
      return;
    }
    if ((day.dailyRateOverride ?? null) === nextOverride) {
      // 変更なし
      setDayRateEdits((prev) => {
        if (!(day.id in prev)) return prev;
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
      return;
    }
    setSavingRateDayId(day.id);
    try {
      const res = await fetch(
        `/api/assignments/${existingAssignment.id}/days/${day.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailyRateOverride: nextOverride }),
        },
      );
      if (!res.ok) {
        toast.error("単価の保存に失敗しました");
        return;
      }
      setFullAssignment((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assignmentDays: prev.assignmentDays.map((d) =>
            d.id === day.id ? { ...d, dailyRateOverride: nextOverride } : d,
          ),
        };
      });
      setDayRateEdits((prev) => {
        if (!(day.id in prev)) return prev;
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
    } catch {
      toast.error("単価の保存に失敗しました");
    } finally {
      setSavingRateDayId(null);
    }
  }

  // 日別オーダー人数を保存
  async function saveDayOrder(day: AssignmentDay, raw: string) {
    if (!existingAssignment) return;
    const trimmed = raw.trim();
    const nextOrder: number | null = trimmed
      ? Math.max(0, Math.floor(Number(trimmed)))
      : null;
    if (Number.isNaN(nextOrder as number)) {
      toast.error("数値で入力してください");
      return;
    }
    if ((day.orderHeadcount ?? null) === nextOrder) {
      setDayOrderEdits((prev) => {
        if (!(day.id in prev)) return prev;
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
      return;
    }
    setSavingOrderDayId(day.id);
    try {
      const res = await fetch(
        `/api/assignments/${existingAssignment.id}/days/${day.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderHeadcount: nextOrder }),
        },
      );
      if (!res.ok) {
        toast.error("オーダー人数の保存に失敗しました");
        return;
      }
      setFullAssignment((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assignmentDays: prev.assignmentDays.map((d) =>
            d.id === day.id ? { ...d, orderHeadcount: nextOrder } : d,
          ),
        };
      });
      setDayOrderEdits((prev) => {
        if (!(day.id in prev)) return prev;
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
    } catch {
      toast.error("オーダー人数の保存に失敗しました");
    } finally {
      setSavingOrderDayId(null);
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

  // 配置先現場の要件（必要保険・所属・必須資格）。スタッフフィルタと
  // 「必須資格を持っていない既存配置スタッフへのエラー表記」に使う。
  // selectedSite が変わったときだけ再計算するように useMemo で固定。
  const siteRequirements: SiteRequirements = useMemo(() => ({
    requiredInsurance: (selectedSite as { requiredInsurance?: string | null } | undefined)?.requiredInsurance ?? null,
    branchOfficeId: (selectedSite as { branchOfficeId?: number } | undefined)?.branchOfficeId,
    requiredQualificationIds:
      (selectedSite as { qualificationBonuses?: { qualificationId: number; isRequired?: boolean }[] } | undefined)
        ?.qualificationBonuses
        ?.filter((qb) => qb.isRequired)
        .map((qb) => qb.qualificationId) ?? [],
  }), [selectedSite]);
  const hasAnyRequirement =
    !!siteRequirements.requiredInsurance ||
    siteRequirements.requiredQualificationIds.length > 0;

  // 編集時、すでに割当てられているスタッフが現場の必須資格を満たしていなければエラー表記
  const currentlyAssignedStaff = useMemo(
    () =>
      displayAssignment?.staffId
        ? allStaff.find((s) => s.id === displayAssignment.staffId) ?? staffInfo
        : null,
    [displayAssignment?.staffId, allStaff, staffInfo],
  );
  const assignedStaffMismatch = useMemo(
    () =>
      isEdit && currentlyAssignedStaff && hasAnyRequirement
        ? staffMeetsSiteRequirements(currentlyAssignedStaff, siteRequirements)
        : null,
    [isEdit, currentlyAssignedStaff, hasAnyRequirement, siteRequirements],
  );

  // スタッフ検索キーストロークごとの再計算を抑えるためメモ化。
  // 「要件マッチ判定」「検索一致」「要件フィルタ」を1パスで実施。
  const filteredStaffList = useMemo(() => {
    if (allStaff.length === 0) return [] as Array<{
      s: StaffInfo;
      match: { ok: boolean; reasons: string[] };
    }>;
    const q = staffSearch.trim().toLowerCase();
    const result: Array<{ s: StaffInfo; match: { ok: boolean; reasons: string[] } }> = [];
    for (const s of allStaff) {
      if (q) {
        const nm = s.name.toLowerCase();
        const cd = s.employeeCode.toLowerCase();
        if (!nm.includes(q) && !cd.includes(q)) continue;
      }
      const match = staffMeetsSiteRequirements(s, siteRequirements);
      if (filterByRequirements && hasAnyRequirement && !match.ok) continue;
      result.push({ s, match });
    }
    return result;
  }, [allStaff, staffSearch, siteRequirements, hasAnyRequirement, filterByRequirements]);

  // Count scheduled/cancelled days
  const scheduledCount =
    displayAssignment?.assignmentDays.filter((d) => d.status === "scheduled")
      .length || 0;
  const cancelledCount =
    displayAssignment?.assignmentDays.filter((d) => d.status === "cancelled")
      .length || 0;

  return (
    <div className="w-full bg-card rounded-xl border shadow-2xl flex flex-col max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30 rounded-t-xl">
        <div className="min-w-0">
          <h3 className="font-bold text-base">
            {isEdit ? "配置編集" : "新規配置"}
          </h3>
          {date && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(date + "T00:00:00"), "M月d日(E)", { locale: ja })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 編集モードでは「事前断り」トグル & 印刷リンクをヘッダに常時表示（見落とし防止） */}
          {isEdit && existingAssignment && (() => {
            const allDays = displayAssignment?.assignmentDays ?? [];
            const isDeclined =
              allDays.length > 0 && allDays.every((d) => d.status === "pre_declined");
            return (
              <>
                <Button
                  type="button"
                  variant={isDeclined ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs",
                    isDeclined && "bg-rose-600 hover:bg-rose-700 text-white",
                  )}
                  onClick={handleTogglePreDeclined}
                  disabled={loading}
                >
                  {isDeclined ? "🚫 事前断り中" : "事前断りに変更"}
                </Button>
                <a
                  href={`/print/assignment/${existingAssignment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 px-3 text-xs rounded-md border border-input bg-background hover:bg-accent transition-colors"
                >
                  印刷
                </a>
              </>
            );
          })()}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content — 横長モーダル: 左にスタッフ選択、右にその他フォーム */}
      <div className="flex-1 overflow-auto p-4 md:p-5">
        <div className="md:grid md:grid-cols-[minmax(0,360px)_1fr] md:gap-5 space-y-4 md:space-y-0">
        {/* Staff info の独立表示は廃止。選択中のスタッフは MultiStaffPicker のチップに集約。 */}

        {isEdit && displayAssignment ? (
          <>
            {/* 左カラム: 編集モードでも追加（新規）と同じ MultiStaffPicker を表示 */}
            <div className={cn(
              "rounded-lg border p-3 space-y-2",
              isUnassignedEdit ? "border-amber-300 bg-amber-50" : "border-border bg-muted/30",
            )}>
              <div className="flex items-center gap-1.5 font-medium text-xs">
                {isUnassignedEdit && <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />}
                <span className={isUnassignedEdit ? "text-amber-800" : "text-muted-foreground"}>
                  {isUnassignedEdit
                    ? "未割当配置 — スタッフを選んで割当"
                    : "スタッフ（先頭=このカードのスタッフ / 2人目以降=同条件で追加配置）"}
                </span>
              </div>
              <MultiStaffPicker
                allStaff={allStaff}
                filteredStaffList={filteredStaffList}
                selectedIds={selectedStaffIds}
                onToggle={toggleStaff}
                onClearAll={() => setSelectedStaffIds([])}
                staffSearch={staffSearch}
                setStaffSearch={setStaffSearch}
                hasAnyRequirement={hasAnyRequirement}
                filterByRequirements={filterByRequirements}
                setFilterByRequirements={setFilterByRequirements}
                compact
              />
            </div>

            {/* 右カラム: 配置の詳細・手当・警告・日別管理 */}
            <div className="space-y-4 min-w-0">

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
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {displayAssignment.jobSite.name}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {displayAssignment.jobSite.siteCode}
                  {displayAssignment.jobSite.address && (
                    <> · {displayAssignment.jobSite.address}</>
                  )}
                </div>
              </div>
            </div>

            {/* Google Maps 埋め込み */}
            <SiteMap
              address={displayAssignment.jobSite.address ?? null}
              mapUrl={displayAssignment.jobSite.mapUrl ?? null}
              siteName={displayAssignment.jobSite.name}
            />

            {/* 議事録: 「条件を追加した際に、満たしていないユーザをアサインしていた場合 error 表記」 */}
            {assignedStaffMismatch && !assignedStaffMismatch.ok && currentlyAssignedStaff && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-700 font-medium text-xs">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  配置済みスタッフが現場の要件を満たしていません
                </div>
                <div className="text-[11px] text-rose-700">
                  <span className="font-medium">{currentlyAssignedStaff.name}</span>
                  : {assignedStaffMismatch.reasons.join(", ")}
                </div>
                <div className="text-[10px] text-rose-600">
                  現場側の必須要件が後から追加された可能性があります。配置の見直しを推奨します。
                </div>
              </div>
            )}

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
              <p className="text-[10px] text-muted-foreground mt-1">
                ※ オーダー人数は日毎に変わるため、下の「日別 オーダー人数 / 単価」表で各日に設定してください
              </p>
            </div>

            {/* 持ち物 */}
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5">持ち物</Label>
              <Textarea
                value={form.belongings}
                onChange={(e) => setForm((p) => ({ ...p, belongings: e.target.value }))}
                rows={2}
                placeholder="ヘルメット、安全靴、手袋 …（現場マスタから自動 prefill）"
                className="text-xs"
              />
            </div>

            {/* 担当者 + 電話番号 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5">担当者</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                  className="text-xs h-9"
                  placeholder="現場担当者"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5">電話番号</Label>
                <Input
                  value={form.contactTel}
                  onChange={(e) => setForm((p) => ({ ...p, contactTel: e.target.value }))}
                  className="text-xs h-9"
                  placeholder="090-..."
                />
              </div>
            </div>

            {/* 交通手段 */}
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5">交通手段</Label>
              <Input
                value={form.transportation}
                onChange={(e) => setForm((p) => ({ ...p, transportation: e.target.value }))}
                className="text-xs h-9"
                placeholder="例: 自家用車、電車、現場集合（現場マスタから自動 prefill）"
              />
            </div>

            {/* 加算手当 */}
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" /> 加算手当
              </Label>
              <AllowanceList
                allowances={allowances}
                selectedStaffIds={selectedStaffIds}
                allStaff={allStaff}
                openTargetIdx={openTargetIdx}
                setOpenTargetIdx={setOpenTargetIdx}
                updateAllowance={updateAllowance}
                removeAllowance={removeAllowance}
                toggleAllowanceTarget={toggleAllowanceTarget}
              />
              <div className="flex flex-wrap gap-1">
                {ALLOWANCE_PRESETS.map((p) => (
                  <Button
                    key={p.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => addAllowance(p)}
                  >
                    + {p.name}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => addAllowance()}
                >
                  + 自由入力
                </Button>
              </div>
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
                {vehicleConflicts.length > 0 && (
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-orange-700 font-medium text-xs">
                      <Truck className="h-3.5 w-3.5" />
                      車両の二重利用
                    </div>
                    {vehicleConflicts.map((vc, i) => (
                      <div key={i} className="text-[11px] text-orange-700">
                        <span className="font-medium font-mono">{vc.plateNumber}</span>
                        {vc.vehicleName && <span className="text-orange-600">（{vc.vehicleName}）</span>}
                        は <span className="font-medium">{vc.conflictingSiteName}</span> で {vc.dates.length}日間 使用中
                      </div>
                    ))}
                  </div>
                )}
                {orderHeadcountWarnings.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-medium text-xs">
                      <Users className="h-3.5 w-3.5" />
                      オーダー人数 超過
                    </div>
                    {orderHeadcountWarnings.map((w) => (
                      <div key={w.date} className="text-[11px] text-rose-700 tabular-nums">
                        {w.date}: 発注 <span className="font-medium">{w.orderHeadcount}名</span> に対し
                        配置 <span className="font-medium">{w.projectedCount}名</span>
                        （+{w.overflow}名 過剰）
                      </div>
                    ))}
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

            {/* 日別 オーダー人数 + 単価 — AssignmentDay の per-day 編集 */}
            {displayAssignment.assignmentDays.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> 日別 オーダー人数 / 単価
                </Label>
                <div className="rounded-md border max-h-[260px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/40">
                      <tr className="text-[10px] text-muted-foreground">
                        <th className="text-left px-2 py-1 font-medium">日付</th>
                        <th className="text-left px-2 py-1 font-medium">状態</th>
                        <th className="text-right px-2 py-1 font-medium">オーダー人数</th>
                        <th className="text-right px-2 py-1 font-medium">単価（円）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayAssignment.assignmentDays.map((day) => {
                        const d = new Date(day.date + "T00:00:00");
                        const dayOfWeek = d.getDay();
                        const fallback =
                          form.dailyRateOverride.trim()
                            ? Math.max(0, Math.floor(Number(form.dailyRateOverride)))
                            : null;
                        const storedRate = day.dailyRateOverride ?? null;
                        const editingRate = dayRateEdits[day.id];
                        const rateValue = editingRate ?? (storedRate != null ? String(storedRate) : "");
                        const ratePlaceholder = fallback != null ? String(fallback) : "基本日当";
                        const storedOrder = day.orderHeadcount ?? null;
                        const editingOrder = dayOrderEdits[day.id];
                        const orderValue = editingOrder ?? (storedOrder != null ? String(storedOrder) : "");
                        const statusLabel =
                          day.status === "scheduled"
                            ? "出勤"
                            : day.status === "cancelled"
                              ? "休"
                              : day.status === "pre_declined"
                                ? "断"
                                : day.status;
                        return (
                          <tr key={day.id} className="border-t">
                            <td
                              className={cn(
                                "px-2 py-1 tabular-nums whitespace-nowrap",
                                dayOfWeek === 0 && "text-red-500",
                                dayOfWeek === 6 && "text-blue-500",
                              )}
                            >
                              {format(d, "M/d(E)", { locale: ja })}
                            </td>
                            <td className="px-2 py-1 text-muted-foreground">{statusLabel}</td>
                            <td className="px-2 py-1 text-right">
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                value={orderValue}
                                placeholder="—"
                                disabled={savingOrderDayId === day.id}
                                onChange={(e) =>
                                  setDayOrderEdits((prev) => ({
                                    ...prev,
                                    [day.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => {
                                  if (editingOrder === undefined) return;
                                  saveDayOrder(day, editingOrder);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="h-7 text-xs text-right w-16 ml-auto"
                              />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={100}
                                value={rateValue}
                                placeholder={ratePlaceholder}
                                disabled={savingRateDayId === day.id}
                                onChange={(e) =>
                                  setDayRateEdits((prev) => ({
                                    ...prev,
                                    [day.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => {
                                  if (editingRate === undefined) return;
                                  saveDayRate(day, editingRate);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="h-7 text-xs text-right w-24 ml-auto"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  単価 空欄 = 上の「現場別日給」（無ければスタッフ基本日当）/ オーダー人数は現場から指示された必要人数
                </p>
              </div>
            )}

            </div>
          </>
        ) : (
          <>
            {/* 左カラム: スタッフ選択 (新規作成) */}
            <div>
              <MultiStaffPicker
                allStaff={allStaff}
                filteredStaffList={filteredStaffList}
                selectedIds={selectedStaffIds}
                onToggle={toggleStaff}
                onClearAll={() => setSelectedStaffIds([])}
                staffSearch={staffSearch}
                setStaffSearch={setStaffSearch}
                hasAnyRequirement={hasAnyRequirement}
                filterByRequirements={filterByRequirements}
                setFilterByRequirements={setFilterByRequirements}
              />
            </div>

            {/* 右カラム: 現場・日程・詳細・手当・警告 */}
            <div className="space-y-4 min-w-0">

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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" /> オーダー人数（初期値）
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="例: 5"
                  value={form.orderHeadcount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, orderHeadcount: e.target.value }))
                  }
                  className="text-xs h-9"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  現場から指示された必要人数。日毎の調整は作成後に編集画面で行えます
                </p>
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
                  placeholder="空欄=スタッフ基本日当"
                  value={form.dailyRateOverride}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dailyRateOverride: e.target.value }))
                  }
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                持ち物
              </Label>
              <Textarea
                value={form.belongings}
                onChange={(e) =>
                  setForm((p) => ({ ...p, belongings: e.target.value }))
                }
                rows={2}
                placeholder="ヘルメット、安全靴、手袋 …（現場マスタから自動 prefill）"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5">担当者</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                  className="text-xs h-9"
                  placeholder="現場担当者"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5">電話番号</Label>
                <Input
                  value={form.contactTel}
                  onChange={(e) => setForm((p) => ({ ...p, contactTel: e.target.value }))}
                  className="text-xs h-9"
                  placeholder="090-..."
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5">交通手段</Label>
              <Input
                value={form.transportation}
                onChange={(e) => setForm((p) => ({ ...p, transportation: e.target.value }))}
                className="text-xs h-9"
                placeholder="例: 自家用車、電車、現場集合（現場マスタから自動 prefill）"
              />
            </div>

            {/* 加算手当（路内・出張・とび・食事 等） */}
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" /> 加算手当
              </Label>
              <AllowanceList
                allowances={allowances}
                selectedStaffIds={selectedStaffIds}
                allStaff={allStaff}
                openTargetIdx={openTargetIdx}
                setOpenTargetIdx={setOpenTargetIdx}
                updateAllowance={updateAllowance}
                removeAllowance={removeAllowance}
                toggleAllowanceTarget={toggleAllowanceTarget}
              />
              <div className="flex flex-wrap gap-1">
                {ALLOWANCE_PRESETS.map((p) => (
                  <Button
                    key={p.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => addAllowance(p)}
                  >
                    + {p.name}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => addAllowance()}
                >
                  + 自由入力
                </Button>
              </div>
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

            {/* 事前断りトグル & 配置完了後ページへ */}
            <PreDeclineSection
              existingAssignment={existingAssignment}
              displayAssignment={displayAssignment}
              loading={loading}
              onToggle={handleTogglePreDeclined}
            />


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
                {vehicleConflicts.length > 0 && (
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-orange-700 font-medium text-xs">
                      <Truck className="h-3.5 w-3.5" />
                      車両の二重利用
                    </div>
                    {vehicleConflicts.map((vc, i) => (
                      <div key={i} className="text-[11px] text-orange-700">
                        <span className="font-medium font-mono">{vc.plateNumber}</span>
                        {vc.vehicleName && <span className="text-orange-600">（{vc.vehicleName}）</span>}
                        は <span className="font-medium">{vc.conflictingSiteName}</span> で {vc.dates.length}日間 使用中
                      </div>
                    ))}
                  </div>
                )}
                {orderHeadcountWarnings.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-medium text-xs">
                      <Users className="h-3.5 w-3.5" />
                      オーダー人数 超過
                    </div>
                    {orderHeadcountWarnings.map((w) => (
                      <div key={w.date} className="text-[11px] text-rose-700 tabular-nums">
                        {w.date}: 発注 <span className="font-medium">{w.orderHeadcount}名</span> に対し
                        配置 <span className="font-medium">{w.projectedCount}名</span>
                        （+{w.overflow}名 過剰）
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            </div>
          </>
        )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-muted/20 flex gap-2 rounded-b-xl">
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
                  setVehicleConflicts([]);
                  setOrderHeadcountWarnings([]);
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
                  isUnassignedEdit && selectedStaffIds.length > 0 && "bg-emerald-600 hover:bg-emerald-700",
                )}
                size="sm"
              >
                {(() => {
                  if (loading) return "更新中...";
                  const additional = selectedStaffIds.length - 1; // 先頭は既存編集分
                  if (selectedStaffIds.length === 0) {
                    return isUnassignedEdit ? "未割当のまま保存" : "未割当に変更して保存";
                  }
                  if (additional <= 0) {
                    return isUnassignedEdit ? "スタッフを割当て保存" : "更新する";
                  }
                  return `更新 + ${additional}名を追加配置`;
                })()}
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
                setVehicleConflicts([]);
                setOrderHeadcountWarnings([]);
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
              selectedStaffIds.length === 0 && "bg-amber-600 hover:bg-amber-700",
            )}
            size="sm"
          >
            {loading
              ? "作成中..."
              : selectedStaffIds.length === 0
                ? "未割当のまま作成"
                : selectedStaffIds.length >= 2
                  ? `${selectedStaffIds.length}名を配置`
                  : "配置を作成"}
          </Button>
        )}
      </div>
    </div>
  );
}
