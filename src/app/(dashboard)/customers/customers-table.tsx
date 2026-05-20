"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Pencil, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Customer = {
  id: number;
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  _count: { jobSites: number };
};

export function CustomersTable({
  customers,
  canEdit,
}: {
  customers: Customer[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.code ?? "").toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="名前・コード・住所・電話で検索..."
          className="pl-9"
          aria-label="得意先を検索"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} 件{search && ` / 全 ${customers.length} 件中`}
      </p>
      <div className="rounded-xl border shadow-sm bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">コード</TableHead>
              <TableHead>得意先名</TableHead>
              <TableHead className="hidden md:table-cell">住所</TableHead>
              <TableHead className="hidden md:table-cell w-[120px]">
                代表電話
              </TableHead>
              <TableHead className="w-[80px] text-right">現場数</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  {search
                    ? "該当する得意先がありません"
                    : "得意先が登録されていません"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">
                  {c.code || "-"}
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {c.address || "-"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {c.phone || "-"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {c._count.jobSites}
                </TableCell>
                <TableCell>
                  <Link href={`/customers/${c.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={canEdit ? "編集" : "詳細"}
                    >
                      {canEdit ? (
                        <Pencil className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
