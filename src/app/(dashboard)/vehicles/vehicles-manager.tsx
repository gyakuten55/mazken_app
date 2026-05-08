"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck, AlertTriangle } from "lucide-react";
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

type Vehicle = {
  id: number;
  plateNumber: string;
  name: string | null;
  vehicleType: string | null;
  inspectionDate: string | null;
  notes: string | null;
  isActive: boolean;
  daysUntilInspection: number | null;
};

type FormState = {
  plateNumber: string;
  name: string;
  vehicleType: string;
  inspectionDate: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  plateNumber: "",
  name: "",
  vehicleType: "",
  inspectionDate: "",
  notes: "",
};

function inspectionBadge(days: number | null) {
  if (days === null) return null;
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
        <AlertTriangle className="h-3 w-3" />
        車検切れ {Math.abs(days)}日
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
        <AlertTriangle className="h-3 w-3" />
        あと{days}日
      </span>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground">あと{days}日</span>
  );
}

export function VehiclesManager({
  initialVehicles,
  canDelete,
}: {
  initialVehicles: Vehicle[];
  canDelete: boolean;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditingId(v.id);
    setForm({
      plateNumber: v.plateNumber,
      name: v.name ?? "",
      vehicleType: v.vehicleType ?? "",
      inspectionDate: v.inspectionDate ?? "",
      notes: v.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.plateNumber.trim()) {
      toast.error("車両ナンバーは必須です");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        plateNumber: form.plateNumber.trim(),
        name: form.name.trim() || null,
        vehicleType: form.vehicleType.trim() || null,
        inspectionDate: form.inspectionDate || null,
        notes: form.notes.trim() || null,
      };
      const res = await fetch(
        editingId ? `/api/vehicles/${editingId}` : "/api/vehicles",
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
      const saved: Vehicle = await res.json();
      setVehicles((prev) =>
        editingId
          ? prev.map((v) => (v.id === editingId ? saved : v))
          : [...prev, saved],
      );
      toast.success(editingId ? "車両情報を更新しました" : "車両を登録しました");
      setDialogOpen(false);
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(v: Vehicle) {
    confirm({
      title: "この車両を削除しますか？",
      description: `${v.plateNumber} を削除します。\n※すでに配置で使われている場合、配置からは車両情報だけ外れます（配置自体は残ります）。`,
      confirmLabel: "削除する",
      cancelLabel: "やめる",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/vehicles/${v.id}`, { method: "DELETE" });
          if (!res.ok) {
            toast.error("削除に失敗しました");
            return;
          }
          setVehicles((prev) => prev.filter((x) => x.id !== v.id));
          toast.success(`${v.plateNumber} を削除しました`);
        } catch {
          toast.error("エラーが発生しました");
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          車両追加
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>車両ナンバー</TableHead>
              <TableHead>愛称</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>車検日</TableHead>
              <TableHead>備考</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    {v.plateNumber}
                  </div>
                </TableCell>
                <TableCell>{v.name || <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm">
                  {v.vehicleType || <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">
                      {v.inspectionDate || <span className="text-xs text-muted-foreground">未設定</span>}
                    </span>
                    {inspectionBadge(v.daysUntilInspection)}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {v.notes}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(v)}
                      className="h-8"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      編集
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(v)}
                        className={cn("h-8 text-red-600 hover:text-red-700 hover:bg-red-50")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {vehicles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  車両が登録されていません
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
              <Truck className="h-5 w-5" />
              {editingId ? "車両編集" : "車両追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>車両ナンバー *</Label>
              <Input
                value={form.plateNumber}
                onChange={(e) => setForm((p) => ({ ...p, plateNumber: e.target.value }))}
                placeholder="例: 京都500あ1234"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>愛称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="例: ハイエース1号"
                />
              </div>
              <div className="space-y-1.5">
                <Label>種別</Label>
                <Input
                  value={form.vehicleType}
                  onChange={(e) => setForm((p) => ({ ...p, vehicleType: e.target.value }))}
                  placeholder="例: 普通車"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>車検日</Label>
              <Input
                type="date"
                value={form.inspectionDate}
                onChange={(e) => setForm((p) => ({ ...p, inspectionDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>備考</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="任意"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
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
