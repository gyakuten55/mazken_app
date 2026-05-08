-- RedefineTables: change default of safetyOffset from 0 to 500
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_daily_payments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "staffId" INTEGER NOT NULL,
    "site1Id" INTEGER,
    "site1BaseFee" INTEGER NOT NULL DEFAULT 0,
    "site1Driving" INTEGER NOT NULL DEFAULT 0,
    "site1Holiday" INTEGER NOT NULL DEFAULT 0,
    "site1Lift" INTEGER NOT NULL DEFAULT 0,
    "site1Skill" INTEGER NOT NULL DEFAULT 0,
    "site1Other" INTEGER NOT NULL DEFAULT 0,
    "site1Additional" INTEGER NOT NULL DEFAULT 0,
    "site2Id" INTEGER,
    "site2BaseFee" INTEGER NOT NULL DEFAULT 0,
    "site2Driving" INTEGER NOT NULL DEFAULT 0,
    "site2Holiday" INTEGER NOT NULL DEFAULT 0,
    "site2Lift" INTEGER NOT NULL DEFAULT 0,
    "site2Skill" INTEGER NOT NULL DEFAULT 0,
    "site2Other" INTEGER NOT NULL DEFAULT 0,
    "site2Additional" INTEGER NOT NULL DEFAULT 0,
    "safetyOffset" INTEGER NOT NULL DEFAULT 500,
    "lodgingOffset" INTEGER NOT NULL DEFAULT 0,
    "otherOffset" INTEGER NOT NULL DEFAULT 0,
    "advanceOffset" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_payments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "daily_payments_site1Id_fkey" FOREIGN KEY ("site1Id") REFERENCES "job_sites" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "daily_payments_site2Id_fkey" FOREIGN KEY ("site2Id") REFERENCES "job_sites" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_daily_payments" (
    "id","date","staffId",
    "site1Id","site1BaseFee","site1Driving","site1Holiday","site1Lift","site1Skill","site1Other","site1Additional",
    "site2Id","site2BaseFee","site2Driving","site2Holiday","site2Lift","site2Skill","site2Other","site2Additional",
    "safetyOffset","lodgingOffset","otherOffset","advanceOffset",
    "notes","createdAt","updatedAt"
)
SELECT
    "id","date","staffId",
    "site1Id","site1BaseFee","site1Driving","site1Holiday","site1Lift","site1Skill","site1Other","site1Additional",
    "site2Id","site2BaseFee","site2Driving","site2Holiday","site2Lift","site2Skill","site2Other","site2Additional",
    "safetyOffset","lodgingOffset","otherOffset","advanceOffset",
    "notes","createdAt","updatedAt"
FROM "daily_payments";

DROP TABLE "daily_payments";
ALTER TABLE "new_daily_payments" RENAME TO "daily_payments";

CREATE UNIQUE INDEX "daily_payments_staffId_date_key" ON "daily_payments"("staffId", "date");
CREATE INDEX "daily_payments_date_idx" ON "daily_payments"("date");
CREATE INDEX "daily_payments_staffId_idx" ON "daily_payments"("staffId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
