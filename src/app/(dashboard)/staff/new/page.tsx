import { prisma } from "@/lib/prisma";
import { StaffForm } from "@/components/staff/staff-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewStaffPage() {
  const [branchOffices, qualifications] = await Promise.all([
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qualification.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "スタッフ", href: "/staff" },
          { label: "新規登録" },
        ]}
        title="スタッフ登録"
      />
      <div className="px-4 md:px-6 py-6">
        <StaffForm branchOffices={branchOffices} qualifications={qualifications} />
      </div>
    </>
  );
}
