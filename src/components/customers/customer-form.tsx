"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CustomerData = {
  id?: number;
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
};

export function CustomerForm({
  customer,
  readOnly = false,
}: {
  customer?: CustomerData;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const isEdit = !!customer?.id;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: customer?.code || "",
    name: customer?.name || "",
    address: customer?.address || "",
    phone: customer?.phone || "",
    notes: customer?.notes || "",
  });

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setLoading(true);
    try {
      const url = isEdit ? `/api/customers/${customer!.id}` : "/api/customers";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim() || null,
          name: form.name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success(isEdit ? "得意先を更新しました" : "得意先を登録しました");
        router.push("/customers");
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "保存に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={readOnly} className="bg-card rounded-xl border shadow-sm p-4 md:p-6 max-w-xl space-y-4 disabled:opacity-90">
        {readOnly && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            閲覧モード（編集には管理者権限が必要です）
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>得意先コード</Label>
            <Input
              value={form.code}
              onChange={(e) => update("code", e.target.value)}
              placeholder="例: KS001"
            />
            <p className="text-xs text-muted-foreground">任意。指定する場合は一意である必要があります。</p>
          </div>
          <div className="space-y-2">
            <Label>得意先名 <RequiredMark /></Label>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              placeholder="例: スリーエフコーポレーション"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>住所</Label>
          <Input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="本社・本部の住所など"
          />
        </div>

        <div className="space-y-2">
          <Label>代表電話</Label>
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>備考</Label>
          <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
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
