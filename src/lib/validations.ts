import { z } from "zod";

// Common patterns
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式はYYYY-MM-DDで入力してください");
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "時間形式はHH:MMで入力してください");
const positiveInt = z.number().int().positive();

// --- Staff ---

export const createStaffSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  nameKana: z.string().min(1, "フリガナは必須です"),
  employeeCode: z.string().min(1, "社員コードは必須です"),
  branchOfficeId: positiveInt,
  displayName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  insuranceType: z.enum(["company", "national", "sole_proprietor"]).default("company"), // [DEPRECATED] 互換用
  hasShaho: z.boolean().optional(),
  hasKokuho: z.boolean().optional(),
  hasIchiriOyakata: z.boolean().optional(),
  // C-4: 対応可能な作業区分（築炉/レギュラー/スポット）
  canChikuro: z.boolean().optional(),
  canRegular: z.boolean().optional(),
  canSpot: z.boolean().optional(),
  residenceType: z.enum(["dorm1", "dorm2", "commuter"]).default("commuter"),
  role: z.enum(["admin", "manager", "office", "worker"]).default("worker"),
  dailyRate: z.number().int().nullable().optional(),
  licenseExpiry: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  qualificationIds: z.array(z.number().int()).optional(),
});

export const updateStaffSchema = createStaffSchema.partial().extend({
  qualificationIds: z.array(z.number().int()).optional(),
});

// --- Customer (得意先) ---

export const createCustomerSchema = z.object({
  code: z.string().nullable().optional(),
  name: z.string().min(1, "得意先名は必須です"),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// --- JobSite ---

export const createJobSiteSchema = z.object({
  siteCode: z.string().min(1, "現場コードは必須です"),
  name: z.string().min(1, "現場名は必須です"),
  branchOfficeId: positiveInt,
  // M-1: 得意先(親)→現場(子)の階層を必ず保持するため customerId は必須。
  // 編集は updateJobSiteSchema(.partial())で任意になるため既存挙動を壊さない。
  customerId: positiveInt,
  clientCode: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  mapUrl: z.string().nullable().optional(),
  contactName1: z.string().nullable().optional(),
  contactTel1: z.string().nullable().optional(),
  contactName2: z.string().nullable().optional(),
  contactTel2: z.string().nullable().optional(),
  contactName3: z.string().nullable().optional(),
  contactTel3: z.string().nullable().optional(),
  transportation: z.string().nullable().optional(),
  belongings: z.string().nullable().optional(),
  siteMemo: z.string().nullable().optional(),
  genDoMen: z.string().nullable().optional(),
  workerPricingPolicy: z.enum(["possible", "impossible", "case_by_case"]).default("possible"),
  dailyRateDorm1: z.number().int().min(0).nullable().optional(),
  dailyRateDorm2: z.number().int().min(0).nullable().optional(),
  dailyRateCommuter: z.number().int().min(0).nullable().optional(),
  startDate: dateString.nullable().optional(),
  endDate: dateString.nullable().optional(),
  requiredInsurance: z.enum(["any", "company_only", "national_only"]).nullable().optional(),
  workCategory: z.enum(["chikuro", "regular", "spot"]).default("spot"),
  requiredHeadcount: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  qualificationBonuses: z.array(z.object({
    qualificationId: positiveInt,
    bonusAmount: z.number().int().min(0),
    isRequired: z.boolean().optional(),
  })).optional(),
});

export const updateJobSiteSchema = createJobSiteSchema.partial().extend({
  status: z.enum(["active", "completed", "cancelled"]).optional(),
});

// --- Assignment ---

// 配置単位の加算手当（路内・出張・食事・とび 等）
const allowanceSchema = z.object({
  name: z.string().min(1, "手当名を入力してください"),
  amount: z.number().int().min(0),
  category: z.enum(["special", "other"]).default("special"),
  // 一括配置で「この手当は一部スタッフだけに適用」したいときに使う。
  // 空配列 / 未指定なら staffIds 全員に適用される。
  targetStaffIds: z.array(positiveInt).optional(),
});

export const createAssignmentSchema = z.object({
  staffId: positiveInt.nullable().optional(), // null=未割当（後からスタッフを当てる）
  jobSiteId: positiveInt,
  vehicleId: z.number().int().nullable().optional(),
  startDate: dateString,
  endDate: dateString,
  assignmentType: z.enum(["commute", "business_trip"]).default("commute"),
  shiftType: z.enum(["day", "night"]).default("day"),
  startTime: timeString.default("08:00"),
  endTime: timeString.default("18:00"),
  dailyRateOverride: z.number().int().min(0).nullable().optional(),
  orderHeadcount: z.number().int().min(0).nullable().optional(),
  belongings: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactTel: z.string().nullable().optional(),
  transportation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  allowances: z.array(allowanceSchema).optional(),
  force: z.boolean().optional(),
}).refine(
  (data) => data.startDate <= data.endDate,
  { message: "開始日は終了日以前にしてください", path: ["endDate"] }
);

export const bulkAssignmentSchema = z.object({
  staffIds: z.array(positiveInt).min(1, "スタッフを選択してください"),
  jobSiteId: positiveInt,
  vehicleId: z.number().int().nullable().optional(),
  startDate: dateString,
  endDate: dateString,
  assignmentType: z.enum(["commute", "business_trip"]).default("commute"),
  shiftType: z.enum(["day", "night"]).default("day"),
  startTime: timeString.default("08:00"),
  endTime: timeString.default("18:00"),
  // 単一作成と同じ任意フィールド。指定された値は全スタッフ共通でコピーされる
  dailyRateOverride: z.number().int().min(0).nullable().optional(),
  orderHeadcount: z.number().int().min(0).nullable().optional(),
  belongings: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactTel: z.string().nullable().optional(),
  transportation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  allowances: z.array(allowanceSchema).optional(),
  force: z.boolean().optional(),
}).refine(
  (data) => data.startDate <= data.endDate,
  { message: "開始日は終了日以前にしてください", path: ["endDate"] }
);

export const updateAssignmentSchema = z.object({
  staffId: positiveInt.nullable().optional(), // 未割当→割当 / 割当解除に使う
  assignmentType: z.enum(["commute", "business_trip"]).optional(),
  shiftType: z.enum(["day", "night"]).optional(),
  startTime: timeString.optional(),
  endTime: timeString.optional(),
  vehicleId: z.number().int().nullable().optional(),
  dailyRateOverride: z.number().int().min(0).nullable().optional(),
  belongings: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactTel: z.string().nullable().optional(),
  transportation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  allowances: z.array(allowanceSchema).optional(),
  force: z.boolean().optional(),
});

// --- BranchOffice (営業所) ---

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB の形式で指定してください");

export const createBranchOfficeSchema = z.object({
  name: z.string().min(1, "営業所名は必須です").max(100),
  code: z
    .string()
    .min(1, "営業所コードは必須です")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "コードは半角英数・ハイフン・アンダースコアのみ使えます"),
  color: hexColor,
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateBranchOfficeSchema = createBranchOfficeSchema.partial();

// --- Vehicle ---

export const createVehicleSchema = z.object({
  plateNumber: z.string().min(1, "車両ナンバーは必須です").max(50),
  name: z.string().nullable().optional(),
  vehicleType: z.string().nullable().optional(),
  inspectionDate: dateString.nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const moveAssignmentSchema = z.object({
  newStaffId: positiveInt.optional(),
  dayShift: z.number().int().optional(),
  force: z.boolean().optional(),
});

export const assignmentDayPatchSchema = z.object({
  status: z.enum(["scheduled", "cancelled", "completed", "pre_declined"]).optional(),
  acknowledged: z.boolean().optional(),
  dailyRateOverride: z.number().int().min(0).nullable().optional(),
  orderHeadcount: z.number().int().min(0).nullable().optional(),
}).refine(
  (data) =>
    data.status !== undefined ||
    data.acknowledged !== undefined ||
    data.dailyRateOverride !== undefined ||
    data.orderHeadcount !== undefined,
  { message: "status / acknowledged / dailyRateOverride / orderHeadcount のいずれかを指定してください" }
);

// 配置全期間の status を一括変更（事前断りトグルなど）
export const assignmentBulkStatusSchema = z.object({
  status: z.enum(["scheduled", "cancelled", "completed", "pre_declined"]),
});

// --- WorkCompletionForm ---

export const createFormSchema = z.object({
  jobSiteId: positiveInt,
  date: dateString,
  assignmentDayId: z.number().int().nullable().optional(),
  workContent: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  staffNames: z.string().nullable().optional(),
  startTime: timeString.nullable().optional(),
  endTime: timeString.nullable().optional(),
  overtimeHours: z.number().min(0).default(0),
  clientSignature: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  isSubmitted: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export const updateFormSchema = createFormSchema.partial();

// --- Auth ---

export const loginSchema = z.object({
  username: z.string().min(1, "ユーザー名は必須です").max(100),
  password: z.string().min(1, "パスワードは必須です").max(200),
});

// --- CSV Export ---

export const csvExportSchema = z.object({
  startDate: dateString,
  endDate: dateString,
  branchOfficeIds: z.array(z.number()).optional(),
  columns: z.array(z.string()).optional(),
});

// --- Utility ---

export function parseId(value: string): number | null {
  const num = parseInt(value, 10);
  return isNaN(num) || num <= 0 ? null : num;
}
