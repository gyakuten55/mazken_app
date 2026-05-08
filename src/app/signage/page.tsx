import { prisma } from "@/lib/prisma";
import { formatDateISO } from "@/lib/date-utils";
import { addDays } from "date-fns";
import { getSession } from "@/lib/auth";
import { SignageView } from "./signage-view";

type PageProps = {
  searchParams: Promise<{ branch?: string; days?: string }>;
};

export default async function SignagePage({ searchParams }: PageProps) {
  const { branch, days: daysParam } = await searchParams;
  const daysAhead = Math.min(14, Math.max(3, Number(daysParam) || 7));

  const session = await getSession();
  const isAdmin = session?.role === "admin" || session?.role === "manager" || session?.role === "office";

  const branches = await prisma.branchOffice.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const selectedBranch =
    branches.find((b) => b.code.toLowerCase() === branch?.toLowerCase()) ||
    branches[0];

  const today = new Date();
  const startDate = formatDateISO(today);
  const endDate = formatDateISO(addDays(today, daysAhead - 1));

  const [assignmentDays, staffList] = selectedBranch
    ? await Promise.all([
        prisma.assignmentDay.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            status: "scheduled",
            assignment: {
              staff: { branchOfficeId: selectedBranch.id },
            },
          },
          include: {
            assignment: {
              include: {
                staff: { include: { branchOffice: true } },
                jobSite: { include: { branchOffice: true } },
              },
            },
          },
          orderBy: { date: "asc" },
        }),
        prisma.staff.findMany({
          where: { branchOfficeId: selectedBranch.id, isActive: true },
          orderBy: [{ nameKana: "asc" }],
          select: {
            id: true,
            name: true,
            displayName: true,
            employeeCode: true,
          },
        }),
      ])
    : [[], []];

  // 未割当配置は表示板の対象外
  const payload = assignmentDays
    .filter((d) => d.assignment.staff != null)
    .map((d) => {
      const staff = d.assignment.staff!;
      return {
        id: d.id,
        date: d.date,
        shiftType: d.assignment.shiftType,
        status: d.status,
        acknowledgedAt: d.acknowledgedAt ? d.acknowledgedAt.toISOString() : null,
        staffId: staff.id,
        staffName: staff.displayName || staff.name,
        staffCode: staff.employeeCode,
        siteId: d.assignment.jobSite.id,
        siteName: d.assignment.jobSite.name,
        clientName: d.assignment.jobSite.clientName,
        siteBranchColor: d.assignment.jobSite.branchOffice.color,
        startTime: d.startTime || d.assignment.startTime,
        endTime: d.endTime || d.assignment.endTime,
        assignmentId: d.assignment.id,
      };
    });

  return (
    <SignageView
      branches={branches}
      selectedBranchCode={selectedBranch?.code ?? ""}
      selectedBranchName={selectedBranch?.name ?? ""}
      startDate={startDate}
      daysAhead={daysAhead}
      assignments={payload}
      staffList={staffList.map((s) => ({
        id: s.id,
        name: s.displayName || s.name,
        employeeCode: s.employeeCode,
      }))}
      isAdmin={isAdmin}
    />
  );
}
