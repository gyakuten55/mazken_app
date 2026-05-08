import { prisma } from "@/lib/prisma";
import { StaffForm } from "@/components/staff/staff-form";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [staff, branchOffices, qualifications] = await Promise.all([
    prisma.staff.findUnique({
      where: { id: parseInt(id) },
      include: {
        branchOffice: true,
        staffQualifications: { include: { qualification: true } },
      },
    }),
    prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.qualification.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!staff) notFound();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "スタッフ", href: "/staff" },
          { label: staff.name },
        ]}
        title="スタッフ編集"
      />
      <div className="px-4 md:px-6 py-6">
        <StaffForm
          staff={staff}
          branchOffices={branchOffices}
          qualifications={qualifications}
        />
      </div>
    </>
  );
}
