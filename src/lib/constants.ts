export const INSURANCE_TYPES = {
  company: "社保",
  national: "国保",
  sole_proprietor: "一人親方",
} as const;

export const RESIDENCE_TYPES = {
  dorm1: "旧寮",
  dorm2: "新寮",
  commuter: "通い",
} as const;

// 寮区分ごとの 1日あたりスタッフ負担額（日計表の lodgingOffset として自動加算）
export const RESIDENCE_DAILY_COST: Record<keyof typeof RESIDENCE_TYPES, number> = {
  dorm1: 1950,
  dorm2: 1350,
  commuter: 0,
};

// 路内手当などのプリセット名称（AssignmentAllowance.name の入力サジェスト）
export const ALLOWANCE_PRESETS = [
  { name: "路内手当", category: "special" as const, defaultAmount: 1500 },
  { name: "とび手当", category: "special" as const, defaultAmount: 0 },
  { name: "出張手当", category: "other" as const, defaultAmount: 0 },
  { name: "食事手当", category: "other" as const, defaultAmount: 0 },
] as const;

export const ALLOWANCE_CATEGORIES = {
  special: "特殊",
  other: "他",
} as const;

export const WORK_CATEGORIES = {
  chikuro: "築炉工事",
  regular: "レギュラー",
  spot: "スポット",
} as const;

export const WORK_CATEGORY_COLORS: Record<keyof typeof WORK_CATEGORIES, string> = {
  chikuro: "#dc2626",   // red-600
  regular: "#2563eb",   // blue-600
  spot: "#64748b",      // slate-500
};

export const ASSIGNMENT_TYPES = {
  commute: "通い",
  business_trip: "出張",
} as const;

export const SITE_STATUSES = {
  active: "進行中",
  completed: "完了",
  cancelled: "中止",
} as const;

export const DAY_STATUS = {
  scheduled: "予定",
  cancelled: "休み",
  completed: "完了",
  pre_declined: "事前断り",
} as const;

// 必要人数の合計から除外するステータス（事前断り・キャンセル）
export const HEADCOUNT_EXCLUDED_STATUSES: ReadonlyArray<keyof typeof DAY_STATUS> = [
  "pre_declined",
  "cancelled",
];

// 5/20 デモ向けは 3 ロール構成（admin / office / staff）。
// manager / viewer は DB 上は残るが UI では選択不可。
export const USER_ROLES = {
  admin: "管理者",
  manager: "所長",
  office: "ユーザー1（お金関連以外OK）",
  viewer: "閲覧",
  staff: "個人",
} as const;

// UI で選択可能なロール（プルダウン等で使う）
export const SELECTABLE_USER_ROLES = ["admin", "office", "staff"] as const;
export type SelectableUserRole = (typeof SELECTABLE_USER_ROLES)[number];

// 作業員ごとの単価請求ポリシー
export const WORKER_PRICING_POLICIES = {
  possible: "可",
  impossible: "不可",
  case_by_case: "都度相談",
} as const;
export type WorkerPricingPolicy = keyof typeof WORKER_PRICING_POLICIES;

// Type helpers for constants keys
export type InsuranceType = keyof typeof INSURANCE_TYPES;
export type ResidenceType = keyof typeof RESIDENCE_TYPES;
export type WorkCategory = keyof typeof WORK_CATEGORIES;
export type AssignmentType = keyof typeof ASSIGNMENT_TYPES;
export type SiteStatus = keyof typeof SITE_STATUSES;
export type DayStatus = keyof typeof DAY_STATUS;
export type UserRole = keyof typeof USER_ROLES;

export const NAV_ITEMS = [
  { href: "/calendar", label: "カレンダー", icon: "Calendar" },
  { href: "/staff", label: "スタッフ", icon: "Users" },
  { href: "/sites", label: "現場", icon: "Building2" },
  { href: "/vehicles", label: "車両管理", icon: "Truck" },
  { href: "/forms", label: "出来高請求書", icon: "FileText" },
  { href: "/export", label: "CSV出力", icon: "Download" },
] as const;

// 印刷ページで現場名 / 元請名を 2 文字 + 2 段表示する際のロジック共通関数
export function twoCharLabel(value: string | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  const normalized = value.trim();
  if (normalized.length === 0) return fallback;
  return Array.from(normalized).slice(0, 2).join("");
}
