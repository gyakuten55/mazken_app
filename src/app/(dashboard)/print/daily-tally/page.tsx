import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateISO } from "@/lib/date-utils";
import { TallyPrint } from "./tally-print";

type PageProps = {
  searchParams: Promise<{ date?: string; branch?: string }>;
};

export default async function DailyTallyPrintPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "manager", "office"].includes(session.role)) {
    redirect("/calendar");
  }

  const { date: dateParam, branch: branchParam } = await searchParams;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const date = dateParam && datePattern.test(dateParam) ? dateParam : formatDateISO(new Date());

  const branches = await prisma.branchOffice.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <TallyPrint
      initialDate={date}
      initialBranchCode={branchParam ?? ""}
      branches={branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        color: b.color,
      }))}
    />
  );
}
