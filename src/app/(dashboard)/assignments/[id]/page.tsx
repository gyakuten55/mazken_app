import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Printer, MapPin, Phone, User, Truck, Coins } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  ASSIGNMENT_TYPES,
  DAY_STATUS,
  ALLOWANCE_CATEGORIES,
} from "@/lib/constants";

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) notFound();

  const assignment = await prisma.assignment.findUnique({
    where: { id: numId },
    include: {
      staff: { include: { branchOffice: true } },
      jobSite: {
        include: {
          branchOffice: true,
          qualificationBonuses: { include: { qualification: true } },
        },
      },
      vehicle: true,
      assignmentDays: { orderBy: { date: "asc" } },
      allowances: { orderBy: { id: "asc" } },
    },
  });
  if (!assignment) notFound();

  const dayCounts = assignment.assignmentDays.reduce<Record<string, number>>(
    (acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "配置詳細" },
        ]}
        title={`配置 #${assignment.id}`}
        description={`${assignment.startDate} 〜 ${assignment.endDate}`}
        action={
          <Link href={`/print/assignment/${assignment.id}`}>
            <Button>
              <Printer className="h-4 w-4 mr-2" />
              印刷
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-6 max-w-3xl">
        {/* Site / 得意先 */}
        <section className="rounded-xl border bg-card shadow-sm p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            現場 / 得意先
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-muted-foreground">得意先コード</div>
            <div className="font-mono">{assignment.jobSite.clientCode || "-"}</div>
            <div className="text-muted-foreground">得意先名</div>
            <div>{assignment.jobSite.clientName || "-"}</div>
            <div className="text-muted-foreground">現場コード</div>
            <div className="font-mono">{assignment.jobSite.siteCode}</div>
            <div className="text-muted-foreground">現場名</div>
            <div className="font-medium">{assignment.jobSite.name}</div>
            <div className="text-muted-foreground">担当営業所</div>
            <div>
              <span
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: assignment.jobSite.branchOffice.color + "20",
                  color: assignment.jobSite.branchOffice.color,
                }}
              >
                {assignment.jobSite.branchOffice.name}
              </span>
            </div>
            {assignment.jobSite.address && (
              <>
                <div className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  住所
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{assignment.jobSite.address}</span>
                  <a
                    href={
                      assignment.jobSite.mapUrl ||
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.jobSite.address)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Google マップで開く ↗
                  </a>
                </div>
              </>
            )}
            {(assignment.transportation || assignment.jobSite.transportation) && (
              <>
                <div className="text-muted-foreground">交通手段</div>
                <div>{assignment.transportation || assignment.jobSite.transportation}</div>
              </>
            )}
          </div>
        </section>

        {/* Schedule */}
        <section className="rounded-xl border bg-card shadow-sm p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            スケジュール
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-muted-foreground">期間</div>
            <div>
              {assignment.startDate} 〜 {assignment.endDate}
              <span className="ml-2 text-muted-foreground">
                ({assignment.assignmentDays.length}日間)
              </span>
            </div>
            <div className="text-muted-foreground">時間</div>
            <div className="font-mono">
              {assignment.startTime} 〜 {assignment.endTime}
            </div>
            <div className="text-muted-foreground">区分</div>
            <div>
              {ASSIGNMENT_TYPES[assignment.assignmentType as keyof typeof ASSIGNMENT_TYPES] ||
                assignment.assignmentType}
              {" / "}
              {assignment.shiftType === "night" ? "夜勤" : "日勤"}
            </div>
            {Object.keys(dayCounts).length > 0 && (
              <>
                <div className="text-muted-foreground">日別ステータス</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(dayCounts).map(([status, count]) => (
                    <span
                      key={status}
                      className="text-xs px-2 py-0.5 rounded bg-muted"
                    >
                      {DAY_STATUS[status as keyof typeof DAY_STATUS] || status}: {count}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Staff & Vehicle */}
        <section className="rounded-xl border bg-card shadow-sm p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            スタッフ / 車両
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-muted-foreground">スタッフ</div>
            <div>
              {assignment.staff ? (
                <span>
                  <span className="font-mono mr-1.5">
                    {assignment.staff.employeeCode}
                  </span>
                  {assignment.staff.name}
                </span>
              ) : (
                <span className="text-amber-600 font-medium">未割当</span>
              )}
            </div>
            {assignment.vehicle && (
              <>
                <div className="text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  車両
                </div>
                <div className="font-mono">
                  {assignment.vehicle.plateNumber}
                  {assignment.vehicle.name && ` (${assignment.vehicle.name})`}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Contact / Belongings */}
        <section className="rounded-xl border bg-card shadow-sm p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            連絡 / 持ち物
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {(assignment.contactName || assignment.jobSite.contactName1) && (
              <>
                <div className="text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> 担当者
                </div>
                <div>
                  {assignment.contactName || assignment.jobSite.contactName1}
                </div>
              </>
            )}
            {(assignment.contactTel || assignment.jobSite.contactTel1) && (
              <>
                <div className="text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> 電話
                </div>
                <div className="font-mono">
                  {assignment.contactTel || assignment.jobSite.contactTel1}
                </div>
              </>
            )}
            <div className="text-muted-foreground">持ち物</div>
            <div className="whitespace-pre-wrap">
              {assignment.belongings || assignment.jobSite.belongings || "-"}
            </div>
            {assignment.jobSite.siteMemo && (
              <>
                <div className="text-muted-foreground">現場メモ</div>
                <div className="whitespace-pre-wrap">{assignment.jobSite.siteMemo}</div>
              </>
            )}
            {assignment.jobSite.genDoMen && (
              <>
                <div className="text-muted-foreground">原動面</div>
                <div className="whitespace-pre-wrap">{assignment.jobSite.genDoMen}</div>
              </>
            )}
          </div>
        </section>

        {/* Allowances */}
        {assignment.allowances.length > 0 && (
          <section className="rounded-xl border bg-card shadow-sm p-4 md:p-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> 加算手当
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {assignment.allowances.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1.5">{a.name}</td>
                    <td className="py-1.5 text-muted-foreground text-xs">
                      {ALLOWANCE_CATEGORIES[a.category as keyof typeof ALLOWANCE_CATEGORIES] ||
                        a.category}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {a.amount.toLocaleString("ja-JP")} 円/日
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Required qualifications */}
        {assignment.jobSite.qualificationBonuses.length > 0 && (
          <section className="rounded-xl border bg-card shadow-sm p-4 md:p-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              資格・特殊技能料金
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {assignment.jobSite.qualificationBonuses.map((q) => (
                  <tr key={q.id}>
                    <td className="py-1.5">
                      {q.qualification.name}
                      {q.isRequired && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                          必須
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      +{q.bonusAmount.toLocaleString("ja-JP")} 円/日
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {assignment.notes && (
          <section className="rounded-xl border bg-amber-50 border-amber-200 p-4">
            <div className="text-xs font-semibold text-amber-800 mb-1">備考</div>
            <div className="text-sm whitespace-pre-wrap text-amber-900">
              {assignment.notes}
            </div>
          </section>
        )}

        {/* Day-by-day list */}
        <section className="rounded-xl border bg-card shadow-sm p-4 md:p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            日別予定
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {assignment.assignmentDays.map((d) => (
                <tr key={d.id}>
                  <td className="py-1.5 font-mono text-xs">
                    {format(parseISO(d.date), "M/d (E)", { locale: ja })}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={
                        d.status === "scheduled"
                          ? "text-emerald-700"
                          : d.status === "pre_declined"
                            ? "text-rose-700"
                            : "text-muted-foreground"
                      }
                    >
                      {DAY_STATUS[d.status as keyof typeof DAY_STATUS] || d.status}
                    </span>
                  </td>
                  <td className="py-1.5 text-xs text-muted-foreground">
                    {(d.startTime || d.endTime) &&
                      `${d.startTime ?? ""} 〜 ${d.endTime ?? ""}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
