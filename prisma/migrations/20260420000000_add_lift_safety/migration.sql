-- AlterTable: daily_payments (add lift columns for both sites, and safetyOffset)
ALTER TABLE "daily_payments" ADD COLUMN "site1Lift" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_payments" ADD COLUMN "site2Lift" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_payments" ADD COLUMN "safetyOffset" INTEGER NOT NULL DEFAULT 0;
