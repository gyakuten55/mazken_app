import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ===== 営業所 =====
  const branches = await Promise.all([
    prisma.branchOffice.create({
      data: { name: "本社", code: "HQ", color: "#7C3AED", sortOrder: 0 },
    }),
    prisma.branchOffice.create({
      data: { name: "高瀬営業所", code: "TKS", color: "#059669", sortOrder: 1 },
    }),
    prisma.branchOffice.create({
      data: { name: "草津営業所", code: "KST", color: "#D97706", sortOrder: 2 },
    }),
    prisma.branchOffice.create({
      data: { name: "京都営業所", code: "KYT", color: "#DC2626", sortOrder: 3 },
    }),
  ]);

  const [hq, takase, kusatsu, kyoto] = branches;

  // ===== 資格マスタ =====
  const quals = await Promise.all([
    prisma.qualification.create({ data: { name: "普通自動車免許", category: "license", sortOrder: 0 } }),
    prisma.qualification.create({ data: { name: "大型自動車免許", category: "license", sortOrder: 1 } }),
    prisma.qualification.create({ data: { name: "フルハーネス特別教育", category: "certification", sortOrder: 2 } }),
    prisma.qualification.create({ data: { name: "玉掛け技能講習", category: "certification", sortOrder: 3 } }),
    prisma.qualification.create({ data: { name: "足場組立等作業主任者", category: "certification", sortOrder: 4 } }),
    prisma.qualification.create({ data: { name: "職長・安全衛生責任者", category: "certification", sortOrder: 5 } }),
    prisma.qualification.create({ data: { name: "高所作業車運転", category: "certification", sortOrder: 6 } }),
    prisma.qualification.create({ data: { name: "酸素欠乏危険作業", category: "certification", sortOrder: 7 } }),
  ]);

  // ===== スタッフ (20名) =====
  const staffData = [
    { code: "M001", name: "田中 太郎", kana: "タナカ タロウ", branch: hq.id, insurance: "company", role: "manager", quals: [0,2,3,5] },
    { code: "M002", name: "山本 健一", kana: "ヤマモト ケンイチ", branch: hq.id, insurance: "company", role: "worker", quals: [0,1,2,3,4] },
    { code: "M003", name: "佐藤 修", kana: "サトウ オサム", branch: hq.id, insurance: "company", role: "worker", quals: [0,2,3] },
    { code: "M004", name: "鈴木 大輔", kana: "スズキ ダイスケ", branch: hq.id, insurance: "national", role: "worker", quals: [0,2,5,6] },
    { code: "M005", name: "高橋 誠", kana: "タカハシ マコト", branch: hq.id, insurance: "company", role: "worker", quals: [0,1,2,3,4,5] },
    { code: "T001", name: "中村 正義", kana: "ナカムラ マサヨシ", branch: takase.id, insurance: "company", role: "manager", quals: [0,2,3,5] },
    { code: "T002", name: "小林 浩二", kana: "コバヤシ コウジ", branch: takase.id, insurance: "company", role: "worker", quals: [0,2,3] },
    { code: "T003", name: "加藤 勇気", kana: "カトウ ユウキ", branch: takase.id, insurance: "national", role: "worker", quals: [0,2] },
    { code: "T004", name: "吉田 龍平", kana: "ヨシダ リュウヘイ", branch: takase.id, insurance: "company", role: "worker", quals: [0,1,2,3,4,6] },
    { code: "T005", name: "渡辺 光", kana: "ワタナベ ヒカル", branch: takase.id, insurance: "national", role: "worker", quals: [0,2,3] },
    { code: "K001", name: "伊藤 和也", kana: "イトウ カズヤ", branch: kusatsu.id, insurance: "company", role: "manager", quals: [0,1,2,3,5] },
    { code: "K002", name: "松本 拓海", kana: "マツモト タクミ", branch: kusatsu.id, insurance: "company", role: "worker", quals: [0,2,4] },
    { code: "K003", name: "井上 翔太", kana: "イノウエ ショウタ", branch: kusatsu.id, insurance: "national", role: "worker", quals: [0,2] },
    { code: "K004", name: "木村 達也", kana: "キムラ タツヤ", branch: kusatsu.id, insurance: "company", role: "worker", quals: [0,2,3,6,7] },
    { code: "K005", name: "林 大地", kana: "ハヤシ ダイチ", branch: kusatsu.id, insurance: "company", role: "worker", quals: [0,1,2,3] },
    { code: "Y001", name: "清水 俊介", kana: "シミズ シュンスケ", branch: kyoto.id, insurance: "company", role: "manager", quals: [0,2,3,5] },
    { code: "Y002", name: "森 健太", kana: "モリ ケンタ", branch: kyoto.id, insurance: "company", role: "worker", quals: [0,2,3,4] },
    { code: "Y003", name: "阿部 雄大", kana: "アベ ユウダイ", branch: kyoto.id, insurance: "national", role: "worker", quals: [0,2] },
    { code: "Y004", name: "池田 慎太郎", kana: "イケダ シンタロウ", branch: kyoto.id, insurance: "company", role: "worker", quals: [0,1,2,3,5,6] },
    { code: "Y005", name: "橋本 亮", kana: "ハシモト リョウ", branch: kyoto.id, insurance: "company", role: "worker", quals: [0,2,3] },
  ];

  const staffRecords = [];
  for (const s of staffData) {
    const staff = await prisma.staff.create({
      data: {
        employeeCode: s.code,
        name: s.name,
        nameKana: s.kana,
        displayName: s.name.split(" ")[0],
        branchOfficeId: s.branch,
        insuranceType: s.insurance,
        role: s.role,
        dailyRate: s.insurance === "company" ? 15000 : 18000,
        phone: `090-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      },
    });

    for (const qi of s.quals) {
      await prisma.staffQualification.create({
        data: { staffId: staff.id, qualificationId: quals[qi].id },
      });
    }

    staffRecords.push(staff);
  }

  // ===== 得意先マスタ =====
  const customers = {
    sef: await prisma.customer.create({
      data: { code: "C001", name: "スリーエフコーポレーション", address: "大阪府大阪市北区梅田3丁目1-3" },
    }),
    daishin: await prisma.customer.create({
      data: { code: "C002", name: "ダイシン物流", address: "大阪府堺市堺区南花田口町2丁3-20" },
    }),
    sakura: await prisma.customer.create({
      data: { code: "C003", name: "さくら美創", address: "滋賀県高島市今津町今津1559" },
    }),
    shuei: await prisma.customer.create({
      data: { code: "C004", name: "シューエイ" },
    }),
    higashinana: await prisma.customer.create({
      data: { code: "C005", name: "東七建設", address: "京都府京都市下京区四条通烏丸東入長刀鉾町20" },
    }),
    toyotsu: await prisma.customer.create({
      data: { code: "C006", name: "豊津建設" },
    }),
    hieiDenki: await prisma.customer.create({
      data: { code: "C007", name: "比叡電気工業" },
    }),
  };

  // ===== 現場 (8件) — customerId で得意先マスタへ紐付け =====
  // clientCode/clientName は API 経由作成時は自動同期されるが、seed では明示的に設定
  const sites = await Promise.all([
    prisma.jobSite.create({
      data: {
        siteCode: "S001",
        customerId: customers.sef.id,
        clientCode: customers.sef.code,
        name: "スリーエフ 梅田案件",
        clientName: customers.sef.name,
        branchOfficeId: hq.id,
        address: "大阪府大阪市北区梅田3丁目1-3",
        contactName1: "岡村",
        contactTel1: "06-1234-5678",
        belongings: "ヘルメット、安全靴、手袋",
        requiredHeadcount: 3,
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        status: "active",
      },
    }),
    prisma.jobSite.create({
      data: {
        siteCode: "S002",
        customerId: customers.daishin.id,
        clientCode: customers.daishin.code,
        name: "ダイシン物流 ネカムラ",
        clientName: customers.daishin.name,
        branchOfficeId: hq.id,
        address: "大阪府堺市堺区南花田口町2丁3-20",
        contactName1: "中村",
        contactTel1: "072-2345-6789",
        requiredHeadcount: 5,
        startDate: "2026-03-10",
        endDate: "2026-05-31",
        status: "active",
      },
    }),
    prisma.jobSite.create({
      data: {
        siteCode: "S003",
        customerId: customers.sakura.id,
        clientCode: customers.sakura.code,
        name: "さくら美創 今津工場",
        clientName: customers.sakura.name,
        branchOfficeId: takase.id,
        address: "滋賀県高島市今津町今津1559",
        contactName1: "佐々木",
        contactTel1: "0740-12-3456",
        startDate: "2026-03-15",
        endDate: "2026-07-31",
        status: "active",
      },
    }),
    prisma.jobSite.create({
      data: {
        siteCode: "S004",
        customerId: customers.shuei.id,
        clientCode: customers.shuei.code,
        name: "シューエイ 名神",
        clientName: customers.shuei.name,
        branchOfficeId: kusatsu.id,
        address: "滋賀県草津市野路東1丁目1-1",
        contactName1: "田村",
        contactTel1: "077-345-6789",
        startDate: "2026-04-01",
        endDate: "2026-08-31",
        status: "active",
      },
    }),
    prisma.jobSite.create({
      data: {
        siteCode: "S005",
        customerId: customers.daishin.id,
        clientCode: customers.daishin.code,
        name: "ダイシン物流 横取り",
        clientName: customers.daishin.name,
        branchOfficeId: hq.id,
        address: "大阪府東大阪市長堂1丁目8-37",
        contactName1: "横山",
        contactTel1: "06-9876-5432",
        startDate: "2026-03-20",
        endDate: "2026-05-15",
        status: "active",
      },
    }),
    prisma.jobSite.create({
      data: {
        siteCode: "S006",
        customerId: customers.higashinana.id,
        clientCode: customers.higashinana.code,
        name: "東七建設 下京区",
        clientName: customers.higashinana.name,
        branchOfficeId: kyoto.id,
        address: "京都府京都市下京区四条通烏丸東入長刀鉾町20",
        contactName1: "東",
        contactTel1: "075-123-4567",
        startDate: "2026-03-01",
        endDate: "2026-09-30",
        status: "active",
      },
    }),
    prisma.jobSite.create({
      data: {
        siteCode: "S007",
        customerId: customers.toyotsu.id,
        clientCode: customers.toyotsu.code,
        name: "豊津建設 中ノ島",
        clientName: customers.toyotsu.name,
        branchOfficeId: takase.id,
        address: "滋賀県高島市マキノ町中庄147",
        contactName1: "豊田",
        contactTel1: "0740-56-7890",
        startDate: "2026-04-01",
        endDate: "2026-06-30",
        status: "active",
      },
    }),
    prisma.jobSite.create({
      data: {
        siteCode: "S008",
        customerId: customers.hieiDenki.id,
        clientCode: customers.hieiDenki.code,
        name: "比叡電気工業 瀬田",
        clientName: customers.hieiDenki.name,
        branchOfficeId: kusatsu.id,
        address: "滋賀県大津市瀬田1丁目1-1",
        contactName1: "比叡",
        contactTel1: "077-567-8901",
        startDate: "2026-03-15",
        endDate: "2026-05-31",
        status: "active",
      },
    }),
  ]);

  // ===== 配置 + assignment_days =====
  // Helper to generate date range
  function dateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
      const day = cur.getDay();
      if (day !== 0) { // skip Sundays
        dates.push(cur.toISOString().split("T")[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  const assignmentData = [
    // 本社スタッフ
    { staff: 0, site: 0, start: "2026-03-23", end: "2026-04-26", type: "commute" },
    { staff: 1, site: 0, start: "2026-03-23", end: "2026-04-26", type: "commute" },
    { staff: 2, site: 1, start: "2026-03-23", end: "2026-04-19", type: "commute" },
    { staff: 3, site: 1, start: "2026-03-23", end: "2026-04-19", type: "commute" },
    { staff: 4, site: 4, start: "2026-03-23", end: "2026-04-12", type: "business_trip" },
    // 高瀬営業所スタッフ
    { staff: 5, site: 2, start: "2026-03-23", end: "2026-04-26", type: "commute" },
    { staff: 6, site: 2, start: "2026-03-23", end: "2026-04-26", type: "commute" },
    { staff: 7, site: 6, start: "2026-04-01", end: "2026-04-26", type: "commute" },
    { staff: 8, site: 0, start: "2026-03-25", end: "2026-04-05", type: "business_trip" },
    { staff: 9, site: 6, start: "2026-04-01", end: "2026-04-19", type: "commute" },
    // 草津営業所スタッフ
    { staff: 10, site: 3, start: "2026-04-01", end: "2026-04-26", type: "commute" },
    { staff: 11, site: 3, start: "2026-04-01", end: "2026-04-26", type: "commute" },
    { staff: 12, site: 7, start: "2026-03-23", end: "2026-04-12", type: "commute" },
    { staff: 13, site: 7, start: "2026-03-23", end: "2026-04-12", type: "commute" },
    { staff: 14, site: 3, start: "2026-04-07", end: "2026-04-26", type: "commute" },
    // 京都営業所スタッフ
    { staff: 15, site: 5, start: "2026-03-23", end: "2026-04-26", type: "commute" },
    { staff: 16, site: 5, start: "2026-03-23", end: "2026-04-26", type: "commute" },
    { staff: 17, site: 5, start: "2026-04-01", end: "2026-04-19", type: "business_trip" },
    { staff: 18, site: 5, start: "2026-03-23", end: "2026-04-12", type: "commute" },
    { staff: 19, site: 1, start: "2026-03-25", end: "2026-04-05", type: "business_trip" },
  ];

  for (const a of assignmentData) {
    const dates = dateRange(a.start, a.end);
    const assignment = await prisma.assignment.create({
      data: {
        staffId: staffRecords[a.staff].id,
        jobSiteId: sites[a.site].id,
        startDate: a.start,
        endDate: a.end,
        assignmentType: a.type,
        startTime: "08:00",
        endTime: "18:00",
      },
    });

    for (const date of dates) {
      await prisma.assignmentDay.create({
        data: {
          assignmentId: assignment.id,
          date,
          status: "scheduled",
        },
      });
    }
  }

  // ===== ユーザー =====
  const password = hashSync("demo1234", 10);
  await Promise.all([
    prisma.user.create({
      data: { username: "admin", passwordHash: password, name: "管理者", role: "admin", branchOfficeId: hq.id },
    }),
    prisma.user.create({
      data: { username: "tanaka", passwordHash: password, name: "田中 太郎", role: "manager", branchOfficeId: hq.id },
    }),
    prisma.user.create({
      data: { username: "nakamura", passwordHash: password, name: "中村 正義", role: "manager", branchOfficeId: takase.id },
    }),
    prisma.user.create({
      data: { username: "viewer", passwordHash: password, name: "閲覧者", role: "viewer", branchOfficeId: hq.id },
    }),
  ]);

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
