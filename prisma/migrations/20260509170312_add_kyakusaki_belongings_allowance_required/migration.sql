-- AlterTable
ALTER TABLE "assignments" ADD COLUMN "belongings" TEXT;
ALTER TABLE "assignments" ADD COLUMN "contactName" TEXT;
ALTER TABLE "assignments" ADD COLUMN "contactTel" TEXT;

-- CreateTable
CREATE TABLE "assignment_allowances" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assignmentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'special',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assignment_allowances_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_job_site_qualification_bonuses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobSiteId" INTEGER NOT NULL,
    "qualificationId" INTEGER NOT NULL,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_site_qualification_bonuses_jobSiteId_fkey" FOREIGN KEY ("jobSiteId") REFERENCES "job_sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_site_qualification_bonuses_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "qualifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_job_site_qualification_bonuses" ("bonusAmount", "createdAt", "id", "jobSiteId", "qualificationId", "updatedAt") SELECT "bonusAmount", "createdAt", "id", "jobSiteId", "qualificationId", "updatedAt" FROM "job_site_qualification_bonuses";
DROP TABLE "job_site_qualification_bonuses";
ALTER TABLE "new_job_site_qualification_bonuses" RENAME TO "job_site_qualification_bonuses";
CREATE INDEX "job_site_qualification_bonuses_jobSiteId_idx" ON "job_site_qualification_bonuses"("jobSiteId");
CREATE UNIQUE INDEX "job_site_qualification_bonuses_jobSiteId_qualificationId_key" ON "job_site_qualification_bonuses"("jobSiteId", "qualificationId");
CREATE TABLE "new_job_sites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientCode" TEXT,
    "clientName" TEXT,
    "branchOfficeId" INTEGER NOT NULL,
    "address" TEXT,
    "mapUrl" TEXT,
    "contactName1" TEXT,
    "contactTel1" TEXT,
    "contactName2" TEXT,
    "contactTel2" TEXT,
    "contactName3" TEXT,
    "contactTel3" TEXT,
    "transportation" TEXT,
    "belongings" TEXT,
    "siteMemo" TEXT,
    "genDoMen" TEXT,
    "workerPricingPolicy" TEXT NOT NULL DEFAULT 'possible',
    "dailyRateDorm1" INTEGER,
    "dailyRateDorm2" INTEGER,
    "dailyRateCommuter" INTEGER,
    "startDate" TEXT,
    "endDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "requiredInsurance" TEXT,
    "workCategory" TEXT NOT NULL DEFAULT 'spot',
    "requiredHeadcount" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_sites_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_job_sites" ("address", "branchOfficeId", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "endDate", "id", "name", "notes", "requiredHeadcount", "requiredInsurance", "siteCode", "startDate", "status", "transportation", "updatedAt", "workCategory") SELECT "address", "branchOfficeId", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "endDate", "id", "name", "notes", "requiredHeadcount", "requiredInsurance", "siteCode", "startDate", "status", "transportation", "updatedAt", "workCategory" FROM "job_sites";
DROP TABLE "job_sites";
ALTER TABLE "new_job_sites" RENAME TO "job_sites";
CREATE UNIQUE INDEX "job_sites_siteCode_key" ON "job_sites"("siteCode");
CREATE INDEX "job_sites_branchOfficeId_idx" ON "job_sites"("branchOfficeId");
CREATE INDEX "job_sites_clientCode_idx" ON "job_sites"("clientCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "assignment_allowances_assignmentId_idx" ON "assignment_allowances"("assignmentId");
