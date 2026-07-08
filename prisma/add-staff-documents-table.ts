import "dotenv/config";
import { createClient } from "@libsql/client";

// S-2: Turso 本番に staff_documents テーブルを作成（CREATE TABLE・非破壊）。冪等。
const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL が未設定です");
  process.exit(1);
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

async function main() {
  // 既存テーブル確認
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='staff_documents'",
  );
  if (tables.rows.length > 0) {
    console.log("スキップ: staff_documents は既に存在");
  } else {
    await client.execute(`
      CREATE TABLE "staff_documents" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "staffId" INTEGER NOT NULL,
        "name" TEXT NOT NULL,
        "mimeType" TEXT NOT NULL,
        "size" INTEGER NOT NULL DEFAULT 0,
        "data" BLOB NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "staff_documents_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    console.log("作成: staff_documents テーブル");
  }
  // インデックス（IF NOT EXISTS で冪等化）
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "staff_documents_staffId_idx" ON "staff_documents"("staffId")`,
  );
  console.log("インデックス OK: staff_documents_staffId_idx");

  // 検証
  const cols = await client.execute("PRAGMA table_info(staff_documents)");
  console.log("\n検証 — staff_documents 列:", cols.rows.map((r) => String(r.name)).join(", "));
  const count = await client.execute("SELECT COUNT(*) AS n FROM staff_documents");
  console.log("行数:", count.rows[0].n);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
