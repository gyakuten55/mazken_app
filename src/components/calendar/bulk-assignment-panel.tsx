"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, MapPin, Clock, Sun, Moon, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ASSIGNMENT_TYPES } from "@/lib/constants";
import { SiteSelect } from "@/components/sites/site-select";

type JobSite = {
  id: number;
  name: string;
  siteCode: string;
  branchOffice: { color: string; name: string };
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
  }>({
    jobSiteId: 0,
    vehicleId: null,
    startDate: date || "",
    endDate: endDateProp || date || "",
    assignmentType: "commute",
    shiftType: "day",
    startTime: "08:00",
    endTime: "18:00",
  });

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
      const res = await fetch("/api/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffIds: selectedStaff.map((s) => s.id),
          ...form,
          vehicleId: form.vehicleId ?? null,
        }),
      });
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
    <div className="w-full sm:max-w-sm h-full bg-card border-l shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Selected staff */}
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">選択中のスタッフ</Label>
          <div className="flex flex-wrap gap-1.5">
            {selectedStaff.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-xs"
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
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-muted/20">
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
