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
    "workCategory" TEXT NOT NULL DEFAULT 'spot',
    "requiredHeadcount" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_sites_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- 既存の workCategory='other' を 'spot' に移行しながらコピー
INSERT INTO "new_job_sites" ("address", "branchOfficeId", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "endDate", "id", "name", "notes", "requiredHeadcount", "requiredInsurance", "siteCode", "startDate", "status", "transportation", "updatedAt", "workCategory") SELECT "address", "branchOfficeId", "clientName", "contactName1", "contactName2", "contactName3", "contactTel1", "contactTel2", "contactTel3", "createdAt", "endDate", "id", "name", "notes", "requiredHeadcount", "requiredInsurance", "siteCode", "startDate", "status", "transportation", "updatedAt", CASE WHEN "workCategory" = 'other' THEN 'spot' ELSE "workCategory" END FROM "job_sites";
DROP TABLE "job_sites";
ALTER TABLE "new_job_sites" RENAME TO "job_sites";
CREATE UNIQUE INDEX "job_sites_siteCode_key" ON "job_sites"("siteCode");
CREATE INDEX "job_sites_branchOfficeId_idx" ON "job_sites"("branchOfficeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
