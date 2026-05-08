"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCog, Pencil } from "lucide-react";
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
import { USER_ROLES } from "@/lib/constants";

export type Branch = {
  id: number;
  name: string;
  code: string;
  color: string;
};

export type StaffOption = {
  id: number;
  name: string;
  employeeCode: string;
};

export type UserFormValues = {
  username: string;
  password: string;
  name: string;
  role: string;
  branchOfficeId: string;
  staffId: string;
};

const ROLE_OPTIONS = Object.entries(USER_ROLES) as [string, string][];

const EMPTY: UserFormValues = {
  username: "",
  password: "",
  name: "",
  role: "admin",
  branchOfficeId: "",
  staffId: "",
};

export function UserFormDialog({
  mode,
  open,
  onOpenChange,
  branchOffices,
  staffOptions,
  initialValues,
  fixedUsername,
  onSubmit,
  submitting,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchOffices: Branch[];
  staffOptions: StaffOption[];
  initialValues?: Partial<UserFormValues>;
  fixedUsername?: string;
  onSubmit: (values: UserFormValues) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<UserFormValues>({ ...EMPTY, ...initialValues });

  // open切り替わり時に値をリセット
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...initialValues });
    }
  }, [open, initialValues]);

  const isCreate = mode === "create";

  async function handleSubmit() {
    if (isCreate) {
      if (!form.username || !form.password || !form.name) {
        toast.error("ユーザー名・パスワード・名前は必須です");
        return;
      }
    } else {
      if (!form.name) {
        toast.error("名前は必須です");
        return;
      }
    }
    if (form.role === "staff" && !form.staffId) {
      toast.error("スタッフ権限の場合はスタッフの紐付けが必要です");
      return;
    }
    await onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreate ? <UserCog className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            {isCreate ? "ユーザー追加" : "ユーザー編集"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {isCreate ? (
            <>
              <div className="space-y-1.5">
                <Label>ユーザー名（ログインID）*</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. admin2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>パスワード *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="4文字以上"
                />
              </div>
            </>
          ) : (
            fixedUsername && (
              <div className="text-xs text-muted-foreground">
                ログインID: <span className="font-mono">{fixedUsername}</span>
              </div>
            )
          )}
          <div className="space-y-1.5">
            <Label>{isCreate ? "表示名 *" : "表示名 *"}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. 山田 太郎"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>権限 *</Label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    role: e.target.value,
                    staffId: e.target.value === "staff" ? p.staffId : "",
                  }))
                }
                className="w-full h-9 rounded-md border px-2 text-sm bg-background"
              >
                {ROLE_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>営業所</Label>
              <select
                value={form.branchOfficeId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, branchOfficeId: e.target.value }))
                }
                className="w-full h-9 rounded-md border px-2 text-sm bg-background"
              >
                <option value="">—</option>
                {branchOffices.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.role === "staff" && (
            <div className="space-y-1.5">
              <Label>紐付けスタッフ *</Label>
              <select
                value={form.staffId}
                onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                className="w-full h-9 rounded-md border px-2 text-sm bg-background"
              >
                <option value="">選択してください</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.employeeCode ? `${s.employeeCode} ` : ""}
                    {s.name}
                  </option>
                ))}
              </select>
              {isCreate && (
                <p className="text-[10px] text-muted-foreground">
                  スタッフ権限はカレンダーで自分の予定のみ閲覧できます
                </p>
              )}
            </div>
          )}
          {!isCreate && (
            <div className="space-y-1.5">
              <Label>パスワード（変更する場合のみ入力）</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="4文字以上"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isCreate ? "作成中..." : "保存中...") : isCreate ? "作成" : "更新"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
