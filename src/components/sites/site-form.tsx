"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { WORK_CATEGORIES } from "@/lib/constants";

type BranchOffice = { id: number; name: string };
type Qualification = { id: number; name: string };
type QualificationBonus = {
  qualificationId: number;
  bonusAmount: number;
  qualification?: { id: number; name: string };
};
type SiteData = {
  id?: number;
  siteCode: string;
  name: string;
  clientName: string | null;
  branchOfficeId: number;
  address: string | null;
  contactName1: string | null;
  contactTel1: string | null;
  contactName2: string | null;
  contactTel2: string | null;
  transportation: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  workCategory?: string;
  requiredHeadcount?: number | null;
  notes: string | null;
  qualificationBonuses?: QualificationBonus[];
};

export function SiteForm({
  site,
  branchOffices,
  qualifications = [],
}: {
  site?: SiteData;
  branchOffices: BranchOffice[];
  qualifications?: Qualification[];
}) {
  const router = useRouter();
  const isEdit = !!site?.id;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    siteCode: site?.siteCode || "",
    name: site?.name || "",
    clientName: site?.clientName || "",
    branchOfficeId: site?.branchOfficeId || branchOffices[0]?.id || 1,
    address: site?.address || "",
    contactName1: site?.contactName1 || "",
    contactTel1: site?.contactTel1 || "",
    contactName2: site?.contactName2 || "",
    contactTel2: site?.contactTel2 || "",
    transportation: site?.transportation || "",
    startDate: site?.startDate || "",
    endDate: site?.endDate || "",
    status: site?.status || "active",
    workCategory: site?.workCategory || "spot",
    requiredHeadcount:
      site?.requiredHeadcount != null ? String(site.requiredHeadcount) : "",
    notes: site?.notes || "",
  });

  const [qualBonuses, setQualBonuses] = useState<{ qualificationId: number; bonusAmount: string }[]>(
    site?.qualificationBonuses?.map((qb) => ({
      qualificationId: qb.qualificationId,
      bonusAmount: String(qb.bonusAmount),
    })) || []
  );

  function addQualBonus() {
    const used = new Set(qualBonuses.map((b) => b.qualificationId));
    const next = qualifications.find((q) => !used.has(q.id));
    if (!next) return;
    setQualBonuses((prev) => [...prev, { qualificationId: next.id, bonusAmount: "0" }]);
  }
  function removeQualBonus(idx: number) {
    setQualBonuses((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateQualBonus(idx: number, key: "qualificationId" | "bonusAmount", value: string | number) {
    setQualBonuses((prev) => prev.map((b, i) => (i === idx ? { ...b, [key]: value } : b)));
  }

  function update(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit ? `/api/sites/${site!.id}` : "/api/sites";
      const method = isEdit ? "PUT" : "POST";

      const requiredHeadcount = form.requiredHeadcount.trim()
        ? Math.max(0, Math.floor(Number(form.requiredHeadcount)))
        : null;
      const qualificationBonuses = qualBonuses
        .filter((b) => b.qualificationId > 0)
        .map((b) => ({
          qualificationId: b.qualificationId,
          bonusAmount: Math.max(0, Math.floor(Number(b.bonusAmount) || 0)),
        }));
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, requiredHeadcount, qualificationBonuses }),
      });

      if (res.ok) {
        toast.success(isEdit ? "現場を更新しました" : "現場を登録しました");
        router.push("/sites");
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
    <form onSubmit={handleSubmit}>
      <div className="bg-card rounded-xl border shadow-sm p-4 md:p-6 max-w-2xl space-y-6">
      <div className="form-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">基本情報</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>現場コード <RequiredMark /></Label>
              <Input value={form.siteCode} onChange={(e) => update("siteCode", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>担当営業所 <RequiredMark /></Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.branchOfficeId}
                onChange={(e) => update("branchOfficeId", parseInt(e.target.value))}
              >
                {branchOffices.map((bo) => (
                  <option key={bo.id} value={bo.id}>{bo.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>現場名 *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>元請け会社名</Label>
              <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>住所</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>開始日</Label>
              <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>終了日</Label>
              <Input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>交通手段</Label>
              <Input value={form.transportation} onChange={(e) => update("transportation", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>作業区分</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.workCategory}
                onChange={(e) => update("workCategory", e.target.value)}
              >
                {Object.entries(WORK_CATEGORIES).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label>状態</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="active">進行中</option>
                <option value="completed">完了</option>
                <option value="cancelled">中止</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="form-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">連絡先</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>先方担当者名1</Label>
              <Input value={form.contactName1} onChange={(e) => update("contactName1", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>TEL1</Label>
              <Input value={form.contactTel1} onChange={(e) => update("contactTel1", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>先方担当者名2</Label>
              <Input value={form.contactName2} onChange={(e) => update("contactName2", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>TEL2</Label>
              <Input value={form.contactTel2} onChange={(e) => update("contactTel2", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">特殊技能料金（資格保有者への加算額）</h2>
        <div className="space-y-2">
          {qualifications.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              資格マスタが空です。先にスタッフ管理の資格マスタを登録してください。
            </p>
          ) : qualBonuses.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              設定なし。「＋ 資格を追加」で資格と加算額を設定できます（資格 {qualifications.length} 件登録済み）。
            </p>
          ) : null}
          {qualBonuses.map((b, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={b.qualificationId}
                onChange={(e) => updateQualBonus(idx, "qualificationId", Number(e.target.value))}
              >
                {qualifications.map((q) => (
                  <option key={q.id} value={q.id}>{q.name}</option>
                ))}
              </select>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={b.bonusAmount}
                onChange={(e) => updateQualBonus(idx, "bonusAmount", e.target.value)}
                className="w-32 h-9"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">円/日</span>
              <Button type="button" variant="outline" size="sm" onClick={() => removeQualBonus(idx)}>
                削除
              </Button>
            </div>
          ))}
          {qualifications.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addQualBonus}
              disabled={qualBonuses.length >= qualifications.length}
            >
              ＋ 資格を追加
            </Button>
          )}
        </div>
      </div>

      <div className="form-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">備考</h2>
        <div>
          <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading} size="lg">
          {loading ? "保存中..." : isEdit ? "更新する" : "登録する"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>キャンセル</Button>
      </div>
      </div>
    </form>
  );
}
