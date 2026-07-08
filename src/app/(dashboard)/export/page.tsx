import { getSession } from "@/lib/auth";
import { ExportClient } from "./export-client";

// サーバ側でセッションを読み、role をクライアントへ渡す（お金の列は管理者のみ）。
export default async function ExportPage() {
  const session = await getSession();
  return <ExportClient role={session?.role ?? null} />;
}
