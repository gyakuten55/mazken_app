"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type Branch = {
  id: number;
  name: string;
  code: string;
  color: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  sortOrder: number;
};

type FormState = {
  name: string;
  code: string;
  color: string;
  address: string;
  phone: string;
  fax: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  color: "#7C3AED",
  address: "",
  phone: "",
  fax: "",
  sortOrder: "0",
};

const PRESET_COLORS = [
  "#7C3AED",
  "#2563EB",
  "#0891B2",
  "#059669",
  "#D97706",
  "#DC2626",
  "#DB2777",
  "#475569",
];

export function BranchesManager({
  initialBranches,
  canEdit,
}: {
  initialBranches: Branch[];
  canEdit: boolean;
}) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    code?: string;
    color?: string;
  }>({});
  const confirm = useConfirm();

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      sortOrder: String(branches.length),
    });
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(b: Branch) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      code: b.code,
      color: b.color,
      address: b.address ?? "",
      phone: b.phone ?? "",
      fax: b.fax ?? "",
      sortOrder: String(b.sortOrder),
    });
    setFieldErrors({});
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const errors: typeof fieldErrors = {};
    if (!form.name.trim()) errors.name = "営業所名は必須です";
    if (!form.code.trim()) errors.code = "営業所コードは必須です";
    if (!/^#[0-9a-fA-F]{6}$/.test(form.color.trim())) {
      errors.color = "色は #RRGGBB の形式で指定してください";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("入力内容を確認してください");
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        color: form.color.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        fax: form.fax.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = await fetch(
        editingId ? `/api/branches/${editingId}` : "/api/branches",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "保存に失敗しました");
        return;
      }
      const saved: Branch = await res.json();
      setBranches((prev) => {
        const next = editingId
          ? prev.map((b) => (b.id === editingId ? saved : b))
          : [...prev, saved];
        return [...next].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
        );
      });
      toast.success(editingId ? "営業所を更新しました" : "営業所を登録しました");
      setDialogOpen(false);
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(b: Branch) {
    confirm({
      title: "この営業所を削除しますか？",
      description: `${b.name}（${b.code}）を削除します。\n所属スタッフ・現場・ユーザーが残っている場合は削除できません。`,
      confirmLabel: "削除する",
      cancelLabel: "やめる",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/branches/${b.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data?.details) {
              const d = data.details;
              toast.error(
                `削除できません: スタッフ ${d.staff ?? 0} / 現場 ${d.jobSites ?? 0} / ユーザー ${d.users ?? 0} 件が紐付いています`,
              );
            } else {
              toast.error(data?.error || "削除に失敗しました");
            }
            return;
          }
          setBranches((prev) => prev.filter((x) => x.id !== b.id));
          toast.success(`${b.name} を削除しました`);
        } catch {
          toast.error("エラーが発生しました");
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canEdit ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            営業所追加
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">閲覧のみ</span>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">色</TableHead>
              <TableHead>営業所名</TableHead>
              <TableHead className="w-[120px]">コード</TableHead>
              <TableHead>住所</TableHead>
              <TableHead className="w-[140px]">電話</TableHead>
              <TableHead className="w-[140px]">FAX</TableHead>
              <TableHead className="w-[80px] text-right">並び</TableHead>
              <TableHead className="w-[140px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-5 w-5 rounded-full border"
                      style={{ backgroundColor: b.color }}
                      aria-hidden
                    />
                  </div>
                </TableCell>
                <TableCell className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {b.name}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{b.code}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                  {b.address || <span className="opacity-50">—</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {b.phone || <span className="text-muted-foreground opacity-50">—</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {b.fax || <span className="text-muted-foreground opacity-50">—</span>}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {b.sortOrder}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(b)}
                          className="h-8"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(b)}
                          className={cn(
                            "h-8 text-red-600 hover:text-red-700 hover:bg-red-50",
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {branches.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-12"
                >
                  営業所がまだ登録されていません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editingId ? "営業所編集" : "営業所追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>営業所名 *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="例: 高瀬営業所"
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>営業所コード *</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value }))
                  }
                  placeholder="例: TKS"
                  className="font-mono"
                  aria-invalid={!!fieldErrors.code}
                />
                {fieldErrors.code && (
                  <p className="text-xs text-red-600">{fieldErrors.code}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>カラー *</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, color: e.target.value }))
                  }
                  className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
                  aria-label="カラーピッカー"
                />
                <Input
                  value={form.color}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, color: e.target.value }))
                  }
                  className="font-mono"
                  placeholder="#7C3AED"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: c }))}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all",
                      form.color.toUpperCase() === c.toUpperCase()
                        ? "border-foreground ring-2 ring-offset-1 ring-foreground/30"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`色 ${c}`}
                  />
                ))}
              </div>
              {fieldErrors.color && (
                <p className="text-xs text-red-600">{fieldErrors.color}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>住所</Label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="任意"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>電話</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="任意"
                />
              </div>
              <div className="space-y-1.5">
                <Label>FAX</Label>
                <Input
                  value={form.fax}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fax: e.target.value }))
                  }
                  placeholder="任意"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>並び順</Label>
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sortOrder: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                数値が小さいほど上に表示されます
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "保存中..." : editingId ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
