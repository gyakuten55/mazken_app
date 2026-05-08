import { prisma } from "@/lib/prisma";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  const branchOffices = await prisma.branchOffice.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return <CalendarView branchOffices={branchOffices} />;
}
