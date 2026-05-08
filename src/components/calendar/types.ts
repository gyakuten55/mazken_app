export type AssignmentDay = {
  id: number;
  date: string;
  status: string;
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
  notes: string | null;
  jobSite: {
    id: number;
    name: string;
    siteCode: string;
    clientName?: string | null;
    notes?: string | null;
    workCategory?: string;
    branchOffice: { color: string; name: string };
  };
  vehicle?: {
    id: number;
    plateNumber: string;
    name: string | null;
  } | null;
  assignmentDays: AssignmentDay[];
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
  count: number;
};

export type BranchOffice = { id: number; name: string; color: string; code: string };

export type ContextMenu = {
  x: number;
  y: number;
  assignment: Assignment;
  staffId: number | null; // null=未割当
  date: string;
};
