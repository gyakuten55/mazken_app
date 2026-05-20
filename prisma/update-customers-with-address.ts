/**
 * 既存 Customer に Excel の住所・電話・担当者・備考を「補完」する更新スクリプト。
 *
 * 削除はせず、code 一致でフィールド更新のみ。
 *
 * 入力: data/得意先台帳（R8.4.23現在）.xls (「一覧」シート)
 * 列マッピング:
 *   col 0:  コード
 *   col 1:  得意先名
 *   col 2:  フリガナ
 *   col 49: 備考
 *   col 77: 代表者名
 *   col 80: 担当者名
 *   col 82: 担当者携帯
 *   col 83: 郵便番号
 *   col 84: 住所
 *   col 85: TEL
 *   col 86: FAX
 *
 *   既存 notes は職種・単価サマリで上書きされていたので、
 *   注意書きを残しつつ Excel 備考 + 担当者 + 代表者 を追記する。
 *
 * 実行: npx tsx prisma/update-customers-with-address.ts [--dry-run]
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

function nz(s: unknown): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t ? t : null;
}

async function main() {
  const target = process.env.TURSO_DATABASE_URL ? "Turso (本番)" : "ローカル dev.db";
  console.log(`\n========================================`);
  console.log(`得意先 住所・連絡先 補完`);
  console.log(`対象 DB: ${target}`);
  console.log(`DRY RUN: ${DRY_RUN ? "YES" : "NO"}`);
  console.log(`========================================\n`);

  const wb = XLSX.readFile("data/得意先台帳（R8.4.23現在）.xls");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["一覧"], {
    header: 1,
    defval: null,
    raw: false,
  });

  // 既存得意先を code で索引化
  const existing = await prisma.customer.findMany();
  const byCode = new Map(existing.map((c) => [c.code ?? "", c]));
  console.log(`既存得意先: ${existing.length} 件\n`);

  let matched = 0;
  let updated = 0;
  let skippedNoMatch = 0;
  const samples: Array<{ code: string; name: string; address: string | null; phone: string | null }> = [];

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const code = nz(r[0]);
    const name = nz(r[1]);
    if (!code || !name) continue;

    const cust = byCode.get(code);
    if (!cust) {
      skippedNoMatch++;
      continue;
    }
    matched++;

    const zip = nz(r[83]);
    const address = nz(r[84]);
    const tel = nz(r[85]);
    const fax = nz(r[86]);
    const representative = nz(r[77]);
    const contact = nz(r[80]);
    const contactPhone = nz(r[82]);
    const memo49 = nz(r[49]);
    const memo48 = nz(r[48]); // 特記事項（請求）

    // 住所は「郵便番号 + 住所」を結合
    const fullAddress =
      [zip ? `〒${zip.replace(/^〒/, "")}` : null, address].filter(Boolean).join(" ") || null;

    // 備考に代表者・担当者・FAX を追記（既存 notes を残す形）
    const noteAdditions: string[] = [];
    if (representative) noteAdditions.push(`代表者: ${representative}`);
    if (contact && contact !== representative) {
      noteAdditions.push(
        `担当者: ${contact}${contactPhone ? ` (${contactPhone})` : ""}`,
      );
    }
    if (fax) noteAdditions.push(`FAX: ${fax}`);
    if (memo48) noteAdditions.push(`特記: ${memo48}`);
    if (memo49) noteAdditions.push(`備考: ${memo49}`);

    const mergedNotes =
      [cust.notes, noteAdditions.length ? noteAdditions.join("\n") : null]
        .filter(Boolean)
        .join("\n---\n") || null;

    if (samples.length < 5) {
      samples.push({ code, name, address: fullAddress, phone: tel });
    }

    if (DRY_RUN) continue;

    await prisma.customer.update({
      where: { id: cust.id },
      data: {
        address: fullAddress ?? cust.address,
        phone: tel ?? cust.phone,
        notes: mergedNotes,
      },
    });
    updated++;
  }

  console.log("--- サンプル (先頭 5 件) ---");
  for (const s of samples) {
    console.log(`  [${s.code}] ${s.name}`);
    console.log(`    住所: ${s.address ?? "(空)"}`);
    console.log(`    TEL:  ${s.phone ?? "(空)"}`);
  }
  console.log("");

  console.log(`一致: ${matched} 件`);
  console.log(`更新: ${updated} 件${DRY_RUN ? " (dry-run のため実行せず)" : ""}`);
  console.log(`未一致 (skip): ${skippedNoMatch} 件\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
