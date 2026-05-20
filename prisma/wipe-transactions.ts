/**
 * 取引データ（配置・配置日・配置手当・日計表・出来高確認書）を全削除する。
 * マスタ（営業所・スタッフ・現場・車両・得意先・資格・ユーザー）は温存。
 *
 * 用途: seed データで作られた日計表の累計残をリセットして「真っさら」にする。
 *
 * 実行:  npx tsx prisma/wipe-transactions.ts
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

  // 削除前カウント
  const [bAssign, bAssignDay, bDp, bWcf, bAllow] = await Promise.all([
    prisma.assignment.count(),
    prisma.assignmentDay.count(),
    prisma.dailyPayment.count(),
    prisma.workCompletionForm.count(),
    prisma.assignmentAllowance.count(),
  ]);
  console.log("削除前:");
  console.log(`  Assignment: ${bAssign}`);
  console.log(`  AssignmentDay: ${bAssignDay}`);
  console.log(`  AssignmentAllowance: ${bAllow}`);
  console.log(`  DailyPayment: ${bDp}`);
  console.log(`  WorkCompletionForm: ${bWcf}`);

  // 依存順に削除。
  // - WorkCompletionForm は jobSiteId 必須・assignmentDayId は nullable なので先に消す
  // - DailyPayment は staffId cascade だが念のため明示
  // - Assignment 削除で AssignmentDay / AssignmentAllowance はカスケード
  const delForms = await prisma.workCompletionForm.deleteMany({});
  const delDp = await prisma.dailyPayment.deleteMany({});
  const delAssign = await prisma.assignment.deleteMany({});

  console.log("\n削除実行:");
  console.log(`  WorkCompletionForm: ${delForms.count}`);
  console.log(`  DailyPayment:       ${delDp.count}`);
  console.log(
    `  Assignment:         ${delAssign.count}  （AssignmentDay / AssignmentAllowance はカスケード削除）`,
  );

  // 残数確認
  const [aAssign, aAssignDay, aDp, aWcf, aAllow, aStaff, aSite] =
    await Promise.all([
      prisma.assignment.count(),
      prisma.assignmentDay.count(),
      prisma.dailyPayment.count(),
      prisma.workCompletionForm.count(),
      prisma.assignmentAllowance.count(),
      prisma.staff.count(),
      prisma.jobSite.count(),
    ]);
  console.log("\n=== 残数 ===");
  console.log(`  Assignment: ${aAssign}`);
  console.log(`  AssignmentDay: ${aAssignDay}`);
  console.log(`  AssignmentAllowance: ${aAllow}`);
  console.log(`  DailyPayment: ${aDp}`);
  console.log(`  WorkCompletionForm: ${aWcf}`);
  console.log(`  Staff: ${aStaff}  JobSite: ${aSite}  （マスタは温存）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
