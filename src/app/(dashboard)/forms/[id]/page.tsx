import { prisma } from "@/lib/prisma";
import { WorkCompletionFormComponent } from "@/components/forms/work-completion-form";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 出来高請求書は番頭/スケジュール入力専用/個人からは隔離（議事録 §6）
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "office" || session.role === "schedule" || session.role === "staff") {
    redirect("/calendar");
  }

  const { id } = await params;
  const [form, sites] = await Promise.all([
    prisma.workCompletionForm.findUnique({
      where: { id: parseInt(id) },
      include: { jobSite: true },
    }),
    prisma.jobSite.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!form) notFound();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "出来高確認書", href: "/forms" },
          { label: "編集" },
        ]}
        title="出来高確認書"
      />
      <div className="px-4 md:px-6 py-6">
        <WorkCompletionFormComponent form={form} sites={sites} />
      </div>
    </>
  );
}
