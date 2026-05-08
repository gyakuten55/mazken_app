import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { USER_ROLES } from "@/lib/constants";
import { QrActions } from "./qr-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserQrPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/calendar");

  const { id } = await params;
  const userId = Number(id);
  if (!userId) notFound();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { branchOffice: true, staff: true },
  });
  if (!user) notFound();

  // Determine base URL from request headers
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const loginUrl = user.loginToken ? `${baseUrl}/login/qr?token=${user.loginToken}` : null;
  const qrSvg = loginUrl
    ? await QRCode.toString(loginUrl, { type: "svg", width: 360, margin: 1 })
    : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "ユーザー管理", href: "/users" },
          { label: `${user.name} のQRコード` },
        ]}
        title={`${user.name} のQRログイン`}
        description="スマホでスキャンすると自動ログインします"
      />
      <div className="px-4 md:px-6 py-6 max-w-2xl mx-auto space-y-6 print:max-w-none print:px-0 print:py-0">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">ユーザー</div>
              <div className="text-xl font-bold">{user.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                @{user.username} · {USER_ROLES[user.role as keyof typeof USER_ROLES] || user.role}
                {user.branchOffice && ` · ${user.branchOffice.name}`}
              </div>
              {user.staff && (
                <div className="text-xs text-muted-foreground">
                  紐付きスタッフ: {user.staff.name}
                </div>
              )}
            </div>
            <QrActions userId={user.id} hasToken={!!user.loginToken} />
          </div>

          <div className="flex flex-col items-center gap-3 py-4 border-t">
            {qrSvg && loginUrl ? (
              <>
                <div
                  className="bg-white p-4 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <div className="text-[11px] text-muted-foreground break-all text-center max-w-lg">
                  {loginUrl}
                </div>
                <div className="text-xs text-muted-foreground">
                  発行日時:{" "}
                  {user.loginTokenAt
                    ? new Date(user.loginTokenAt).toLocaleString("ja-JP")
                    : "—"}
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-2">
                <div className="text-sm text-muted-foreground">
                  まだQRコードが発行されていません
                </div>
                <div className="text-xs text-muted-foreground">
                  右上の「QR発行」ボタンから生成してください
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed print:hidden">
          <p className="font-medium text-foreground mb-1">取扱い注意</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>QRコードは他人に渡さないでください</li>
            <li>スタッフが退職した場合は「無効化」を実行してください</li>
            <li>印刷して本人に配布する場合は封入などで他者の目に触れないようにしてください</li>
          </ul>
        </div>
      </div>
    </>
  );
}
