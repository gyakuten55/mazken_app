import { prisma } from "@/lib/prisma";
import { StaffForm } from "@/components/staff/staff-form";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSession } from "@/lib/auth";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "staff") redirect("/calendar");

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
  const canEdit = session.role === "admin";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "スタッフ", href: "/staff" },
          { label: staff.name },
        ]}
        title={canEdit ? "スタッフ編集" : "スタッフ詳細"}
      />
      <div className="px-4 md:px-6 py-6">
        <StaffForm
          staff={staff}
          branchOffices={branchOffices}
          qualifications={qualifications}
          readOnly={!canEdit}
        />
      </div>
    </>
  );
}
