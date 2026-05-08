export const INSURANCE_TYPES = {
  company: "社保",
  national: "国保",
  sole_proprietor: "一人親方",
} as const;

export const RESIDENCE_TYPES = {
  dorm1: "寮生1",
  dorm2: "寮生2",
  commuter: "通い",
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
} as const;

export const USER_ROLES = {
  admin: "管理者",
  manager: "所長",
  office: "事務",
  viewer: "閲覧",
  staff: "スタッフ",
} as const;

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
