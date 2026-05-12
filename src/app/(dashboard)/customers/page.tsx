import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "staff") redirect("/calendar");
  const canEdit = session.role === "admin";

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    include: { _count: { select: { jobSites: true } } },
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "得意先" },
        ]}
        title="得意先一覧"
        description={`全 ${customers.length} 件${canEdit ? "" : "（閲覧のみ）"}`}
        action={
          canEdit ? (
            <Link href="/customers/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                得意先登録
              </Button>
            </Link>
          ) : null
        }
      />
      <div className="px-4 md:px-6 py-6">
        <div className="rounded-xl border shadow-sm bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">コード</TableHead>
                <TableHead>得意先名</TableHead>
                <TableHead className="hidden md:table-cell">住所</TableHead>
                <TableHead className="hidden md:table-cell w-[120px]">代表電話</TableHead>
                <TableHead className="w-[80px] text-right">現場数</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    得意先が登録されていません
                  </TableCell>
                </TableRow>
              )}
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.code || "-"}</TableCell>
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
                      <Button variant="ghost" size="icon" title={canEdit ? "編集" : "詳細"}>
                        {canEdit ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
