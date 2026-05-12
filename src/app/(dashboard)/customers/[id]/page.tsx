import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/layout/page-header";
import { SITE_STATUSES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "staff") redirect("/calendar");

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: parseInt(id) },
    include: {
      jobSites: {
        select: { id: true, siteCode: true, name: true, status: true },
        orderBy: { siteCode: "asc" },
      },
    },
  });
  if (!customer) notFound();
  const canEdit = session.role === "admin";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "得意先", href: "/customers" },
          { label: customer.name },
        ]}
        title={canEdit ? "得意先編集" : "得意先詳細"}
      />
      <div className="px-4 md:px-6 py-6 space-y-6">
        <CustomerForm customer={customer} readOnly={!canEdit} />

        {/* この得意先に紐付いている現場一覧 */}
        <div className="bg-card rounded-xl border shadow-sm p-4 md:p-6 max-w-xl space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            この得意先の現場 ({customer.jobSites.length}件)
          </h2>
          {customer.jobSites.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              現場がまだ登録されていません。「現場登録」画面でこの得意先を選択して登録できます。
            </p>
          ) : (
            <ul className="divide-y border rounded-md overflow-hidden">
              {customer.jobSites.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sites/${s.id}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-accent text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
                      {s.siteCode}
                    </span>
                    <span className="flex-1 truncate">{s.name}</span>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {SITE_STATUSES[s.status as keyof typeof SITE_STATUSES] ?? s.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
