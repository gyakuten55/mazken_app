import { prisma } from "@/lib/prisma";
import { FormsListClient } from "@/components/forms/forms-list";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function FormsPage() {
  // 出来高請求書はお金関連のため、番頭(office)・スケジュール入力専用(schedule)・個人(staff)からは隔離する。
  // （議事録 §6: 個人は自分の予定だけ・お金情報不要。番頭はお金NG）
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "office" || session.role === "schedule" || session.role === "staff") {
    redirect("/calendar");
  }
  const forms = await prisma.workCompletionForm.findMany({
    include: { jobSite: { include: { branchOffice: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });

  return <FormsListClient forms={JSON.parse(JSON.stringify(forms))} />;
}
