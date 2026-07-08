export type AssignmentDay = {
  id: number;
  date: string;
  status: string; // "scheduled" | "cancelled" | "completed" | "pre_declined"
  dailyRateOverride?: number | null;
  orderHeadcount?: number | null;
};

export type AssignmentAllowance = {
  id?: number;
  name: string;
  amount: number;
  category: "special" | "other";
  // 一括 / 複数スタッフ作成時の対象。空配列 / 未指定 = 選択中スタッフ全員に適用。
  targetStaffIds?: number[];
};

export type Assignment = {
  id: number;
  staffId: number | null; // null=未割当（現場枠だけ確保した状態）
  vehicleId?: number | null;
  startDate?: string; // YYYY-MM-DD（未割当割当UIで期間検索に使う）
  endDate?: string;
  assignmentType: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  dailyRateOverride?: number | null;
  belongings?: string | null;
  contactName?: string | null;
  contactTel?: string | null;
  transportation?: string | null;
  notes: string | null;
  jobSite: {
    id: number;
    name: string;
    siteCode: string;
    clientCode?: string | null;
    clientName?: string | null;
    address?: string | null;
    notes?: string | null;
    workCategory?: string;
    requiredHeadcount?: number | null;
    belongings?: string | null;
    siteMemo?: string | null;
    genDoMen?: string | null;
    mapUrl?: string | null;
    transportation?: string | null;
    workerPricingPolicy?: string | null; // "possible" / "impossible" / "case_by_case"
    branchOffice: { color: string; name: string };
  };
  vehicle?: {
    id: number;
    plateNumber: string;
    name: string | null;
  } | null;
  assignmentDays: AssignmentDay[];
  allowances?: AssignmentAllowance[];
};

export type StaffRow = {
  id: number;
  employeeCode: string;
  name: string;
  displayName: string | null;
  insuranceType: string;
  branchOffice: { id: number; name: string; color: string; code: string };
  assignments: Assignment[];
};

export type HeadcountData = { date: string; total: number };

export type HeadcountBySite = {
  date: string;
  jobSiteId: number;
  siteName: string;
  count: number; // 配置数（scheduled・見割当含む / 事前断り除外）
  preDeclinedCount?: number; // 事前断りの枠数（合計には入れず内訳に残す）
};

export type BranchOffice = { id: number; name: string; color: string; code: string };

export type ContextMenu = {
  x: number;
  y: number;
  assignment: Assignment;
  staffId: number | null; // null=未割当
  date: string;
};
