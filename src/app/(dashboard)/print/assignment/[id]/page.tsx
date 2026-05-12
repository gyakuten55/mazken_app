import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  ASSIGNMENT_TYPES,
  ALLOWANCE_CATEGORIES,
} from "@/lib/constants";
import { AssignmentPrintShell } from "./print-shell";

export default async function AssignmentPrintPage({
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

  const scheduled = assignment.assignmentDays.filter((d) => d.status === "scheduled");

  return (
    <AssignmentPrintShell>
      <article className="mx-auto max-w-[210mm] bg-white p-6 md:p-8 text-[12px] leading-relaxed text-black">
        <header className="border-b-2 border-black pb-3 mb-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-bold">配置通知書</h1>
            <span className="text-xs">配置 #{assignment.id}</span>
          </div>
          <div className="mt-1 text-sm text-gray-700">
            {assignment.startDate} 〜 {assignment.endDate}（{assignment.assignmentDays.length}日間）
          </div>
        </header>

        <section className="mb-4">
          <h2 className="text-xs font-bold tracking-wider mb-1.5 border-b border-gray-400 pb-0.5">
            得意先 / 現場
          </h2>
          <table className="w-full text-[11px]">
            <tbody>
              <tr>
                <th className="text-left bg-gray-100 px-2 py-1 w-[20%]">得意先コード</th>
                <td className="px-2 py-1 font-mono">{assignment.jobSite.clientCode || "-"}</td>
                <th className="text-left bg-gray-100 px-2 py-1 w-[20%]">得意先名</th>
                <td className="px-2 py-1">{assignment.jobSite.clientName || "-"}</td>
              </tr>
              <tr>
                <th className="text-left bg-gray-100 px-2 py-1">現場コード</th>
                <td className="px-2 py-1 font-mono">{assignment.jobSite.siteCode}</td>
                <th className="text-left bg-gray-100 px-2 py-1">現場名</th>
                <td className="px-2 py-1 font-medium">{assignment.jobSite.name}</td>
              </tr>
              {assignment.jobSite.address && (
                <tr>
                  <th className="text-left bg-gray-100 px-2 py-1">住所</th>
                  <td className="px-2 py-1" colSpan={3}>{assignment.jobSite.address}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mb-4">
          <h2 className="text-xs font-bold tracking-wider mb-1.5 border-b border-gray-400 pb-0.5">
            スタッフ / 車両 / 担当
          </h2>
          <table className="w-full text-[11px]">
            <tbody>
              <tr>
                <th className="text-left bg-gray-100 px-2 py-1 w-[20%]">スタッフ</th>
                <td className="px-2 py-1">
                  {assignment.staff
                    ? `${assignment.staff.employeeCode} ${assignment.staff.name}`
                    : "未割当"}
                </td>
                <th className="text-left bg-gray-100 px-2 py-1 w-[20%]">区分</th>
                <td className="px-2 py-1">
                  {ASSIGNMENT_TYPES[assignment.assignmentType as keyof typeof ASSIGNMENT_TYPES] ||
                    assignment.assignmentType}
                  {" / "}
                  {assignment.shiftType === "night" ? "夜勤" : "日勤"}
                </td>
              </tr>
              <tr>
                <th className="text-left bg-gray-100 px-2 py-1">時間</th>
                <td className="px-2 py-1 font-mono">
                  {assignment.startTime} 〜 {assignment.endTime}
                </td>
                <th className="text-left bg-gray-100 px-2 py-1">車両</th>
                <td className="px-2 py-1">
                  {assignment.vehicle
                    ? `${assignment.vehicle.plateNumber}${assignment.vehicle.name ? ` (${assignment.vehicle.name})` : ""}`
                    : "-"}
                </td>
              </tr>
              <tr>
                <th className="text-left bg-gray-100 px-2 py-1">担当者</th>
                <td className="px-2 py-1">
                  {assignment.contactName || assignment.jobSite.contactName1 || "-"}
                </td>
                <th className="text-left bg-gray-100 px-2 py-1">電話</th>
                <td className="px-2 py-1 font-mono">
                  {assignment.contactTel || assignment.jobSite.contactTel1 || "-"}
                </td>
              </tr>
              <tr>
                <th className="text-left bg-gray-100 px-2 py-1">交通手段</th>
                <td className="px-2 py-1" colSpan={3}>
                  {assignment.transportation || assignment.jobSite.transportation || "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-4">
          <h2 className="text-xs font-bold tracking-wider mb-1.5 border-b border-gray-400 pb-0.5">
            持ち物 / メモ
          </h2>
          <table className="w-full text-[11px]">
            <tbody>
              <tr>
                <th className="text-left bg-gray-100 px-2 py-1 w-[20%] align-top">持ち物</th>
                <td className="px-2 py-1 whitespace-pre-wrap">
                  {assignment.belongings || assignment.jobSite.belongings || "-"}
                </td>
              </tr>
              {assignment.jobSite.siteMemo && (
                <tr>
                  <th className="text-left bg-gray-100 px-2 py-1 align-top">現場メモ</th>
                  <td className="px-2 py-1 whitespace-pre-wrap">
                    {assignment.jobSite.siteMemo}
                  </td>
                </tr>
              )}
              {assignment.jobSite.genDoMen && (
                <tr>
                  <th className="text-left bg-gray-100 px-2 py-1 align-top">原動面</th>
                  <td className="px-2 py-1 whitespace-pre-wrap">
                    {assignment.jobSite.genDoMen}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {assignment.allowances.length > 0 && (
          <section className="mb-4">
            <h2 className="text-xs font-bold tracking-wider mb-1.5 border-b border-gray-400 pb-0.5">
              加算手当
            </h2>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-2 py-1 border">名称</th>
                  <th className="text-left px-2 py-1 border w-[15%]">区分</th>
                  <th className="text-right px-2 py-1 border w-[20%]">金額（円/日）</th>
                </tr>
              </thead>
              <tbody>
                {assignment.allowances.map((a) => (
                  <tr key={a.id}>
                    <td className="px-2 py-1 border">{a.name}</td>
                    <td className="px-2 py-1 border">
                      {ALLOWANCE_CATEGORIES[a.category as keyof typeof ALLOWANCE_CATEGORIES] || a.category}
                    </td>
                    <td className="px-2 py-1 border text-right tabular-nums">
                      {a.amount.toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mb-4">
          <h2 className="text-xs font-bold tracking-wider mb-1.5 border-b border-gray-400 pb-0.5">
            日別予定（{scheduled.length}日 / 全{assignment.assignmentDays.length}日）
          </h2>
          <div className="grid grid-cols-7 gap-1 text-[10px]">
            {assignment.assignmentDays.map((d) => (
              <div
                key={d.id}
                className={
                  "border px-1 py-1 text-center " +
                  (d.status === "scheduled"
                    ? "bg-white"
                    : d.status === "pre_declined"
                      ? "bg-rose-100 text-rose-800 line-through"
                      : "bg-gray-100 text-gray-500")
                }
              >
                <div className="font-mono">{format(parseISO(d.date), "M/d", { locale: ja })}</div>
                <div className="text-[9px]">{format(parseISO(d.date), "E", { locale: ja })}</div>
              </div>
            ))}
          </div>
        </section>

        {assignment.notes && (
          <section className="mb-4 border border-amber-300 bg-amber-50 p-2 rounded">
            <div className="text-[10px] font-semibold text-amber-800 mb-0.5">備考</div>
            <div className="text-[11px] whitespace-pre-wrap text-amber-900">
              {assignment.notes}
            </div>
          </section>
        )}

        <footer className="mt-6 text-[10px] text-gray-500">
          発行日: {format(new Date(), "yyyy年M月d日", { locale: ja })}
        </footer>
      </article>
    </AssignmentPrintShell>
  );
}
