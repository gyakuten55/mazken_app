import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// CSV 出力はお金関連のため admin のみ。office / staff からはアクセス不可。
export default async function ExportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/calendar");
  return <>{children}</>;
}
