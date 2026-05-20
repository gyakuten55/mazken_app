// 売上分解表（営業所ごとに 1 ページ生成）— v2 layout (画像と同じ罫線・15行枠・合計行)
// 画像のフォーマットを再現:
//   ヘッダ:  売上分解表 / 令和X年X月X日 (曜日) / No.___/___ / 作業員名
//   列:      №/現場名/箇所/人数/職種/備考/追加作業費/交通費/作業員名
//   合計行:  合計 / 営業所名 / (集計値) / サイン
// 配置 (Assignment) の当日 scheduled な日 (AssignmentDay) を現場単位で集約して出力。
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BreakdownShell } from "./breakdown-shell";

// 作業員名欄のグリッドサイズ (5列 × 2行 = 10枠/行)
const STAFF_GRID_COLS = 5;
const STAFF_GRID_ROWS = 2;
const STAFF_GRID_SIZE = STAFF_GRID_COLS * STAFF_GRID_ROWS;

type SearchParams = Promise<{ date?: string; branchOfficeId?: string }>;

// 令和の変換（西暦 - 2018）
function toReiwaParts(d: Date) {
  return {
    year: d.getFullYear() - 2018,
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

// 苗字だけ取り出す（「中村 正義」→「中村」）
function lastName(fullName: string): string {
  return fullName.split(/[\s 　]/)[0] || fullName;
}

const ROWS_PER_PAGE = 15; // 画像と同じ 15 行枠 + 合計

export default async function BreakdownPage({
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
          jobSite: { include: { branchOffice: true } },
          allowances: true,
        },
      },
    },
  });

  type SiteRow = {
    siteId: number;
    siteName: string;
    siteMemo: string | null;
    address: string | null;
    staffNames: string[];
    headcount: number;
    extraWork: number;
    transport: number;
    notes: string[];
  };
  type BranchGroup = {
    branchId: number;
    branchName: string;
    rows: SiteRow[];
  };
  const branchMap = new Map<number, BranchGroup>();

  for (const d of days) {
    const site = d.assignment.jobSite;
    const branch = site.branchOffice;
    let group = branchMap.get(branch.id);
    if (!group) {
      group = { branchId: branch.id, branchName: branch.name, rows: [] };
      branchMap.set(branch.id, group);
    }
    let row = group.rows.find((r) => r.siteId === site.id);
    if (!row) {
      row = {
        siteId: site.id,
        siteName: site.name,
        siteMemo: site.siteMemo,
        address: site.address,
        staffNames: [],
        headcount: 0,
        extraWork: 0,
        transport: 0,
        notes: [],
      };
      group.rows.push(row);
    }

    if (d.assignment.staff) {
      const ln = lastName(d.assignment.staff.name);
      if (!row.staffNames.includes(ln)) row.staffNames.push(ln);
    }
    row.headcount += 1;

    for (const al of d.assignment.allowances) {
      if (al.category === "special") row.extraWork += al.amount;
      else if (al.category === "other") row.transport += al.amount;
    }

    if (d.assignment.notes && !row.notes.includes(d.assignment.notes)) {
      row.notes.push(d.assignment.notes);
    }
  }

  const branchList = branches
    .filter((b) => branchOfficeId == null || b.id === branchOfficeId)
    .filter((b) => branchMap.has(b.id) || branchOfficeId != null)
    .map(
      (b) =>
        branchMap.get(b.id) ?? {
          branchId: b.id,
          branchName: b.name,
          rows: [],
        },
    );

  return (
    <BreakdownShell
      branches={branches}
      initialDate={date}
      initialBranchId={branchOfficeId ?? null}
    >
      {branchList.length === 0 ? (
        <article className="mx-auto max-w-[297mm] bg-white p-6 text-black">
          <div className="py-8 text-center text-gray-500">
            該当する配置はありません
          </div>
        </article>
      ) : (
        branchList.map((group) => (
          <BreakdownPageOne key={group.branchId} group={group} date={date} />
        ))
      )}
    </BreakdownShell>
  );
}

function BreakdownPageOne({
  group,
  date,
}: {
  group: {
    branchId: number;
    branchName: string;
    rows: {
      siteId: number;
      siteName: string;
      siteMemo: string | null;
      address: string | null;
      staffNames: string[];
      headcount: number;
      extraWork: number;
      transport: number;
      notes: string[];
    }[];
  };
  date: string;
}) {
  const d = parseISO(date);
  const reiwa = toReiwaParts(d);
  const weekday = format(d, "E", { locale: ja });

  // 表示用に最大 15 行に切り詰め（多い場合は別ページ）。
  // ここでは画像と同じ 1 ページ 15 行を厳守。
  const dataRows = group.rows.slice(0, ROWS_PER_PAGE);
  const emptyCount = Math.max(0, ROWS_PER_PAGE - dataRows.length);

  return (
    <article className="breakdown-page mx-auto max-w-[297mm] bg-white p-5 mb-4 text-black">
      {/* タイトル & 日付行 — 画像と同じ並び */}
      <div className="flex items-end justify-between mb-2 pb-1">
        <h1 className="text-2xl font-bold tracking-[0.3em] pl-2">
          売上分解表
        </h1>
        <div className="text-base flex items-baseline gap-1">
          <span>令和</span>
          <span className="inline-block min-w-[1.5em] text-center border-b border-black">
            {reiwa.year}
          </span>
          <span>年</span>
          <span className="inline-block min-w-[1.5em] text-center border-b border-black">
            {reiwa.month}
          </span>
          <span>月</span>
          <span className="inline-block min-w-[1.5em] text-center border-b border-black">
            {reiwa.day}
          </span>
          <span>日</span>
          <span className="ml-1">({weekday})</span>
        </div>
        <div className="text-sm flex items-baseline gap-1">
          <span>No.</span>
          <span className="inline-block min-w-[3em] border-b border-black">
            &nbsp;
          </span>
          <span>/</span>
          <span className="inline-block min-w-[3em] border-b border-black">
            &nbsp;
          </span>
        </div>
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border-2 border-black px-1 py-2 w-[5%] font-normal bg-gray-50">
              №
            </th>
            <th className="border-2 border-black px-1 py-2 w-[15%] font-normal bg-gray-50">
              現　場　名
            </th>
            <th className="border-2 border-black px-1 py-2 w-[15%] font-normal bg-gray-50">
              箇　　所
            </th>
            <th className="border-2 border-black px-1 py-2 w-[6%] font-normal bg-gray-50">
              人数
            </th>
            <th className="border-2 border-black px-1 py-2 w-[7%] font-normal bg-gray-50">
              職種
            </th>
            <th className="border-2 border-black px-1 py-2 w-[9%] font-normal bg-gray-50">
              備　考
            </th>
            <th className="border-2 border-black px-1 py-2 w-[9%] font-normal bg-gray-50">
              追加作業費
            </th>
            <th className="border-2 border-black px-1 py-2 w-[9%] font-normal bg-gray-50">
              交通費
            </th>
            <th className="border-2 border-black px-1 py-2 font-normal bg-gray-50">
              作　業　員　名
            </th>
          </tr>
        </thead>
        <tbody>
          {dataRows.map((r, idx) => (
            <tr key={r.siteId} style={{ height: "32px" }}>
              <td className="border-2 border-black px-1 text-center font-mono text-[12px]">
                {idx + 1}
              </td>
              <td className="border-2 border-black px-1.5 text-[11px]">
                {r.siteName}
              </td>
              <td className="border-2 border-black px-1.5 text-[11px]">
                {r.siteMemo || r.address || ""}
              </td>
              <td className="border-2 border-black px-1 text-center tabular-nums text-[11px]">
                {r.headcount} 人工
              </td>
              <td className="border-2 border-black px-1 text-center text-[11px]">
                人工
              </td>
              <td className="border-2 border-black px-1 text-[10px] whitespace-pre-wrap">
                {r.notes.join("\n")}
              </td>
              <td className="border-2 border-black px-1 text-right tabular-nums text-[11px]">
                {r.extraWork > 0 ? r.extraWork.toLocaleString("ja-JP") : ""}
              </td>
              <td className="border-2 border-black px-1 text-right tabular-nums text-[11px]">
                {r.transport > 0 ? r.transport.toLocaleString("ja-JP") : ""}
              </td>
              {/* 作業員名: 5列×2行のグリッド（画像と同じ） */}
              <td className="border-2 border-black p-0 align-top">
                <div
                  className="grid h-full"
                  style={{
                    gridTemplateColumns: `repeat(${STAFF_GRID_COLS}, minmax(0, 1fr))`,
                    minHeight: "32px",
                  }}
                >
                  {Array.from({ length: STAFF_GRID_SIZE }).map((_, i) => {
                    const colIdx = i % STAFF_GRID_COLS;
                    const rowIdx = Math.floor(i / STAFF_GRID_COLS);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "px-0.5 text-center text-[10px] flex items-center justify-center",
                          colIdx < STAFF_GRID_COLS - 1 && "border-r border-black",
                          rowIdx < STAFF_GRID_ROWS - 1 && "border-b border-black",
                        )}
                      >
                        {r.staffNames[i] ?? ""}
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
          {/* 残りの行を空枠で埋める（紙の罫線として残す） */}
          {Array.from({ length: emptyCount }).map((_, i) => (
            <tr key={`empty-${i}`} style={{ height: "32px" }}>
              <td className="border-2 border-black px-1 text-center font-mono text-[12px] text-gray-400">
                {dataRows.length + i + 1}
              </td>
              <td className="border-2 border-black">&nbsp;</td>
              <td className="border-2 border-black">&nbsp;</td>
              <td className="border-2 border-black">&nbsp;</td>
              <td className="border-2 border-black">&nbsp;</td>
              <td className="border-2 border-black">&nbsp;</td>
              <td className="border-2 border-black">&nbsp;</td>
              <td className="border-2 border-black">&nbsp;</td>
              <td className="border-2 border-black p-0 align-top">
                <div
                  className="grid h-full"
                  style={{
                    gridTemplateColumns: `repeat(${STAFF_GRID_COLS}, minmax(0, 1fr))`,
                    minHeight: "32px",
                  }}
                >
                  {Array.from({ length: STAFF_GRID_SIZE }).map((_, j) => {
                    const colIdx = j % STAFF_GRID_COLS;
                    const rowIdx = Math.floor(j / STAFF_GRID_COLS);
                    return (
                      <div
                        key={j}
                        className={cn(
                          colIdx < STAFF_GRID_COLS - 1 && "border-r border-black",
                          rowIdx < STAFF_GRID_ROWS - 1 && "border-b border-black",
                        )}
                      />
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
          {/* 合計行: 「合計」「営業所名」+ 残り空欄（数値は手書き想定） / サイン欄 */}
          <tr style={{ height: "36px" }}>
            <td className="border-2 border-black px-1 text-center font-bold text-[12px] bg-gray-50">
              合計
            </td>
            <td
              className="border-2 border-black px-2 text-center font-bold text-[12px] bg-gray-50"
              colSpan={2}
            >
              {group.branchName}営業所
            </td>
            <td className="border-2 border-black">&nbsp;</td>
            <td className="border-2 border-black">&nbsp;</td>
            <td className="border-2 border-black">&nbsp;</td>
            <td className="border-2 border-black">&nbsp;</td>
            <td className="border-2 border-black">&nbsp;</td>
            <td className="border-2 border-black px-2 text-[11px] text-gray-600">
              サイン
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
