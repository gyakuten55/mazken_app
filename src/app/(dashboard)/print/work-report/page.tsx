import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { WorkReportShell } from "./work-report-shell";

type SearchParams = Promise<{ date?: string; branchOfficeId?: string }>;

export default async function WorkReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "manager", "office"].includes(session.role)) redirect("/calendar");

  const sp = await searchParams;
  const date = sp.date ?? format(new Date(), "yyyy-MM-dd");
  const branchOfficeId = sp.branchOfficeId ? Number(sp.branchOfficeId) : undefined;

  const branches = await prisma.branchOffice.findMany({
    orderBy: { sortOrder: "asc" },
  });

  // 当日の scheduled な配置日を、現場単位で集約
  const days = await prisma.assignmentDay.findMany({
    where: {
      date,
      status: "scheduled",
      ...(branchOfficeId
        ? { assignment: { jobSite: { branchOfficeId } } }
        : {}),
    },
    include: {
      assignment: {
        include: {
          staff: { include: { branchOffice: true } },
          vehicle: true,
          jobSite: { include: { branchOffice: true } },
        },
      },
    },
  });

  // 現場 (jobSite) で集約
  type Row = {
    site: {
      id: number;
      siteCode: string;
      name: string;
      clientCode: string | null;
      clientName: string | null;
      address: string | null;
      siteMemo: string | null;
      genDoMen: string | null;
      transportation: string | null;
      branchOffice: { name: string; color: string };
    };
    staffNames: string[];
    vehicles: string[];
  };
  const map = new Map<number, Row>();
  for (const d of days) {
    const site = d.assignment.jobSite;
    const r =
      map.get(site.id) ||
      {
        site: {
          id: site.id,
          siteCode: site.siteCode,
          name: site.name,
          clientCode: site.clientCode,
          clientName: site.clientName,
          address: site.address,
          siteMemo: site.siteMemo,
          genDoMen: site.genDoMen,
          transportation: site.transportation,
          branchOffice: site.branchOffice,
        },
        staffNames: [],
        vehicles: [],
      };
    if (d.assignment.staff) {
      r.staffNames.push(d.assignment.staff.name);
    }
    if (d.assignment.vehicle) {
      r.vehicles.push(
        d.assignment.vehicle.plateNumber +
          (d.assignment.vehicle.name ? ` (${d.assignment.vehicle.name})` : ""),
      );
    }
    map.set(site.id, r);
  }

  // 得意先(親)→現場(子) 順で並べる
  const rows = Array.from(map.values()).sort((a, b) => {
    const ac = a.site.clientCode || "";
    const bc = b.site.clientCode || "";
    if (ac !== bc) return ac.localeCompare(bc);
    const an = a.site.clientName || "";
    const bn = b.site.clientName || "";
    if (an !== bn) return an.localeCompare(bn);
    return a.site.name.localeCompare(b.site.name);
  });

  return (
    <WorkReportShell branches={branches} initialDate={date} initialBranchId={branchOfficeId ?? null}>
      <article className="mx-auto max-w-[297mm] bg-white p-6 text-[12px] leading-relaxed text-black">
        <header className="border-b-2 border-black pb-2 mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-bold">配置日報</h1>
          <div className="text-sm">
            {format(parseISO(date), "yyyy年 M月 d日 (E)", { locale: ja })}
            {branchOfficeId && (
              <span className="ml-2 text-xs text-gray-600">
                ({branches.find((b) => b.id === branchOfficeId)?.name})
              </span>
            )}
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="py-8 text-center text-gray-500">該当する配置はありません</div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-500 px-2 py-1.5 w-[12%]">得意先<br />コード</th>
                <th className="border border-gray-500 px-2 py-1.5 w-[15%]">得意先名</th>
                <th className="border border-gray-500 px-2 py-1.5 w-[10%]">現場<br />コード</th>
                <th className="border border-gray-500 px-2 py-1.5">現場名</th>
                <th className="border border-gray-500 px-2 py-1.5 w-[8%]">人数</th>
                <th className="border border-gray-500 px-2 py-1.5">作業員</th>
                <th className="border border-gray-500 px-2 py-1.5 w-[10%]">車両</th>
                <th className="border border-gray-500 px-2 py-1.5 w-[15%]">現場メモ / 原動面</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.site.id}>
                  <td className="border border-gray-400 px-2 py-1.5 text-center font-mono">
                    {r.site.clientCode || "-"}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5">{r.site.clientName || "-"}</td>
                  <td className="border border-gray-400 px-2 py-1.5 text-center font-mono">
                    {r.site.siteCode}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5">
                    <div className="font-medium">{r.site.name}</div>
                    {r.site.address && (
                      <div className="text-[9px] text-gray-600">{r.site.address}</div>
                    )}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-center tabular-nums">
                    {r.staffNames.length}名
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5">
                    {r.staffNames.join("、") || "-"}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-[9px]">
                    {r.vehicles.length > 0 ? r.vehicles.join(", ") : "-"}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-[9px] whitespace-pre-wrap">
                    {[r.site.siteMemo, r.site.genDoMen].filter(Boolean).join("\n") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="mt-4 text-[10px] text-gray-500">
          発行日: {format(new Date(), "yyyy年M月d日", { locale: ja })}
        </footer>
      </article>
    </WorkReportShell>
  );
}
