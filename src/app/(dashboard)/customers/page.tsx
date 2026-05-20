import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CustomersTable } from "./customers-table";

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

  // Client Component に渡すために date 型などを除外したシリアライザブルな形へ
  const items = customers.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    address: c.address,
    phone: c.phone,
    _count: c._count,
  }));

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
        <CustomersTable customers={items} canEdit={canEdit} />
      </div>
    </>
  );
}
