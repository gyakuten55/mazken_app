// 既存の JobSite.clientCode / clientName から Customer マスタを作成し、
// 各 JobSite を customerId で参照するように移行する。
// 同じ clientName / clientCode の組合わせは 1 つの Customer に集約。
//
// 実行: npx tsx prisma/backfill-customers.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.jobSite.findMany({
    where: { customerId: null },
    select: { id: true, clientCode: true, clientName: true },
  });

  console.log(`Found ${sites.length} sites without customerId`);

  // (clientCode || "") + "|" + (clientName || "") で集約キー作成
  const groups = new Map<string, { code: string | null; name: string; siteIds: number[] }>();
  for (const s of sites) {
    if (!s.clientName && !s.clientCode) continue; // 名前もコードもない場合はスキップ
    const key = `${s.clientCode ?? ""}|${s.clientName ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.siteIds.push(s.id);
    } else {
      groups.set(key, {
        code: s.clientCode ?? null,
        name: s.clientName ?? "(名称未設定)",
        siteIds: [s.id],
      });
    }
  }

  console.log(`Will create ${groups.size} customers`);

  for (const [key, group] of groups) {
    // 既存 Customer を code or name で探す
    let customer = group.code
      ? await prisma.customer.findUnique({ where: { code: group.code } })
      : null;
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { name: group.name, code: group.code ?? null },
      });
    }
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          code: group.code ?? null,
          name: group.name,
        },
      });
      console.log(`  + Created customer "${customer.name}" (code: ${customer.code ?? "-"})`);
    } else {
      console.log(`  ~ Reusing customer "${customer.name}" (id: ${customer.id})`);
    }

    await prisma.jobSite.updateMany({
      where: { id: { in: group.siteIds } },
      data: { customerId: customer.id },
    });
    console.log(`    Linked ${group.siteIds.length} sites to customer ${customer.id} (key=${key})`);
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
