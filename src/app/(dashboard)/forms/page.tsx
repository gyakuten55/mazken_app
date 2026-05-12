import { prisma } from "@/lib/prisma";
import { FormsListClient } from "@/components/forms/forms-list";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function FormsPage() {
  // 出来高請求書はお金関連のため、ユーザー1（office）からは隔離する。
  // 個人（staff）は自分の予定確認のため閲覧可能（一覧自体は同じ）。
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "office") redirect("/calendar");
  const forms = await prisma.workCompletionForm.findMany({
    include: { jobSite: { include: { branchOffice: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });

  return <FormsListClient forms={JSON.parse(JSON.stringify(forms))} />;
}
