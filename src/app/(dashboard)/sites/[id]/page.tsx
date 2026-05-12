import { prisma } from "@/lib/prisma";
import { SiteForm } from "@/components/sites/site-form";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSession } from "@/lib/auth";

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "staff") redirect("/calendar");

  const { id } = await params;
  const [site, branchOffices, qualifications, customers] = await Promise.all([
    prisma.jobSite.findUnique({
      where: { id: parseInt(id) },
      include: {
        branchOffice: true,
        customer: { select: { id: true, code: true, name: true } },
        qualificationBonuses: { include: { qualification: true } },
      },
    }),
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qualification.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    }),
  ]);

  if (!site) notFound();
  const canEdit = session.role === "admin";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "現場", href: "/sites" },
          { label: site.name },
        ]}
        title={canEdit ? "現場編集" : "現場詳細"}
      />
      <div className="px-4 md:px-6 py-6">
        <SiteForm
          site={site}
          branchOffices={branchOffices}
          qualifications={qualifications}
          customers={customers}
          readOnly={!canEdit}
        />
      </div>
    </>
  );
}
