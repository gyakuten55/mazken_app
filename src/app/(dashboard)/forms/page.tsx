import { prisma } from "@/lib/prisma";
import { FormsListClient } from "@/components/forms/forms-list";

export default async function FormsPage() {
  const forms = await prisma.workCompletionForm.findMany({
    include: { jobSite: { include: { branchOffice: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });

  return <FormsListClient forms={JSON.parse(JSON.stringify(forms))} />;
}
