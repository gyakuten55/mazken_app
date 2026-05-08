-- CreateTable
CREATE TABLE "branch_offices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "staff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeCode" TEXT NOT NULL,
    "branchOfficeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "insuranceType" TEXT NOT NULL DEFAULT 'company',
    "role" TEXT NOT NULL DEFAULT 'worker',
    "dailyRate" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "licenseExpiry" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "staff_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staff_qualifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffId" INTEGER NOT NULL,
    "qualificationId" INTEGER NOT NULL,
    "expiryDate" TEXT,
    CONSTRAINT "staff_qualifications_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_qualifications_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "qualifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_sites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "branchOfficeId" INTEGER NOT NULL,
    "address" TEXT,
    "contactName1" TEXT,
    "contactTel1" TEXT,
    "contactName2" TEXT,
    "contactTel2" TEXT,
    "contactName3" TEXT,
    "contactTel3" TEXT,
    "transportation" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "requiredInsurance" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_sites_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffId" INTEGER NOT NULL,
    "jobSiteId" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'commute',
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00',
    "dailyRateOverride" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assignments_jobSiteId_fkey" FOREIGN KEY ("jobSiteId") REFERENCES "job_sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignment_days" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assignmentId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startTime" TEXT,
    "endTime" TEXT,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "dailyRateOverride" INTEGER,
    "notes" TEXT,
    CONSTRAINT "assignment_days_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_completion_forms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assignmentDayId" INTEGER,
    "jobSiteId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "workContent" TEXT,
    "quantity" TEXT,
    "unit" TEXT,
    "staffNames" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "clientSignature" TEXT,
    "clientName" TEXT,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_completion_forms_assignmentDayId_fkey" FOREIGN KEY ("assignmentDayId") REFERENCES "assignment_days" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_completion_forms_jobSiteId_fkey" FOREIGN KEY ("jobSiteId") REFERENCES "job_sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'office',
    "branchOfficeId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_offices_code_key" ON "branch_offices"("code");

-- CreateIndex
CREATE UNIQUE INDEX "qualifications_name_key" ON "qualifications"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_employeeCode_key" ON "staff"("employeeCode");

-- CreateIndex
CREATE INDEX "staff_branchOfficeId_idx" ON "staff"("branchOfficeId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_qualifications_staffId_qualificationId_key" ON "staff_qualifications"("staffId", "qualificationId");

-- CreateIndex
CREATE UNIQUE INDEX "job_sites_siteCode_key" ON "job_sites"("siteCode");

-- CreateIndex
CREATE INDEX "job_sites_branchOfficeId_idx" ON "job_sites"("branchOfficeId");

-- CreateIndex
CREATE INDEX "assignments_staffId_idx" ON "assignments"("staffId");

-- CreateIndex
CREATE INDEX "assignments_jobSiteId_idx" ON "assignments"("jobSiteId");

-- CreateIndex
CREATE INDEX "assignments_startDate_endDate_idx" ON "assignments"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "assignment_days_date_idx" ON "assignment_days"("date");

-- CreateIndex
CREATE INDEX "assignment_days_status_idx" ON "assignment_days"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_days_assignmentId_date_key" ON "assignment_days"("assignmentId", "date");

-- CreateIndex
CREATE INDEX "work_completion_forms_date_idx" ON "work_completion_forms"("date");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
