import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/calendar");

  const [users, branchOffices, staff] = await Promise.all([
    prisma.user.findMany({
      include: { branchOffice: true, staff: true },
      orderBy: { id: "asc" },
    }),
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.staff.findMany({
      where: { isActive: true, user: null },
      select: { id: true, name: true, employeeCode: true },
      orderBy: { employeeCode: "asc" },
    }),
  ]);

  const payload = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    branchOffice: u.branchOffice
      ? { id: u.branchOffice.id, name: u.branchOffice.name, color: u.branchOffice.color }
      : null,
    staff: u.staff ? { id: u.staff.id, name: u.staff.name } : null,
    isActive: u.isActive,
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "ユーザー管理" },
        ]}
        title="ユーザー管理"
        description={`管理者・事務・スタッフアカウント 全 ${users.length} 件`}
      />
      <div className="px-4 md:px-6 py-6">
        <UsersManager
          initialUsers={payload}
          branchOffices={branchOffices}
          availableStaff={staff}
          currentUserId={session.id}
        />
      </div>
    </>
  );
}
