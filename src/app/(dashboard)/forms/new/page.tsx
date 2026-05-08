import { prisma } from "@/lib/prisma";
import { WorkCompletionFormComponent } from "@/components/forms/work-completion-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewFormPage({
  searchParams,
}: {
  searchParams: Promise<{ jobSiteId?: string; date?: string }>;
}) {
  const { jobSiteId, date } = await searchParams;

  const sites = await prisma.jobSite.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
  });

  // Pre-populate from query params (e.g., from calendar context menu)
  const prefill = {
    jobSiteId: jobSiteId ? parseInt(jobSiteId) : undefined,
    date: date || undefined,
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "出来高確認書", href: "/forms" },
          { label: "新規作成" },
        ]}
        title="出来高確認書 作成"
      />
      <div className="px-4 md:px-6 py-6">
        <WorkCompletionFormComponent sites={sites} prefill={prefill} />
      </div>
    </>
  );
}
