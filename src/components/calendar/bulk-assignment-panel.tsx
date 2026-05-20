"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, MapPin, Clock, Sun, Moon, Truck, Coins, StickyNote, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ASSIGNMENT_TYPES, ALLOWANCE_PRESETS, ALLOWANCE_CATEGORIES } from "@/lib/constants";
import { SiteSelect } from "@/components/sites/site-select";

type AllowanceInput = {
  name: string;
  amount: number;
  category: "special" | "other";
  // 空配列 = 全員に適用。それ以外 = 指定スタッフだけに適用。
  targetStaffIds: number[];
};

type JobSite = {
  id: number;
  name: string;
  siteCode: string;
  branchOffice: { color: string; name: string };
  // 現場マスタからの自動 prefill 用
  belongings?: string | null;
  transportation?: string | null;
  contactName1?: string | null;
  contactTel1?: string | null;
};

type SelectedStaff = {
  id: number;
  name: string;
  branchColor: string;
};

type VehicleInfo = {
  id: number;
  plateNumber: string;
  name: string | null;
  isActive: boolean;
};

export function BulkAssignmentPanel({
  selectedStaff,
  date,
  endDate: endDateProp,
  onClose,
  onSaved,
}: {
  selectedStaff: SelectedStaff[];
  date: string;
  endDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sites, setSites] = useState<JobSite[]>([]);
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([]);
  const [loading, setLoading] = useState(false);

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
    jobSiteId: 0,
    vehicleId: null,
    startDate: date || "",
    endDate: endDateProp || date || "",
    assignmentType: "commute",
    shiftType: "day",
    startTime: "08:00",
    endTime: "18:00",
    dailyRateOverride: "",
    orderHeadcount: "",
    belongings: "",
    contactName: "",
    contactTel: "",
    transportation: "",
    notes: "",
  });

  const [allowances, setAllowances] = useState<AllowanceInput[]>([]);
  // 対象選択 UI を開いている手当の index
  const [openTargetIdx, setOpenTargetIdx] = useState<number | null>(null);
  const addAllowance = (preset?: { name: string; defaultAmount: number; category: "special" | "other" }) => {
    setAllowances((prev) => [
      ...prev,
      preset
        ? { name: preset.name, amount: preset.defaultAmount, category: preset.category, targetStaffIds: [] }
        : { name: "", amount: 0, category: "other", targetStaffIds: [] },
    ]);
  };
  const removeAllowance = (idx: number) => {
    setAllowances((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateAllowance = (idx: number, patch: Partial<AllowanceInput>) => {
    setAllowances((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };
  // 対象スタッフのトグル。チェックを外す＝そのスタッフだけ除外する形にする
  const toggleAllowanceTarget = (idx: number, staffId: number) => {
    setAllowances((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const currentTargets = a.targetStaffIds.length > 0
          ? a.targetStaffIds
          : selectedStaff.map((s) => s.id); // 空 = 全員 を実体化
        const next = currentTargets.includes(staffId)
          ? currentTargets.filter((id) => id !== staffId)
          : [...currentTargets, staffId];
        // 全員選択中なら空配列に戻して「全員適用」表現に統一
        const allIds = selectedStaff.map((s) => s.id);
        const isAll = allIds.every((id) => next.includes(id)) && next.length === allIds.length;
        return { ...a, targetStaffIds: isAll ? [] : next };
      })
    );
  };

  // 現場が変わったら、現場マスタの belongings/transportation/担当者 を空欄に自動 prefill
  useEffect(() => {
    if (!form.jobSiteId) return;
    const site = sites.find((s) => s.id === form.jobSiteId);
    if (!site) return;
    setForm((p) => ({
      ...p,
      belongings: p.belongings || site.belongings || "",
      transportation: p.transportation || site.transportation || "",
      contactName: p.contactName || site.contactName1 || "",
      contactTel: p.contactTel || site.contactTel1 || "",
    }));
  }, [form.jobSiteId, sites]);

  useEffect(() => {
    fetch("/api/sites?status=active")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setSites(data);
      })
      .catch(() => toast.error("現場データの取得に失敗しました"));

    fetch("/api/vehicles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setVehicles(data.filter((v: VehicleInfo) => v.isActive));
      })
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!form.jobSiteId || !form.startDate || !form.endDate) {
      toast.error("現場と日付を選択してください");
      return;
    }
    setLoading(true);
    try {
      const cleanAllowances = allowances
        .filter((a) => a.name.trim() && a.amount > 0)
        .map((a) => ({
          name: a.name.trim(),
          amount: a.amount,
          category: a.category,
          // 全員適用は targetStaffIds 省略で送信（API は空/未指定を「全員」と解釈）
          ...(a.targetStaffIds.length > 0 ? { targetStaffIds: a.targetStaffIds } : {}),
        }));
      const dailyRate = form.dailyRateOverride.trim() ? Math.max(0, Math.floor(Number(form.dailyRateOverride) || 0)) : null;
      const orderNum = form.orderHeadcount.trim() ? Math.max(0, Math.floor(Number(form.orderHeadcount) || 0)) : null;
      const res = await fetch("/api/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffIds: selectedStaff.map((s) => s.id),
          ...form,
          vehicleId: form.vehicleId ?? null,
          dailyRateOverride: dailyRate,
          orderHeadcount: orderNum,
          belongings: form.belongings || null,
          contactName: form.contactName || null,
          contactTel: form.contactTel || null,
          transportation: form.transportation || null,
          notes: form.notes || null,
          allowances: cleanAllowances,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        const warnings: string[] = [];
        if (Array.isArray(data.conflicts) && data.conflicts.length > 0) {
          warnings.push(`重複: ${data.conflicts.length}件`);
        }
        if (data.insuranceWarning) warnings.push("保険種別ミスマッチあり");
        if (Array.isArray(data.vehicleConflicts) && data.vehicleConflicts.length > 0) {
          warnings.push(`車両重複: ${data.vehicleConflicts.length}件`);
        }
        if (
          Array.isArray(data.orderHeadcountWarnings) &&
          data.orderHeadcountWarnings.length > 0
        ) {
          const first = data.orderHeadcountWarnings[0];
          warnings.push(
            `オーダー人数 超過: ${first.date} ほか${data.orderHeadcountWarnings.length}日（発注${first.orderHeadcount}に対し${first.projectedCount}名）`,
          );
        }
        toast.warning(`警告: ${warnings.join(" / ") || "保存できません"}（個別画面で確認してください）`);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.created}名の配置を作成しました`);
        if (data.conflicts && data.conflicts.length > 0) {
          data.conflicts.forEach((c: { staffName: string; sites: string[] }) => {
            toast.warning(`${c.staffName}: ${c.sites.join(", ")} と重複あり`);
          });
        }
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

  return (
    <div className="w-full bg-card rounded-xl border shadow-2xl flex flex-col max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 rounded-t-xl">
        <div>
          <h3 className="font-bold text-base">一括配置</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedStaff.length}名を配置
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content — 横長: 左 (スタッフリスト・現場) / 右 (日程・時間・車両) */}
      <div className="flex-1 overflow-auto p-4 md:p-5">
        <div className="md:grid md:grid-cols-[minmax(0,360px)_1fr] md:gap-5 space-y-4 md:space-y-0">

        {/* 左カラム */}
        <div className="space-y-4 min-w-0">

        {/* Selected staff */}
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">選択中のスタッフ ({selectedStaff.length}名)</Label>
          <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-auto p-2 rounded-md border bg-muted/20">
            {selectedStaff.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-card border text-xs"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: s.branchColor }}
                />
                {s.name}
              </div>
            ))}
          </div>
        </div>

        {/* Site select */}
        <div>
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
            <MapPin className="h-3 w-3" /> 現場 *
          </Label>
          <SiteSelect
            sites={sites}
            value={form.jobSiteId}
            onChange={(id) => setForm((p) => ({ ...p, jobSiteId: id }))}
            autoFocus
          />
        </div>

        </div>

        {/* 右カラム */}
        <div className="space-y-4 min-w-0">

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">開始日 *</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              className="text-xs h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">終了日 *</Label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              className="text-xs h-9"
            />
          </div>
        </div>

        {/* Assignment type + shift */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1.5 block">区分</Label>
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={cn(
                  "flex-1 py-2 text-xs font-medium transition-colors",
                  form.assignmentType === "commute"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
                onClick={() => setForm((p) => ({ ...p, assignmentType: "commute" }))}
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
                onClick={() => setForm((p) => ({ ...p, assignmentType: "business_trip" }))}
              >
                {ASSIGNMENT_TYPES.business_trip}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1.5 block">シフト</Label>
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={cn(
                  "flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1",
                  form.shiftType === "day"
                    ? "bg-amber-500 text-white"
                    : "hover:bg-muted"
                )}
                onClick={() => setForm((p) => ({ ...p, shiftType: "day" }))}
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
                onClick={() => setForm((p) => ({ ...p, shiftType: "night" }))}
              >
                <Moon className="h-3 w-3" /> 夜勤
              </button>
            </div>
          </div>
        </div>

        {/* Time */}
        <div>
          <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <Clock className="h-3 w-3" /> 時間
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
              className="text-xs h-9"
            />
            <span className="text-muted-foreground text-sm">~</span>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
              className="text-xs h-9"
            />
          </div>
        </div>

        {/* Vehicle */}
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
          {/* オーダー人数 */}
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
              <Users className="h-3 w-3" /> オーダー人数
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="例: 5"
              value={form.orderHeadcount}
              onChange={(e) => setForm((p) => ({ ...p, orderHeadcount: e.target.value }))}
              className="text-xs h-9"
            />
          </div>
          {/* 現場別日給 (上書き) */}
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
              onChange={(e) => setForm((p) => ({ ...p, dailyRateOverride: e.target.value }))}
              className="text-xs h-9"
            />
          </div>
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
          {allowances.map((a, idx) => {
            const isAll = a.targetStaffIds.length === 0;
            const targetCount = isAll ? selectedStaff.length : a.targetStaffIds.length;
            const isOpen = openTargetIdx === idx;
            return (
              <div key={idx} className="space-y-1.5 rounded-md border border-border/60 p-2">
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
                {/* 対象スタッフ */}
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setOpenTargetIdx(isOpen ? null : idx)}
                    className={cn(
                      "px-2 py-0.5 rounded border text-[10px] font-medium",
                      isAll ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary border-primary/30"
                    )}
                  >
                    対象: {isAll ? `全員 (${targetCount}名)` : `${targetCount} / ${selectedStaff.length}名`} {isOpen ? "▲" : "▼"}
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
                    {selectedStaff.map((s) => {
                      const checked = isAll || a.targetStaffIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-1 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAllowanceTarget(idx, s.id)}
                          />
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: s.branchColor }}
                          />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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

        {/* 備考 */}
        <div>
          <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <StickyNote className="h-3 w-3" /> 備考
          </Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            placeholder="この配置に関する注意点など"
            className="text-xs"
          />
        </div>

        </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-muted/20 rounded-b-xl">
        <Button
          onClick={handleCreate}
          disabled={loading || !form.jobSiteId}
          className="w-full h-9"
          size="sm"
        >
          {loading ? "作成中..." : `${selectedStaff.length}名を一括配置`}
        </Button>
      </div>
    </div>
  );
}
