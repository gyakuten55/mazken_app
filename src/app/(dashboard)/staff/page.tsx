import { prisma } from "@/lib/prisma";
import { StaffTable } from "@/components/staff/staff-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "staff") redirect("/calendar");
  const canEdit = session.role === "admin";

  const [staff, branchOffices, qualifications] = await Promise.all([
    prisma.staff.findMany({
      where: { isActive: true },
      include: {
        branchOffice: true,
        staffQualifications: { include: { qualification: true } },
      },
      orderBy: [{ branchOfficeId: "asc" }, { employeeCode: "asc" }],
    }),
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qualification.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "スタッフ" },
        ]}
        title="スタッフ一覧"
        description={`全 ${staff.length} 名${canEdit ? "" : "（閲覧のみ）"}`}
        action={
          canEdit ? (
            <Link href="/staff/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                スタッフ登録
              </Button>
            </Link>
          ) : null
        }
      />
      <div className="px-4 md:px-6 py-6">
        <StaffTable
          staff={staff}
          branchOffices={branchOffices}
          qualifications={qualifications}
          readOnly={!canEdit}
        />
      </div>
    </>
  );
}
