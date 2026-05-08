import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SITE_STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";

export default async function SitesPage() {
  const sites = await prisma.jobSite.findMany({
    include: { branchOffice: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "現場" },
        ]}
        title="現場一覧"
        description={`全 ${sites.length} 件`}
        action={
          <Link href="/sites/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              現場登録
            </Button>
          </Link>
        }
      />
      <div className="px-4 md:px-6 py-6">

      <div className="rounded-xl border shadow-sm bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">コード</TableHead>
              <TableHead>現場名</TableHead>
              <TableHead className="hidden md:table-cell">元請け</TableHead>
              <TableHead className="hidden md:table-cell">担当営業所</TableHead>
              <TableHead className="hidden lg:table-cell">期間</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map((site) => (
              <TableRow key={site.id}>
                <TableCell className="font-mono text-sm">{site.siteCode}</TableCell>
                <TableCell className="font-medium">{site.name}</TableCell>
                <TableCell className="hidden md:table-cell">{site.clientName}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: site.branchOffice.color,
                      color: site.branchOffice.color,
                    }}
                  >
                    {site.branchOffice.name}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  {site.startDate} ~ {site.endDate}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={site.status === "active" ? "default" : "secondary"}
                  >
                    {SITE_STATUSES[site.status as keyof typeof SITE_STATUSES]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/sites/${site.id}`}>
                    <Button variant="ghost" size="icon">
                      <Pencil className="h-4 w-4" />
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
