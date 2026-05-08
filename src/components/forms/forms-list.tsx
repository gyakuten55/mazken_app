"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Eye,
  Pencil,
  Printer,
  CheckCircle2,
  FileText,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";

type FormItem = {
  id: number;
  date: string;
  workContent: string | null;
  quantity: string | null;
  unit: string | null;
  staffNames: string | null;
  startTime: string | null;
  endTime: string | null;
  clientSignature: string | null;
  isSubmitted: boolean;
  jobSite: {
    name: string;
    siteCode: string;
    branchOffice: { name: string; color: string };
  };
};

function parseStaffCount(json: string | null): number {
  if (!json) return 0;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((s: unknown) => {
      if (typeof s === "string") return s.trim();
      if (typeof s === "object" && s !== null && "name" in s) return (s as { name: string }).name.trim();
      return false;
    }).length : 0;
  } catch {
    return 0;
  }
}

export function FormsListClient({ forms: initialForms }: { forms: FormItem[] }) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const filtered = forms.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.date.includes(q) ||
      f.jobSite.name.toLowerCase().includes(q) ||
      f.jobSite.siteCode.toLowerCase().includes(q) ||
      (f.workContent || "").toLowerCase().includes(q)
    );
  });

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
      if (res.ok) {
        setForms((prev) => prev.filter((f) => f.id !== id));
        toast.success("削除しました");
        if (previewId === id) setPreviewId(null);
      } else {
        toast.error("削除に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setDeleting(null);
    }
  }

  const previewForm = previewId ? forms.find((f) => f.id === previewId) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "出来高確認書" },
        ]}
        title="出来高確認書"
        description={`全 ${forms.length} 件`}
        action={
          <Link href="/forms/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </Link>
        }
      />
      <div className="px-4 md:px-6 py-6">

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="日付・現場名で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className={cn("border rounded-lg overflow-hidden", previewForm ? "flex-1" : "w-full")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">日付</TableHead>
                <TableHead>現場</TableHead>
                <TableHead className="hidden md:table-cell">作業内容</TableHead>
                <TableHead className="hidden md:table-cell w-[60px]">人数</TableHead>
                <TableHead className="hidden lg:table-cell w-[80px]">出来高</TableHead>
                <TableHead className="w-[70px]">状態</TableHead>
                <TableHead className="w-[120px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {forms.length === 0
                      ? "出来高確認書はまだありません"
                      : "検索結果がありません"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((form) => {
                  const staffCount = parseStaffCount(form.staffNames);
                  const isActive = previewId === form.id;
                  return (
                    <TableRow
                      key={form.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isActive && "bg-accent"
                      )}
                      onClick={() => setPreviewId(isActive ? null : form.id)}
                    >
                      <TableCell className="font-mono text-sm">{form.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: form.jobSite.branchOffice.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{form.jobSite.name}</div>
                            <div className="text-[10px] text-muted-foreground">{form.jobSite.siteCode}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                        {form.workContent || "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-center">
                        {staffCount > 0 ? `${staffCount}名` : "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {form.quantity ? `${form.quantity}${form.unit || ""}` : "-"}
                      </TableCell>
                      <TableCell>
                        {form.clientSignature ? (
                          <Badge variant="default" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            署名済
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">下書き</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {form.clientSignature ? (
                            /* 署名済み → 確認(プレビュー)のみ */
                            <Link href={`/forms/${form.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="確認">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          ) : (
                            /* 未署名 → 編集可 */
                            <Link href={`/forms/${form.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="編集">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="削除"
                            disabled={deleting === form.id}
                            onClick={() => {
                              if (confirm("この出来高確認書を削除しますか？")) {
                                handleDelete(form.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Preview panel */}
        {previewForm && (
          <div className="hidden lg:block w-[350px] border rounded-lg bg-card overflow-hidden shrink-0">
            <div className="border-b px-4 py-2 bg-muted/30 flex items-center justify-between">
              <span className="text-sm font-medium">プレビュー</span>
              <button onClick={() => setPreviewId(null)} className="text-muted-foreground hover:text-foreground text-xs">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm overflow-auto max-h-[calc(100vh-200px)]">
              {/* Date & Status */}
              <div className="flex items-center justify-between">
                <span className="font-mono">{previewForm.date}</span>
                {previewForm.clientSignature ? (
                  <Badge variant="default" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" />
                    署名済
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">下書き</Badge>
                )}
              </div>

              {/* Site */}
              <div className="p-2.5 rounded-lg bg-muted/50">
                <div className="text-[10px] text-muted-foreground mb-0.5">現場</div>
                <div className="font-medium">{previewForm.jobSite.name}</div>
                <div className="text-xs text-muted-foreground">{previewForm.jobSite.siteCode}</div>
              </div>

              {/* Work content */}
              {previewForm.workContent && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">作業内容</div>
                  <div>{previewForm.workContent}</div>
                </div>
              )}

              {/* Quantity & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">数量</div>
                  <div className="font-bold text-base">
                    {previewForm.quantity ? `${previewForm.quantity}${previewForm.unit || ""}` : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">時間</div>
                  <div>{previewForm.startTime || "-"} ~ {previewForm.endTime || "-"}</div>
                </div>
              </div>

              {/* Staff */}
              {previewForm.staffNames && (() => {
                try {
                  const staff = JSON.parse(previewForm.staffNames);
                  if (!Array.isArray(staff) || staff.length === 0) return null;
                  return (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">
                        作業者 ({staff.filter((s: unknown) => typeof s === "string" ? s : (s as {name:string}).name).length}名)
                      </div>
                      <div className="space-y-0.5">
                        {staff.map((s: string | { name: string; insurance: string }, i: number) => {
                          const name = typeof s === "string" ? s : s.name;
                          const ins = typeof s === "string" ? "" : s.insurance;
                          if (!name.trim()) return null;
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground text-[10px] w-4 text-right">{i+1}</span>
                              <span>{name}</span>
                              {ins && <span className="text-[10px] px-1 py-px bg-muted rounded">{ins}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Signature */}
              {previewForm.clientSignature && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">署名</div>
                  <div className="border rounded bg-white p-1">
                    <img src={previewForm.clientSignature} alt="サイン" className="h-16 object-contain" />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Link href={`/forms/${previewForm.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    {previewForm.clientSignature ? (
                      <><Eye className="h-3.5 w-3.5 mr-1.5" />確認</>
                    ) : (
                      <><Pencil className="h-3.5 w-3.5 mr-1.5" />編集</>
                    )}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={deleting === previewForm.id}
                  onClick={() => {
                    if (confirm("この出来高確認書を削除しますか？")) {
                      handleDelete(previewForm.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
