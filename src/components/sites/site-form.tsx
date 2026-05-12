"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { WORK_CATEGORIES, WORKER_PRICING_POLICIES } from "@/lib/constants";

type BranchOffice = { id: number; name: string };
type Qualification = { id: number; name: string };
type Customer = {
  id: number;
  code: string | null;
  name: string;
};
type QualificationBonus = {
  qualificationId: number;
  bonusAmount: number;
  isRequired?: boolean;
  qualification?: { id: number; name: string };
};
type SiteData = {
  id?: number;
  siteCode: string;
  name: string;
  customerId?: number | null;
  clientCode?: string | null;
  clientName: string | null;
  branchOfficeId: number;
  address: string | null;
  mapUrl?: string | null;
  contactName1: string | null;
  contactTel1: string | null;
  contactName2: string | null;
  contactTel2: string | null;
  contactName3?: string | null;
  contactTel3?: string | null;
  transportation: string | null;
  belongings?: string | null;
  siteMemo?: string | null;
  genDoMen?: string | null;
  workerPricingPolicy?: string;
  dailyRateDorm1?: number | null;
  dailyRateDorm2?: number | null;
  dailyRateCommuter?: number | null;
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
  customers = [],
  readOnly = false,
}: {
  site?: SiteData;
  branchOffices: BranchOffice[];
  qualifications?: Qualification[];
  customers?: Customer[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const isEdit = !!site?.id;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    siteCode: site?.siteCode || "",
    name: site?.name || "",
    customerId: site?.customerId ?? null,
    branchOfficeId: site?.branchOfficeId || branchOffices[0]?.id || 1,
    address: site?.address || "",
    mapUrl: site?.mapUrl || "",
    contactName1: site?.contactName1 || "",
    contactTel1: site?.contactTel1 || "",
    contactName2: site?.contactName2 || "",
    contactTel2: site?.contactTel2 || "",
    contactName3: site?.contactName3 || "",
    contactTel3: site?.contactTel3 || "",
    transportation: site?.transportation || "",
    belongings: site?.belongings || "",
    siteMemo: site?.siteMemo || "",
    genDoMen: site?.genDoMen || "",
    workerPricingPolicy: site?.workerPricingPolicy || "possible",
    dailyRateDorm1: site?.dailyRateDorm1 != null ? String(site.dailyRateDorm1) : "",
    dailyRateDorm2: site?.dailyRateDorm2 != null ? String(site.dailyRateDorm2) : "",
    dailyRateCommuter: site?.dailyRateCommuter != null ? String(site.dailyRateCommuter) : "",
    startDate: site?.startDate || "",
    endDate: site?.endDate || "",
    status: site?.status || "active",
    workCategory: site?.workCategory || "spot",
    requiredHeadcount:
      site?.requiredHeadcount != null ? String(site.requiredHeadcount) : "",
    notes: site?.notes || "",
  });

  const [qualBonuses, setQualBonuses] = useState<
    { qualificationId: number; bonusAmount: string; isRequired: boolean }[]
  >(
    site?.qualificationBonuses?.map((qb) => ({
      qualificationId: qb.qualificationId,
      bonusAmount: String(qb.bonusAmount),
      isRequired: !!qb.isRequired,
    })) || []
  );

  function addQualBonus() {
    const used = new Set(qualBonuses.map((b) => b.qualificationId));
    const next = qualifications.find((q) => !used.has(q.id));
    if (!next) return;
    setQualBonuses((prev) => [
      ...prev,
      { qualificationId: next.id, bonusAmount: "0", isRequired: false },
    ]);
  }
  function removeQualBonus(idx: number) {
    setQualBonuses((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateQualBonus(
    idx: number,
    key: "qualificationId" | "bonusAmount" | "isRequired",
    value: string | number | boolean
  ) {
    setQualBonuses((prev) => prev.map((b, i) => (i === idx ? { ...b, [key]: value } : b)));
  }

  function update(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function nullableInt(v: string): number | null {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Math.floor(Number(trimmed));
    if (isNaN(n) || n < 0) return null;
    return n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit ? `/api/sites/${site!.id}` : "/api/sites";
      const method = isEdit ? "PUT" : "POST";

      const requiredHeadcount = nullableInt(form.requiredHeadcount);
      const dailyRateDorm1 = nullableInt(form.dailyRateDorm1);
      const dailyRateDorm2 = nullableInt(form.dailyRateDorm2);
      const dailyRateCommuter = nullableInt(form.dailyRateCommuter);

      const qualificationBonuses = qualBonuses
        .filter((b) => b.qualificationId > 0)
        .map((b) => ({
          qualificationId: b.qualificationId,
          bonusAmount: Math.max(0, Math.floor(Number(b.bonusAmount) || 0)),
          isRequired: !!b.isRequired,
        }));

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requiredHeadcount,
          dailyRateDorm1,
          dailyRateDorm2,
          dailyRateCommuter,
          qualificationBonuses,
        }),
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
    <form onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit}>
      <fieldset disabled={readOnly} className="bg-card rounded-xl border shadow-sm p-4 md:p-6 max-w-2xl space-y-6 disabled:opacity-90">
      {readOnly && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          閲覧モード（編集には管理者権限が必要です）
        </div>
      )}
        <div className="form-section">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            基本情報
          </h2>
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

            <div className="space-y-2">
              <Label>現場名 <RequiredMark /></Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>得意先 <RequiredMark /></Label>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.customerId ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      customerId: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">— 得意先を選択 —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `[${c.code}] ` : ""}{c.name}
                    </option>
                  ))}
                </select>
                <Link
                  href="/customers/new"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                  title="新しい得意先を別タブで登録"
                >
                  <Plus className="h-3 w-3" />
                  新規作成
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                得意先（親）→ 現場（子）の階層。日経表・印刷で得意先名と現場名がそれぞれ別列で出ます。
              </p>
            </div>

            <div className="space-y-2">
              <Label>住所</Label>
              <Input
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="例: 大阪府大阪市北区梅田1-2-3"
              />
              <p className="text-xs text-muted-foreground">
                配置のモーダルでこの住所から Google マップが自動表示されます。
              </p>
            </div>

            <div className="space-y-2">
              <Label>Google マップ URL（任意）</Label>
              <Input
                value={form.mapUrl}
                onChange={(e) => update("mapUrl", e.target.value)}
                placeholder="例: https://www.google.com/maps/place/.../@34.7024,135.4959,18z/..."
              />
              <p className="text-xs text-muted-foreground">
                住所だけだと位置がズレる場合、Google マップで現場を表示 → 共有 → リンクをコピーして貼り付けてください。座標（@緯度,経度）入りの URL ならその位置にピン留めされます。
              </p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>必要人数（注文集計用）</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.requiredHeadcount}
                  onChange={(e) => update("requiredHeadcount", e.target.value)}
                  placeholder="例: 5"
                />
              </div>
              <div className="space-y-2">
                <Label>作業員ごとの単価請求</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.workerPricingPolicy}
                  onChange={(e) => update("workerPricingPolicy", e.target.value)}
                >
                  {Object.entries(WORKER_PRICING_POLICIES).map(([k, label]) => (
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            現場詳細（配置作成時に prefill されます）
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>持ち物</Label>
              <Textarea
                value={form.belongings}
                onChange={(e) => update("belongings", e.target.value)}
                rows={2}
                placeholder="ヘルメット、安全靴、手袋 …"
              />
            </div>
            <div className="space-y-2">
              <Label>現場メモ</Label>
              <Textarea
                value={form.siteMemo}
                onChange={(e) => update("siteMemo", e.target.value)}
                rows={2}
                placeholder="集合場所・入構手順・注意事項など"
              />
            </div>
            <div className="space-y-2">
              <Label>原動面</Label>
              <Textarea
                value={form.genDoMen}
                onChange={(e) => update("genDoMen", e.target.value)}
                rows={2}
                placeholder="原動面情報（特殊作業時の参考メモ）"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            現場別日給（寮区分ごとに上書き）
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            空欄ならスタッフ基本日給を使用。配置側でさらに個別上書き可能。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>旧寮 居住者</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={form.dailyRateDorm1}
                onChange={(e) => update("dailyRateDorm1", e.target.value)}
                placeholder="円/日"
              />
            </div>
            <div className="space-y-2">
              <Label>新寮 居住者</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={form.dailyRateDorm2}
                onChange={(e) => update("dailyRateDorm2", e.target.value)}
                placeholder="円/日"
              />
            </div>
            <div className="space-y-2">
              <Label>通い</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={form.dailyRateCommuter}
                onChange={(e) => update("dailyRateCommuter", e.target.value)}
                placeholder="円/日"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            連絡先
          </h2>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>先方担当者名3</Label>
                <Input value={form.contactName3} onChange={(e) => update("contactName3", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>TEL3</Label>
                <Input value={form.contactTel3} onChange={(e) => update("contactTel3", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            特殊技能料金 / 必要資格
          </h2>
          <div className="space-y-2">
            {qualifications.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                資格マスタが空です。先にスタッフ管理の資格マスタを登録してください。
              </p>
            ) : qualBonuses.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                設定なし。「＋ 資格を追加」で資格と加算額・必須フラグを設定できます（資格 {qualifications.length} 件登録済み）。
              </p>
            ) : null}
            {qualBonuses.map((b, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <select
                  className="flex-1 min-w-[160px] h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
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
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={b.isRequired}
                    onChange={(e) => updateQualBonus(idx, "isRequired", e.target.checked)}
                  />
                  必須
                </label>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            備考
          </h2>
          <div>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
          </div>
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
