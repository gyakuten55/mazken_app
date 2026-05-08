import { prisma } from "@/lib/prisma";
import { SiteForm } from "@/components/sites/site-form";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [site, branchOffices, qualifications] = await Promise.all([
    prisma.jobSite.findUnique({
      where: { id: parseInt(id) },
      include: {
        branchOffice: true,
        qualificationBonuses: { include: { qualification: true } },
      },
    }),
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qualification.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!site) notFound();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "現場", href: "/sites" },
          { label: site.name },
        ]}
        title="現場編集"
      />
      <div className="px-4 md:px-6 py-6">
        <SiteForm site={site} branchOffices={branchOffices} qualifications={qualifications} />
      </div>
    </>
  );
}
