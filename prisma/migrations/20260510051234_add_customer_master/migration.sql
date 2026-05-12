-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_job_sites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" INTEGER,
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
    CONSTRAINT "job_sites_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "job_sites_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_job_sites" ("address", "belongings", "branchOfficeId", "clientCode", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "dailyRateCommuter", "dailyRateDorm1", "dailyRateDorm2", "endDate", "genDoMen", "id", "mapUrl", "name", "notes", "requiredHeadcount", "requiredInsurance", "siteCode", "siteMemo", "startDate", "status", "transportation", "updatedAt", "workCategory", "workerPricingPolicy") SELECT "address", "belongings", "branchOfficeId", "clientCode", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "dailyRateCommuter", "dailyRateDorm1", "dailyRateDorm2", "endDate", "genDoMen", "id", "mapUrl", "name", "notes", "requiredHeadcount", "requiredInsurance", "siteCode", "siteMemo", "startDate", "status", "transportation", "updatedAt", "workCategory", "workerPricingPolicy" FROM "job_sites";
DROP TABLE "job_sites";
ALTER TABLE "new_job_sites" RENAME TO "job_sites";
CREATE UNIQUE INDEX "job_sites_siteCode_key" ON "job_sites"("siteCode");
CREATE INDEX "job_sites_branchOfficeId_idx" ON "job_sites"("branchOfficeId");
CREATE INDEX "job_sites_customerId_idx" ON "job_sites"("customerId");
CREATE INDEX "job_sites_clientCode_idx" ON "job_sites"("clientCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");
