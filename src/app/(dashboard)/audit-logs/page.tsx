import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AuditLogFilters } from "./filters";

type PageProps = {
  searchParams: Promise<{ model?: string; user?: string; action?: string }>;
};

const AUDITED_MODELS = [
  "Assignment",
  "AssignmentDay",
  "Staff",
  "JobSite",
  "User",
  "WorkCompletionForm",
  "Vehicle",
];

const ACTION_LABEL: Record<string, string> = {
  create: "作成",
  update: "更新",
  delete: "削除",
};

const MODEL_LABEL: Record<string, string> = {
  Assignment: "配置",
  AssignmentDay: "配置日",
  Staff: "スタッフ",
  JobSite: "現場",
  User: "ユーザー",
  WorkCompletionForm: "出来高報告",
  Vehicle: "車両",
};

function actionVariant(action: string): "default" | "secondary" | "destructive" {
  if (action === "delete") return "destructive";
  if (action === "create") return "default";
  return "secondary";
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/calendar");

  const { model, user, action } = await searchParams;

  const where: Record<string, unknown> = {};
  if (model && AUDITED_MODELS.includes(model)) where.model = model;
  if (user) where.username = user;
  if (action && ["create", "update", "delete"].includes(action)) where.action = action;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const usernames = await prisma.auditLog.findMany({
    where: { username: { not: null } },
    select: { username: true },
    distinct: ["username"],
    take: 50,
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "監査ログ" },
        ]}
        title="監査ログ"
        description={`配置・スタッフ・現場・ユーザーなどへの作成/更新/削除を記録（直近${logs.length}件）`}
      />
      <div className="px-4 md:px-6 py-4 space-y-4">
        <AuditLogFilters
          models={AUDITED_MODELS}
          modelLabels={MODEL_LABEL}
          usernames={usernames.map((u) => u.username!).filter(Boolean)}
          current={{ model: model ?? "", user: user ?? "", action: action ?? "" }}
        />

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">日時</TableHead>
                <TableHead className="w-[140px]">ユーザー</TableHead>
                <TableHead className="w-[90px]">操作</TableHead>
                <TableHead className="w-[120px]">対象</TableHead>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>差分（概要）</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs tabular-nums">
                    {new Date(log.createdAt).toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.username ?? (
                      <span className="text-muted-foreground">(システム)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(log.action)}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {MODEL_LABEL[log.model] ?? log.model}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.recordId}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground font-mono">
                    <details>
                      <summary className="cursor-pointer hover:text-foreground truncate max-w-[500px]">
                        {log.diff ? log.diff.slice(0, 120) : "(詳細なし)"}
                        {log.diff && log.diff.length > 120 && "…"}
                      </summary>
                      {log.diff && (
                        <pre className="whitespace-pre-wrap break-all mt-2 p-2 bg-muted rounded text-[10px]">
                          {log.diff}
                        </pre>
                      )}
                    </details>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    該当するログがありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
