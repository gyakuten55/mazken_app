import { prisma } from "@/lib/prisma";
import { SiteForm } from "@/components/sites/site-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewSitePage() {
  const [branchOffices, qualifications] = await Promise.all([
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qualification.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "現場", href: "/sites" },
          { label: "新規登録" },
        ]}
        title="現場登録"
      />
      <div className="px-4 md:px-6 py-6">
        <SiteForm branchOffices={branchOffices} qualifications={qualifications} />
      </div>
    </>
  );
}
