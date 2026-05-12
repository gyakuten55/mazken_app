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
import { USER_ROLES, SELECTABLE_USER_ROLES } from "@/lib/constants";

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
  branchOfficeId?: number | null;
  branchOffice?: { id: number; name: string; color: string } | null;
  linkedUser?: { id: number; name: string } | null;
};

export type UserFormValues = {
  username: string;
  password: string;
  name: string;
  role: string;
  branchOfficeId: string;
  staffId: string;
};

// 5/20 デモ向け: 3 ロール（admin / office / staff）のみ選択可
const ROLE_OPTIONS = SELECTABLE_USER_ROLES.map(
  (key) => [key, USER_ROLES[key]] as [string, string],
);

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
  editingUserId,
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
  /** 編集中ユーザーの id。これと紐付いている staff はその人が選択中なので「紐付け済」表示を出さない */
  editingUserId?: number | null;
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

  // 作成モード: スタッフ選択時に username/name/branchOfficeId を自動入力
  function handleStaffChange(staffId: string) {
    if (!isCreate) {
      setForm((p) => ({ ...p, staffId }));
      return;
    }
    if (!staffId) {
      // 解除した場合は自動入力もクリア
      setForm((p) => ({ ...p, staffId: "", username: "", name: "", branchOfficeId: "" }));
      return;
    }
    const staff = staffOptions.find((s) => String(s.id) === staffId);
    if (!staff) {
      setForm((p) => ({ ...p, staffId }));
      return;
    }
    setForm((p) => ({
      ...p,
      staffId,
      username: staff.employeeCode || p.username,
      name: staff.name,
      branchOfficeId: staff.branchOfficeId != null ? String(staff.branchOfficeId) : "",
    }));
  }

  async function handleSubmit() {
    if (isCreate) {
      if (!form.staffId) {
        toast.error("紐付けスタッフを選択してください");
        return;
      }
      if (!form.username || !form.password || !form.name) {
        toast.error("ユーザー名・表示名・パスワードは必須です");
        return;
      }
    } else {
      if (!form.name) {
        toast.error("表示名は必須です");
        return;
      }
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
            <CreateBody
              form={form}
              setForm={setForm}
              staffOptions={staffOptions}
              branchOffices={branchOffices}
              onStaffChange={handleStaffChange}
            />
          ) : (
            <EditBody
              form={form}
              setForm={setForm}
              staffOptions={staffOptions}
              branchOffices={branchOffices}
              editingUserId={editingUserId}
              fixedUsername={fixedUsername}
            />
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

/**
 * 作成モード本体。
 * 上から: ① スタッフ選択 → ② 権限 → ③ スタッフ情報からの自動入力欄 → ④ パスワード
 */
function CreateBody({
  form,
  setForm,
  staffOptions,
  branchOffices,
  onStaffChange,
}: {
  form: UserFormValues;
  setForm: React.Dispatch<React.SetStateAction<UserFormValues>>;
  staffOptions: StaffOption[];
  branchOffices: Branch[];
  onStaffChange: (staffId: string) => void;
}) {
  const selectedStaff = staffOptions.find((s) => String(s.id) === form.staffId);

  return (
    <>
      {/* ① スタッフ選択 + ② 権限 */}
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <Label>紐付けスタッフ *</Label>
          <select
            value={form.staffId}
            onChange={(e) => onStaffChange(e.target.value)}
            className="w-full h-9 rounded-md border px-2 text-sm bg-background"
          >
            <option value="">— 選択してください —</option>
            {staffOptions.map((s) => {
              const taken = !!s.linkedUser;
              return (
                <option key={s.id} value={s.id} disabled={taken}>
                  {s.employeeCode ? `${s.employeeCode} ` : ""}
                  {s.name}
                  {taken ? ` (${s.linkedUser!.name} に紐付け済)` : ""}
                </option>
              );
            })}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>権限 *</Label>
          <select
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            className="w-full h-9 rounded-md border px-2 text-sm bg-background"
          >
            {ROLE_OPTIONS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ③ スタッフから自動入力された情報（編集可能） */}
      {selectedStaff && (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 space-y-2.5">
          <p className="text-[10px] text-muted-foreground">
            ↓ スタッフ情報から自動入力されました（必要なら編集可）
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">ユーザー名（ログインID） *</Label>
            <Input
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="スタッフID"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">表示名 *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="スタッフ名"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">営業所</Label>
            <select
              value={form.branchOfficeId}
              onChange={(e) =>
                setForm((p) => ({ ...p, branchOfficeId: e.target.value }))
              }
              className="w-full h-8 rounded-md border px-2 text-sm bg-background"
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
      )}

      {/* ④ パスワード（スタッフ選択後のみ表示） */}
      {selectedStaff && (
        <div className="space-y-1.5">
          <Label>パスワード *</Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            placeholder="4文字以上"
          />
        </div>
      )}
    </>
  );
}

/**
 * 編集モード本体。
 * 既存ユーザーの全フィールドを編集可能にし、紐付けスタッフも変更可能。
 */
function EditBody({
  form,
  setForm,
  staffOptions,
  branchOffices,
  editingUserId,
  fixedUsername,
}: {
  form: UserFormValues;
  setForm: React.Dispatch<React.SetStateAction<UserFormValues>>;
  staffOptions: StaffOption[];
  branchOffices: Branch[];
  editingUserId?: number | null;
  fixedUsername?: string;
}) {
  return (
    <>
      {fixedUsername && (
        <div className="text-xs text-muted-foreground">
          ログインID: <span className="font-mono">{fixedUsername}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>表示名 *</Label>
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
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
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
      <div className="space-y-1.5">
        <Label>紐付けスタッフ *</Label>
        <select
          value={form.staffId}
          onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
          className="w-full h-9 rounded-md border px-2 text-sm bg-background"
        >
          <option value="">— 紐付けなし —</option>
          {staffOptions.map((s) => {
            const takenByOther =
              s.linkedUser && s.linkedUser.id !== editingUserId;
            return (
              <option key={s.id} value={s.id} disabled={!!takenByOther}>
                {s.employeeCode ? `${s.employeeCode} ` : ""}
                {s.name}
                {takenByOther ? ` (${s.linkedUser!.name} に紐付け済)` : ""}
              </option>
            );
          })}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>パスワード（変更する場合のみ入力）</Label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          placeholder="4文字以上"
        />
      </div>
    </>
  );
}
