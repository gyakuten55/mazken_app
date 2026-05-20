/**
 * 営業所マスタを新体制に差し替えるワンショットスクリプト。
 *
 * 実行: npx tsx prisma/replace-branches.ts
 *
 * 動作:
 *   1. 4 営業所を確定（守口/高瀬/守口第二/橋波）
 *      - 既存 TKS は「高瀬」にリネーム＆ピンク化
 *      - MRG/MRG2/HSN は upsert で作成
 *   2. 旧 3 営業所 (HQ / KST / KYT) に紐付くスタッフ・現場・ユーザーを「守口」に付け替え
 *   3. 空になった旧 3 営業所を削除
 *
 * data lossless（seed スタッフ・現場・配置データはすべて守口配下に保存）。
 * 守口配下のスタッフは UI 側で必要に応じて isActive=false 等にしてください。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSQL({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : undefined;

const prisma = adapter ? new PrismaClient({ adapter }) : new PrismaClient();

async function main() {
  console.log(
    `\n対象 DB: ${process.env.TURSO_DATABASE_URL ? "Turso (本番)" : "ローカル dev.db"}\n`,
  );

  // === A: 4 営業所を確定 ===
  await prisma.branchOffice.update({
    where: { code: "TKS" },
    data: { name: "高瀬", color: "#DB2777", sortOrder: 1 },
  });
  const mrg = await prisma.branchOffice.upsert({
    where: { code: "MRG" },
    update: { name: "守口", color: "#7C3AED", sortOrder: 0 },
    create: { name: "守口", code: "MRG", color: "#7C3AED", sortOrder: 0 },
  });
  await prisma.branchOffice.upsert({
    where: { code: "MRG2" },
    update: { name: "守口第二", color: "#059669", sortOrder: 2 },
    create: { name: "守口第二", code: "MRG2", color: "#059669", sortOrder: 2 },
  });
  await prisma.branchOffice.upsert({
    where: { code: "HSN" },
    update: { name: "橋波", color: "#D97706", sortOrder: 3 },
    create: { name: "橋波", code: "HSN", color: "#D97706", sortOrder: 3 },
  });
  console.log("  ✓ 4 営業所を確定: 守口 / 高瀬 / 守口第二 / 橋波");

  // === B: 旧 3 営業所配下のレコードを守口に付け替え ===
  const old = await prisma.branchOffice.findMany({
    where: { code: { in: ["HQ", "KST", "KYT"] } },
  });
  const oldIds = old.map((b) => b.id);
  if (oldIds.length === 0) {
    console.log("  旧営業所はすでに存在しません");
  } else {
    console.log(`  旧営業所: ${old.map((b) => b.code).join(", ")}`);

    const [staff, sites, users] = await Promise.all([
      prisma.staff.updateMany({
        where: { branchOfficeId: { in: oldIds } },
        data: { branchOfficeId: mrg.id },
      }),
      prisma.jobSite.updateMany({
        where: { branchOfficeId: { in: oldIds } },
        data: { branchOfficeId: mrg.id },
      }),
      prisma.user.updateMany({
        where: { branchOfficeId: { in: oldIds } },
        data: { branchOfficeId: mrg.id },
      }),
    ]);
    console.log(
      `  ✓ 守口へ付け替え: staff=${staff.count} sites=${sites.count} users=${users.count}`,
    );

    const del = await prisma.branchOffice.deleteMany({
      where: { id: { in: oldIds } },
    });
    console.log(`  ✓ 旧営業所を削除: ${del.count} 件`);
  }

  // === C: 最終状態 ===
  const all = await prisma.branchOffice.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  console.log("\n=== 最終状態 ===");
  for (const b of all) {
    console.log(`  [${b.sortOrder}] ${b.name} (${b.code}) ${b.color}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
