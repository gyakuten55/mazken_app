/**
 * マツケンさん実データ取り込みスクリプト。
 *
 *  入力:
 *   - data/作業員名簿（R8.5.15現在）.xlsx
 *   - data/得意先台帳（R8.4.23現在）.xls
 *
 *  処理:
 *   1. 取引データ (Assignment / AssignmentDay / AssignmentAllowance / DailyPayment / WorkCompletionForm) を全削除
 *   2. マスタ (Customer / JobSite / Staff / Vehicle / StaffQualification / JobSiteQualificationBonus) を全削除
 *   3. 営業所マスタは既存 (守口/守口第二/高瀬/橋波) を維持
 *   4. xlsx を読み取り、Customer / Staff / Qualification / StaffQualification を投入
 *
 *  ユーザー/監査ログ/営業所/Qualification マスタは温存（admin ユーザは消さない）。
 *
 *  実行:  npx tsx prisma/import-matsken-data.ts [--dry-run]
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const DRY_RUN = process.argv.includes("--dry-run");

const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSQL({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : undefined;

const prisma = adapter ? new PrismaClient({ adapter }) : new PrismaClient();

// =====================================================================
// 営業所マッピング: シート名 → 営業所コード
// =====================================================================
const BRANCH_MAP: Record<
  string,
  { branchCode: string; insurance: "shaho" | "kokuho" | "intern"; label: string }
> = {
  // 社保加入
  守口社保: { branchCode: "MRG", insurance: "shaho", label: "守口" },
  守口第二社保: { branchCode: "MRG2", insurance: "shaho", label: "守口第二" },
  "高瀬社保 ": { branchCode: "TKS", insurance: "shaho", label: "高瀬" }, // 末尾空白
  高瀬社保: { branchCode: "TKS", insurance: "shaho", label: "高瀬" },
  橋波社保: { branchCode: "HSN", insurance: "shaho", label: "橋波" },
  // 実習生
  守口実習生: { branchCode: "MRG", insurance: "intern", label: "守口" },
  守口第二実習生: { branchCode: "MRG2", insurance: "intern", label: "守口第二" },
  // 一般 (国保デフォルト)
  守口: { branchCode: "MRG", insurance: "kokuho", label: "守口" },
  守口第二: { branchCode: "MRG2", insurance: "kokuho", label: "守口第二" },
  高瀬: { branchCode: "TKS", insurance: "kokuho", label: "高瀬" },
  橋波: { branchCode: "HSN", insurance: "kokuho", label: "橋波" },
};

// =====================================================================
// 入力パース
// =====================================================================
function parseYen(s: unknown): number | null {
  if (s == null) return null;
  if (typeof s === "number") return Math.round(s);
  const str = String(s).replace(/[¥,\s]/g, "");
  if (!str || str === "-") return null;
  const n = Number(str);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function nz(s: unknown): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t ? t : null;
}

type StaffRow = {
  no: string | null;
  employeeCode: string;
  nameKana: string;
  name: string;
  phone: string | null;
  dailyRate: number | null;
  hasShaho: boolean;
  hasKokuho: boolean;
  hasIchiriOyakata: boolean;
  branchCode: string;
  qualifications: string[]; // 取得済みの資格名
};

function readStaffSheet(
  sheetName: string,
  rows: unknown[][],
  options: { branchCode: string; insurance: "shaho" | "kokuho" | "intern" },
  internSeqStart: number,
): StaffRow[] {
  const out: StaffRow[] = [];
  let internSeq = internSeqStart;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const name = nz(r[3]);
    const nameKana = nz(r[2]) ?? name ?? "";
    if (!name) continue;
    let code = nz(r[1]);
    if (!code) {
      // 実習生はコード未発行 → 自動採番 "TR-{branchCode}-{seq}"
      code = `TR-${options.branchCode}-${internSeq}`;
      internSeq++;
    }
    const phone = nz(r[4]);
    const dailyRate = parseYen(r[5]);
    // 資格列（col 6 以降を全部回収、null は除外）
    const quals = r
      .slice(6)
      .map((v) => nz(v))
      .filter((v): v is string => !!v);
    out.push({
      no: nz(r[0]),
      employeeCode: code,
      nameKana,
      name,
      phone,
      dailyRate,
      hasShaho: options.insurance === "shaho",
      hasKokuho: options.insurance === "kokuho",
      hasIchiriOyakata: false,
      branchCode: options.branchCode,
      qualifications: quals,
    });
  }
  return out;
}

type CustomerRow = {
  code: string;
  name: string;
  nameKana: string | null;
  notes: string | null;
};

function readCustomerSheet(rows: unknown[][]): CustomerRow[] {
  // row[0] = タイトル, row[1] = ヘッダ, row[2..] = データ
  const out: CustomerRow[] = [];
  const seenCodes = new Set<string>();
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const code = nz(r[0]);
    const name = nz(r[1]);
    if (!code || !name) continue;
    if (seenCodes.has(code)) continue; // 重複コードはスキップ
    seenCodes.add(code);

    // notes に職種・単価の概要を要約してまとめる
    const noteParts: string[] = [];
    for (let j = 0; j < 6; j++) {
      const baseIdx = 3 + j * 5;
      const jobType = nz(r[baseIdx]);
      const dayPrice = nz(r[baseIdx + 1]);
      const nightPrice = nz(r[baseIdx + 3]);
      if (jobType) {
        noteParts.push(
          `${jobType}: 昼${dayPrice ?? "-"} / 夜${nightPrice ?? "-"}`,
        );
      }
    }
    // 末尾セル群の備考も拾う（消費税率、請求方針等）
    const memo = nz(r[33]) ?? nz(r[34]) ?? "";

    out.push({
      code,
      name,
      nameKana: nz(r[2]),
      notes: [noteParts.join("\n"), memo].filter(Boolean).join("\n---\n") || null,
    });
  }
  return out;
}

// =====================================================================
// メイン
// =====================================================================
async function main() {
  const target = process.env.TURSO_DATABASE_URL ? "Turso (本番)" : "ローカル dev.db";
  console.log(`\n========================================`);
  console.log(`マツケン実データ取り込み`);
  console.log(`対象 DB: ${target}`);
  console.log(`DRY RUN: ${DRY_RUN ? "YES (DB変更なし)" : "NO (実行)"}`);
  console.log(`========================================\n`);

  // ---- 1. Excel ファイル読み込み ----
  console.log("[1] Excel ファイル読み込み...");
  const staffWb = XLSX.readFile("data/作業員名簿（R8.5.15現在）.xlsx");
  const customerWb = XLSX.readFile("data/得意先台帳（R8.4.23現在）.xls");

  // スタッフ
  const allStaff: StaffRow[] = [];
  let internSeq = 1;
  for (const sheetName of staffWb.SheetNames) {
    const cfg = BRANCH_MAP[sheetName];
    if (!cfg) {
      console.log(`  -- スキップ: 不明シート "${sheetName}"`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(staffWb.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: false,
    });
    const parsed = readStaffSheet(sheetName, rows, cfg, internSeq);
    if (cfg.insurance === "intern") {
      internSeq += parsed.length;
    }
    console.log(`  ${sheetName.padEnd(16)} → ${parsed.length}名`);
    allStaff.push(...parsed);
  }
  console.log(`  合計: ${allStaff.length}名\n`);

  // 得意先
  const customerRows = XLSX.utils.sheet_to_json<unknown[]>(
    customerWb.Sheets["一覧"],
    { header: 1, defval: null, raw: false },
  );
  const customers = readCustomerSheet(customerRows);
  console.log(`[2] 得意先一覧シート: ${customers.length}社\n`);

  // 営業所 (DB既存) の検証
  const branches = await prisma.branchOffice.findMany();
  const branchByCode = new Map(branches.map((b) => [b.code, b]));
  for (const code of ["MRG", "MRG2", "TKS", "HSN"]) {
    if (!branchByCode.has(code)) {
      throw new Error(`営業所マスタに ${code} が存在しません。/settings 画面で先に登録してください`);
    }
  }
  console.log(
    `[3] 営業所マスタ確認: ${branches.map((b) => `${b.code}=${b.name}`).join(", ")}\n`,
  );

  if (DRY_RUN) {
    console.log("DRY-RUN モード: ここまでで終了します（DB変更なし）");
    console.log("\n--- スタッフサンプル ---");
    console.log(allStaff.slice(0, 3));
    console.log("\n--- 得意先サンプル ---");
    console.log(customers.slice(0, 3));
    console.log("\n--- 投入予定 ---");
    console.log(`  Staff:    ${allStaff.length}名`);
    console.log(`  Customer: ${customers.length}社`);
    console.log(`  Qualification: ${new Set(allStaff.flatMap((s) => s.qualifications)).size}種`);
    await prisma.$disconnect();
    return;
  }

  // ---- 削除: 取引データ + マスタ ----
  console.log("[4] 既存データを削除中...");
  // 順序重要: 外部キー制約があるので依存元から削除
  const deletions = await prisma.$transaction(async (tx) => {
    const a = await tx.assignmentAllowance.deleteMany({});
    const b = await tx.assignmentDay.deleteMany({});
    const c = await tx.assignment.deleteMany({});
    const d = await tx.dailyPayment.deleteMany({});
    const e = await tx.workCompletionForm.deleteMany({});
    const f = await tx.staffQualification.deleteMany({});
    const g = await tx.jobSiteQualificationBonus.deleteMany({});
    const h = await tx.jobSite.deleteMany({});
    // ユーザーが staffId 経由でスタッフに紐付いていると Staff 削除でエラー
    // → 一旦 user.staffId を null にしてから Staff 削除
    await tx.user.updateMany({ where: { staffId: { not: null } }, data: { staffId: null } });
    const i = await tx.staff.deleteMany({});
    const j = await tx.customer.deleteMany({});
    const k = await tx.vehicle.deleteMany({});
    return { a, b, c, d, e, f, g, h, i, j, k };
  }, { timeout: 60000, maxWait: 30000 });
  console.log("  削除完了:");
  console.log(`    AssignmentAllowance: ${deletions.a.count}`);
  console.log(`    AssignmentDay: ${deletions.b.count}`);
  console.log(`    Assignment: ${deletions.c.count}`);
  console.log(`    DailyPayment: ${deletions.d.count}`);
  console.log(`    WorkCompletionForm: ${deletions.e.count}`);
  console.log(`    StaffQualification: ${deletions.f.count}`);
  console.log(`    JobSiteQualificationBonus: ${deletions.g.count}`);
  console.log(`    JobSite: ${deletions.h.count}`);
  console.log(`    Staff: ${deletions.i.count}`);
  console.log(`    Customer: ${deletions.j.count}`);
  console.log(`    Vehicle: ${deletions.k.count}`);
  console.log("");

  // ---- 投入: 資格マスタ ----
  console.log("[5] 資格マスタを準備...");
  const qualSet = new Set<string>();
  for (const s of allStaff) for (const q of s.qualifications) qualSet.add(q);
  const existingQuals = await prisma.qualification.findMany();
  const qualByName = new Map(existingQuals.map((q) => [q.name, q]));
  let qualCreated = 0;
  for (const qname of qualSet) {
    if (!qualByName.has(qname)) {
      const created = await prisma.qualification.create({
        data: { name: qname, category: "other", sortOrder: 0 },
      });
      qualByName.set(qname, created);
      qualCreated++;
    }
  }
  console.log(`  資格: 新規 ${qualCreated} / 合計 ${qualByName.size} 種\n`);

  // ---- 投入: 得意先 ----
  console.log("[6] 得意先を投入...");
  let cinserted = 0;
  for (const c of customers) {
    try {
      await prisma.customer.create({
        data: {
          code: c.code,
          name: c.name,
          notes: c.notes,
          isActive: true,
        },
      });
      cinserted++;
    } catch (e) {
      console.log(`  ⚠ 失敗 code=${c.code} name=${c.name}: ${(e as Error).message}`);
    }
  }
  console.log(`  Customer: ${cinserted} 件投入\n`);

  // ---- 投入: スタッフ + 資格紐付け ----
  console.log("[7] スタッフを投入...");
  let sinserted = 0;
  const seenStaffCodes = new Set<string>();
  for (const s of allStaff) {
    if (seenStaffCodes.has(s.employeeCode)) {
      console.log(`  ⚠ コード重複でスキップ: ${s.employeeCode} (${s.name})`);
      continue;
    }
    seenStaffCodes.add(s.employeeCode);
    const branch = branchByCode.get(s.branchCode);
    if (!branch) {
      console.log(`  ⚠ 営業所未定でスキップ: ${s.branchCode}`);
      continue;
    }
    const qualIds = s.qualifications
      .map((q) => qualByName.get(q)?.id)
      .filter((id): id is number => !!id);
    try {
      await prisma.staff.create({
        data: {
          employeeCode: s.employeeCode,
          branchOfficeId: branch.id,
          name: s.name,
          nameKana: s.nameKana,
          phone: s.phone,
          dailyRate: s.dailyRate,
          hasShaho: s.hasShaho,
          hasKokuho: s.hasKokuho,
          hasIchiriOyakata: s.hasIchiriOyakata,
          residenceType: "commuter",
          role: "worker",
          isActive: true,
          staffQualifications: qualIds.length
            ? { create: qualIds.map((qid) => ({ qualificationId: qid })) }
            : undefined,
        },
      });
      sinserted++;
    } catch (e) {
      console.log(
        `  ⚠ 失敗 code=${s.employeeCode} name=${s.name}: ${(e as Error).message}`,
      );
    }
  }
  console.log(`  Staff: ${sinserted} 名投入\n`);

  console.log(`========================================`);
  console.log(`完了！対象 DB: ${target}`);
  console.log(`  得意先:      ${cinserted} 件`);
  console.log(`  スタッフ:    ${sinserted} 名`);
  console.log(`  資格マスタ:  ${qualByName.size} 種`);
  console.log(`========================================\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("エラー:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
