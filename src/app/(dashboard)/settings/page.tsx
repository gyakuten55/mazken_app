import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { BranchesManager } from "./branches-manager";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/calendar");

  const branches = await prisma.branchOffice.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "設定" },
        ]}
        title="設定"
        description="システム全体のマスタを管理します"
      />
      <div className="px-4 md:px-6 py-6 space-y-8">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">営業所</h2>
            <p className="text-sm text-muted-foreground">
              スタッフ・現場・ユーザーが所属する営業所のマスタです。配置カレンダー等で表示色として使われます。
            </p>
          </div>
          <BranchesManager initialBranches={branches} canEdit />
        </section>
      </div>
    </>
  );
}
