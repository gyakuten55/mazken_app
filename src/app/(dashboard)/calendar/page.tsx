import { prisma } from "@/lib/prisma";
import { CalendarView } from "@/components/calendar/calendar-view";
import { getSession } from "@/lib/auth";

export default async function CalendarPage() {
  const session = await getSession();
  const branchOffices = await prisma.branchOffice.findMany({
    orderBy: { sortOrder: "asc" },
  });

  // 議事録 §6: お金（単価・加算手当）の編集UIは管理者のみ表示
  return (
    <CalendarView
      branchOffices={branchOffices}
      canEditMoney={session?.role === "admin"}
      userRole={session?.role || "staff"}
    />
  );
}
