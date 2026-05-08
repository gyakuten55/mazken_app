-- AlterTable: staff (add opening balance fields)
ALTER TABLE "staff" ADD COLUMN "openingBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "staff" ADD COLUMN "openingBalanceDate" TEXT;

-- CreateTable
CREATE TABLE "daily_payments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "staffId" INTEGER NOT NULL,
    "site1Id" INTEGER,
    "site1BaseFee" INTEGER NOT NULL DEFAULT 0,
    "site1Driving" INTEGER NOT NULL DEFAULT 0,
    "site1Holiday" INTEGER NOT NULL DEFAULT 0,
    "site1Skill" INTEGER NOT NULL DEFAULT 0,
    "site1Other" INTEGER NOT NULL DEFAULT 0,
    "site1Additional" INTEGER NOT NULL DEFAULT 0,
    "site2Id" INTEGER,
    "site2BaseFee" INTEGER NOT NULL DEFAULT 0,
    "site2Driving" INTEGER NOT NULL DEFAULT 0,
    "site2Holiday" INTEGER NOT NULL DEFAULT 0,
    "site2Skill" INTEGER NOT NULL DEFAULT 0,
    "site2Other" INTEGER NOT NULL DEFAULT 0,
    "site2Additional" INTEGER NOT NULL DEFAULT 0,
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

-- CreateIndex
CREATE UNIQUE INDEX "daily_payments_staffId_date_key" ON "daily_payments"("staffId", "date");
CREATE INDEX "daily_payments_date_idx" ON "daily_payments"("date");
CREATE INDEX "daily_payments_staffId_idx" ON "daily_payments"("staffId");
