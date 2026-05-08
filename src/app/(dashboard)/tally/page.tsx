import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateISO } from "@/lib/date-utils";
import { PageHeader } from "@/components/layout/page-header";
import { TallyEditor } from "./tally-editor";

type PageProps = {
  searchParams: Promise<{ date?: string; branch?: string }>;
};

export default async function TallyPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "manager", "office"].includes(session.role)) {
    redirect("/calendar");
  }

  const { date: dateParam, branch: branchParam } = await searchParams;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const date = dateParam && datePattern.test(dateParam)
    ? dateParam
    : formatDateISO(new Date());

  const branches = await prisma.branchOffice.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const selectedBranch =
    (branchParam && branches.find((b) => b.code === branchParam)) || null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "日計表" },
        ]}
        title="日計表"
        description="スタッフごとの日次支払計算書を編集・印刷できます"
      />
      <div className="px-4 md:px-6 py-4">
        <TallyEditor
          initialDate={date}
          branches={branches.map((b) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            color: b.color,
          }))}
          initialBranchCode={selectedBranch?.code ?? ""}
        />
      </div>
    </>
  );
}
