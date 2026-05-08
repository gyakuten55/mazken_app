import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      userRole={session.role}
      staffId={session.staffId ?? undefined}
      userName={session.name}
    >
      {children}
    </DashboardShell>
  );
}
