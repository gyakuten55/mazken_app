"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus,
  ShieldCheck,
  UserX,
  UserCheck,
  Pencil,
  Trash2,
  QrCode,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { USER_ROLES } from "@/lib/constants";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  UserFormDialog,
  type Branch,
  type StaffOption,
  type UserFormValues,
} from "./user-form-dialog";

type UserItem = {
  id: number;
  username: string;
  name: string;
  role: string;
  branchOffice: { id: number; name: string; color: string } | null;
  staff: { id: number; name: string } | null;
  isActive: boolean;
};

export function UsersManager({
  initialUsers,
  branchOffices,
  availableStaff,
  currentUserId,
}: {
  initialUsers: UserItem[];
  branchOffices: Branch[];
  availableStaff: StaffOption[];
  currentUserId: number;
}) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [staffPool, setStaffPool] = useState<StaffOption[]>(availableStaff);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();

  // 編集対象のユーザーが既にstaffを紐付けている場合、その選択肢も含める
  const editStaffOptions = useMemo<StaffOption[]>(() => {
    if (!editing?.staff) return staffPool;
    if (staffPool.some((s) => s.id === editing.staff!.id)) return staffPool;
    return [
      { id: editing.staff.id, name: editing.staff.name, employeeCode: "" },
      ...staffPool,
    ];
  }, [editing, staffPool]);

  const editInitialValues = useMemo<Partial<UserFormValues> | undefined>(() => {
    if (!editing) return undefined;
    return {
      name: editing.name,
      role: editing.role,
      branchOfficeId: editing.branchOffice ? String(editing.branchOffice.id) : "",
      staffId: editing.staff ? String(editing.staff.id) : "",
      password: "",
    };
  }, [editing]);

  async function handleCreate(values: UserFormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
          name: values.name,
          role: values.role,
          branchOfficeId: values.branchOfficeId ? Number(values.branchOfficeId) : null,
          staffId: values.staffId ? Number(values.staffId) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "作成に失敗しました");
        return;
      }
      const created = await res.json();
      const linkedStaff = values.staffId
        ? staffPool.find((s) => s.id === Number(values.staffId)) ?? null
        : null;
      setUsers((prev) => [
        ...prev,
        {
          id: created.id,
          username: created.username,
          name: created.name,
          role: created.role,
          branchOffice: created.branchOffice
            ? {
                id: created.branchOffice.id,
                name: created.branchOffice.name,
                color: created.branchOffice.color,
              }
            : null,
          staff: linkedStaff ? { id: linkedStaff.id, name: linkedStaff.name } : null,
          isActive: created.isActive,
        },
      ]);
      if (linkedStaff) {
        setStaffPool((prev) => prev.filter((s) => s.id !== linkedStaff.id));
      }
      toast.success(`${created.name} を作成しました`);
      setCreateOpen(false);
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: UserFormValues) {
    if (!editing) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: values.name,
        role: values.role,
        branchOfficeId: values.branchOfficeId ? Number(values.branchOfficeId) : null,
        staffId: values.staffId ? Number(values.staffId) : null,
      };
      if (values.password) body.password = values.password;

      const res = await fetch(`/api/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "更新に失敗しました");
        return;
      }
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? {
                ...u,
                name: updated.name,
                role: updated.role,
                branchOffice: updated.branchOffice
                  ? {
                      id: updated.branchOffice.id,
                      name: updated.branchOffice.name,
                      color: updated.branchOffice.color,
                    }
                  : null,
                staff: updated.staff ?? null,
              }
            : u,
        ),
      );
      toast.success(`${updated.name} を更新しました`);
      setEditing(null);
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(user: UserItem) {
    const nextActive = !user.isActive;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) {
        toast.error("更新に失敗しました");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: nextActive } : u)),
      );
      toast.success(
        nextActive ? `${user.name} を有効化しました` : `${user.name} を無効化しました`,
      );
    } catch {
      toast.error("エラーが発生しました");
    }
  }

  function handleDelete(user: UserItem) {
    if (user.id === currentUserId) {
      toast.error("自分自身は削除できません");
      return;
    }
    confirm({
      title: "このユーザーを削除しますか？",
      description: `${user.name}（@${user.username}）を削除します。\nこの操作は取り消せません。`,
      confirmLabel: "削除する",
      cancelLabel: "やめる",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "削除に失敗しました");
            return;
          }
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
          toast.success(`${user.name} を削除しました`);
        } catch {
          toast.error("エラーが発生しました");
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          ユーザー追加
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ユーザー名</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>権限</TableHead>
              <TableHead>営業所</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {u.role === "admin" && (
                      <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    {u.name}
                    {u.staff && (
                      <span className="text-[10px] text-muted-foreground">
                        (スタッフ: {u.staff.name})
                      </span>
                    )}
                    {u.id === currentUserId && (
                      <span className="text-[10px] text-blue-600">(あなた)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {USER_ROLES[u.role as keyof typeof USER_ROLES] || u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.branchOffice ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: u.branchOffice.color }}
                      />
                      {u.branchOffice.name}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                      u.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {u.isActive ? "有効" : "無効"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(u)}
                      className="h-8"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      編集
                    </Button>
                    <Link
                      href={`/users/${u.id}/qr`}
                      title="QRログインコード"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "h-8",
                      )}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(u)}
                      className="h-8"
                    >
                      {u.isActive ? (
                        <UserX className="h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(u)}
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  ユーザーが登録されていません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchOffices={branchOffices}
        staffOptions={staffPool}
        onSubmit={handleCreate}
        submitting={submitting}
      />

      <UserFormDialog
        mode="edit"
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        branchOffices={branchOffices}
        staffOptions={editStaffOptions}
        editingUserId={editing?.id ?? null}
        initialValues={editInitialValues}
        fixedUsername={editing?.username}
        onSubmit={handleUpdate}
        submitting={submitting}
      />
    </div>
  );
}
