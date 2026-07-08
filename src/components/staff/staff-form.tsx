"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StaffDocuments } from "./staff-documents";
import { toast } from "sonner";

type BranchOffice = { id: number; name: string };
type Qualification = { id: number; name: string; category: string | null };
type StaffData = {
  id?: number;
  employeeCode: string;
  name: string;
  nameKana: string;
  displayName: string | null;
  phone: string | null;
  branchOfficeId: number;
  insuranceType: string; // [DEPRECATED] 互換用
  hasShaho?: boolean;
  hasKokuho?: boolean;
  hasIchiriOyakata?: boolean;
  canChikuro?: boolean;
  canRegular?: boolean;
  canSpot?: boolean;
  residenceType?: string;
  role: string;
  dailyRate: number | null;
  licenseExpiry: string | null;
  notes: string | null;
  staffQualifications?: { qualification: { id: number } }[];
};

export function StaffForm({
  staff,
  branchOffices,
  qualifications,
  readOnly = false,
}: {
  staff?: StaffData;
  branchOffices: BranchOffice[];
  qualifications: Qualification[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const isEdit = !!staff?.id;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    employeeCode: staff?.employeeCode || "",
    name: staff?.name || "",
    nameKana: staff?.nameKana || "",
    displayName: staff?.displayName || "",
    phone: staff?.phone || "",
    branchOfficeId: staff?.branchOfficeId || branchOffices[0]?.id || 1,
    insuranceType: staff?.insuranceType || "company",
    hasShaho: staff?.hasShaho ?? false,
    hasKokuho: staff?.hasKokuho ?? false,
    hasIchiriOyakata: staff?.hasIchiriOyakata ?? false,
    canChikuro: staff?.canChikuro ?? true,
    canRegular: staff?.canRegular ?? true,
    canSpot: staff?.canSpot ?? true,
    residenceType: staff?.residenceType || "commuter",
    role: staff?.role || "worker",
    dailyRate: staff?.dailyRate || 15000,
    licenseExpiry: staff?.licenseExpiry || "",
    notes: staff?.notes || "",
  });

  const [selectedQuals, setSelectedQuals] = useState<number[]>(
    staff?.staffQualifications?.map((sq) => sq.qualification.id) || []
  );

  function update(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit ? `/api/staff/${staff!.id}` : "/api/staff";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dailyRate: Number(form.dailyRate),
          qualificationIds: selectedQuals,
        }),
      });

      if (res.ok) {
        toast.success(isEdit ? "スタッフを更新しました" : "スタッフを登録しました");
        router.push("/staff");
        router.refresh();
      } else {
        toast.error("保存に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit}>
      <fieldset disabled={readOnly} className="bg-card rounded-xl border shadow-sm p-4 md:p-6 max-w-2xl space-y-6 disabled:opacity-90">
      {readOnly ? (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          閲覧モード（編集には管理者権限が必要です）
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <RequiredMark />{" "}印がついた項目は必ず入力してください。
        </p>
      )}
      <div className="form-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">基本情報</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>社員コード <RequiredMark /></Label>
              <Input
                value={form.employeeCode}
                onChange={(e) => update("employeeCode", e.target.value)}
                placeholder="M001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>営業所 <RequiredMark /></Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.branchOfficeId}
                onChange={(e) => update("branchOfficeId", parseInt(e.target.value))}
              >
                {branchOffices.map((bo) => (
                  <option key={bo.id} value={bo.id}>
                    {bo.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>氏名 <RequiredMark /></Label>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="田中 太郎"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>フリガナ <RequiredMark /></Label>
              <Input
                value={form.nameKana}
                onChange={(e) => update("nameKana", e.target.value)}
                placeholder="タナカ タロウ"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>表示名</Label>
              <Input
                value={form.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                placeholder="田中"
              />
            </div>
            <div className="space-y-2">
              <Label>電話番号</Label>
              <Input
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="090-1234-5678"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>保険・所属（複数選択可）</Label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 h-10 px-1">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasShaho}
                    onChange={(e) => update("hasShaho", e.target.checked)}
                    className="h-4 w-4"
                  />
                  社保
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasKokuho}
                    onChange={(e) => update("hasKokuho", e.target.checked)}
                    className="h-4 w-4"
                  />
                  国保
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasIchiriOyakata}
                    onChange={(e) => update("hasIchiriOyakata", e.target.checked)}
                    className="h-4 w-4"
                  />
                  一人親方
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>役割</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
              >
                <option value="worker">作業員</option>
                <option value="manager">所長</option>
                <option value="office">事務</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>基本日当（円）</Label>
              <Input
                type="number"
                value={form.dailyRate}
                onChange={(e) => update("dailyRate", e.target.value)}
                placeholder="15000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>対応可能な作業区分（配置時の絞り込みに使用）</Label>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.canChikuro}
                  onChange={(e) => update("canChikuro", e.target.checked)}
                  className="h-4 w-4"
                />
                築炉
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.canRegular}
                  onChange={(e) => update("canRegular", e.target.checked)}
                  className="h-4 w-4"
                />
                レギュラー
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.canSpot}
                  onChange={(e) => update("canSpot", e.target.checked)}
                  className="h-4 w-4"
                />
                スポット
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              チェックを外すと、その作業区分の現場へ配置するとき警告が出ます（既定は全て対応可）。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>寮区分</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.residenceType}
                onChange={(e) => update("residenceType", e.target.value)}
              >
                <option value="dorm1">旧寮 (1日 1,950円 自己負担)</option>
                <option value="dorm2">新寮 (1日 1,350円 自己負担)</option>
                <option value="commuter">通い (0円)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                日計表の宿泊欄に出勤日数 × 単価が自動加算されます。
              </p>
            </div>
            <div className="space-y-2">
              <Label>免許期限</Label>
              <Input
                type="date"
                value={form.licenseExpiry}
                onChange={(e) => update("licenseExpiry", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">保有資格</h2>
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {qualifications.map((q) => (
              <label
                key={q.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={selectedQuals.includes(q.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedQuals((prev) => [...prev, q.id]);
                    } else {
                      setSelectedQuals((prev) => prev.filter((id) => id !== q.id));
                    }
                  }}
                />
                <span className="text-sm">{q.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">免許証・書類</h2>
        {isEdit && staff?.id ? (
          <StaffDocuments staffId={staff.id} canEdit={!readOnly} />
        ) : (
          <p className="text-sm text-muted-foreground">
            スタッフを登録すると、免許証などの画像・PDF を添付できます。
          </p>
        )}
      </div>

      <div className="flex gap-3">
        {!readOnly && (
          <Button type="submit" disabled={loading} size="lg">
            {loading ? "保存中..." : isEdit ? "更新する" : "登録する"}
          </Button>
        )}
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          {readOnly ? "戻る" : "キャンセル"}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
