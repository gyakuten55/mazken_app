-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_job_sites" (
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
    "workCategory" TEXT NOT NULL DEFAULT 'other',
    "requiredHeadcount" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_sites_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_job_sites" ("address", "branchOfficeId", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "endDate", "id", "name", "notes", "requiredInsurance", "siteCode", "startDate", "status", "transportation", "updatedAt") SELECT "address", "branchOfficeId", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "endDate", "id", "name", "notes", "requiredInsurance", "siteCode", "startDate", "status", "transportation", "updatedAt" FROM "job_sites";
DROP TABLE "job_sites";
ALTER TABLE "new_job_sites" RENAME TO "job_sites";
CREATE UNIQUE INDEX "job_sites_siteCode_key" ON "job_sites"("siteCode");
CREATE INDEX "job_sites_branchOfficeId_idx" ON "job_sites"("branchOfficeId");
CREATE TABLE "new_staff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeCode" TEXT NOT NULL,
    "branchOfficeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "insuranceType" TEXT NOT NULL DEFAULT 'company',
    "residenceType" TEXT NOT NULL DEFAULT 'commuter',
    "role" TEXT NOT NULL DEFAULT 'worker',
    "dailyRate" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "licenseExpiry" TEXT,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "openingBalanceDate" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "staff_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_staff" ("branchOfficeId", "createdAt", "dailyRate", "displayName", "employeeCode", "id", "insuranceType", "isActive", "licenseExpiry", "name", "nameKana", "notes", "openingBalance", "openingBalanceDate", "phone", "role", "updatedAt") SELECT "branchOfficeId", "createdAt", "dailyRate", "displayName", "employeeCode", "id", "insuranceType", "isActive", "licenseExpiry", "name", "nameKana", "notes", "openingBalance", "openingBalanceDate", "phone", "role", "updatedAt" FROM "staff";
DROP TABLE "staff";
ALTER TABLE "new_staff" RENAME TO "staff";
CREATE UNIQUE INDEX "staff_employeeCode_key" ON "staff"("employeeCode");
CREATE INDEX "staff_branchOfficeId_idx" ON "staff"("branchOfficeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
