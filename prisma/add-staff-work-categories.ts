import "dotenv/config";
import { createClient } from "@libsql/client";

// C-4: staff に作業区分の対応フラグ (canChikuro / canRegular / canSpot) を追加する。
// Turso 本番へ直接 ADD COLUMN（追記のみ・非破壊）。既定 1(true) で既存スタッフの挙動は不変。
// 冪等: 既に存在する列はスキップする。
const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL が未設定です");
  process.exit(1);
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const COLUMNS: { name: string; ddl: string }[] = [
  { name: "canChikuro", ddl: `ALTER TABLE "staff" ADD COLUMN "canChikuro" BOOLEAN NOT NULL DEFAULT true` },
  { name: "canRegular", ddl: `ALTER TABLE "staff" ADD COLUMN "canRegular" BOOLEAN NOT NULL DEFAULT true` },
  { name: "canSpot", ddl: `ALTER TABLE "staff" ADD COLUMN "canSpot" BOOLEAN NOT NULL DEFAULT true` },
];

async function main() {
  const info = await client.execute("PRAGMA table_info(staff)");
  const existing = new Set(info.rows.map((r) => String(r.name)));
  for (const col of COLUMNS) {
    if (existing.has(col.name)) {
      console.log(`スキップ: ${col.name} は既に存在`);
      continue;
    }
    await client.execute(col.ddl);
    console.log(`追加: ${col.name}`);
  }
  // 検証
  const after = await client.execute("PRAGMA table_info(staff)");
  const cols = after.rows.map((r) => String(r.name));
  console.log("\n検証 — staff 列数:", cols.length);
  for (const c of COLUMNS) {
    console.log(`  ${c.name}: ${cols.includes(c.name) ? "OK" : "失敗"}`);
  }
  const sample = await client.execute(
    "SELECT id, name, canChikuro, canRegular, canSpot FROM staff LIMIT 3",
  );
  console.log("\nサンプル:");
  for (const r of sample.rows) {
    console.log(`  id=${r.id} ${r.name} 築炉=${r.canChikuro} レギュラー=${r.canRegular} スポット=${r.canSpot}`);
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
