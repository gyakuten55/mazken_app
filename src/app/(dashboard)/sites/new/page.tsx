import { prisma } from "@/lib/prisma";
import { SiteForm } from "@/components/sites/site-form";
import { PageHeader } from "@/components/layout/page-header";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewSitePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/sites");

  const [branchOffices, qualifications, customers] = await Promise.all([
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qualification.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    }),
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
        <SiteForm
          branchOffices={branchOffices}
          qualifications={qualifications}
          customers={customers}
        />
      </div>
    </>
  );
}
