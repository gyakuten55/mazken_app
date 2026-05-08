-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_staff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeCode" TEXT NOT NULL,
    "branchOfficeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "insuranceType" TEXT NOT NULL DEFAULT 'company',
    "hasShaho" BOOLEAN NOT NULL DEFAULT false,
    "hasKokuho" BOOLEAN NOT NULL DEFAULT false,
    "hasIchiriOyakata" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_staff" ("branchOfficeId", "createdAt", "dailyRate", "displayName", "employeeCode", "id", "insuranceType", "isActive", "licenseExpiry", "name", "nameKana", "notes", "openingBalance", "openingBalanceDate", "phone", "residenceType", "role", "updatedAt") SELECT "branchOfficeId", "createdAt", "dailyRate", "displayName", "employeeCode", "id", "insuranceType", "isActive", "licenseExpiry", "name", "nameKana", "notes", "openingBalance", "openingBalanceDate", "phone", "residenceType", "role", "updatedAt" FROM "staff";
DROP TABLE "staff";
ALTER TABLE "new_staff" RENAME TO "staff";
CREATE UNIQUE INDEX "staff_employeeCode_key" ON "staff"("employeeCode");
CREATE INDEX "staff_branchOfficeId_idx" ON "staff"("branchOfficeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 既存 insuranceType を 3 Bool に移行
UPDATE "staff" SET "hasShaho" = 1 WHERE "insuranceType" = 'company';
UPDATE "staff" SET "hasKokuho" = 1 WHERE "insuranceType" = 'national';
UPDATE "staff" SET "hasIchiriOyakata" = 1 WHERE "insuranceType" = 'sole_proprietor';
