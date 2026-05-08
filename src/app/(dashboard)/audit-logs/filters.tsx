"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Current = { model: string; user: string; action: string };

export function AuditLogFilters({
  models,
  modelLabels,
  usernames,
  current,
}: {
  models: string[];
  modelLabels: Record<string, string>;
  usernames: string[];
  current: Current;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: keyof Current, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/audit-logs?${next.toString()}`);
  }

  const hasFilter = current.model || current.user || current.action;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Filter className="h-3.5 w-3.5" />
        フィルター:
      </span>

      <select
        value={current.action}
        onChange={(e) => update("action", e.target.value)}
        className="border rounded px-2 py-1 text-xs bg-background"
      >
        <option value="">全操作</option>
        <option value="create">作成</option>
        <option value="update">更新</option>
        <option value="delete">削除</option>
      </select>

      <select
        value={current.model}
        onChange={(e) => update("model", e.target.value)}
        className="border rounded px-2 py-1 text-xs bg-background"
      >
        <option value="">全対象</option>
        {models.map((m) => (
          <option key={m} value={m}>
            {modelLabels[m] ?? m}
          </option>
        ))}
      </select>

      <select
        value={current.user}
        onChange={(e) => update("user", e.target.value)}
        className="border rounded px-2 py-1 text-xs bg-background"
      >
        <option value="">全ユーザー</option>
        {usernames.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>

      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/audit-logs")}
          className="h-7"
        >
          <X className="h-3 w-3 mr-1" />
          クリア
        </Button>
      )}
    </div>
  );
}
