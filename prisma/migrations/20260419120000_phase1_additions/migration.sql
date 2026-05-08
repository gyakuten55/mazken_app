-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "diff" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "audit_logs_model_recordId_idx" ON "audit_logs"("model", "recordId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AlterTable: users (add loginToken, loginTokenAt)
ALTER TABLE "users" ADD COLUMN "loginToken" TEXT;
ALTER TABLE "users" ADD COLUMN "loginTokenAt" DATETIME;
CREATE UNIQUE INDEX "users_loginToken_key" ON "users"("loginToken");

-- RedefineTables: assignment_days (add acknowledgedAt, acknowledgedBy with FK)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assignment_days" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assignmentId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startTime" TEXT,
    "endTime" TEXT,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "dailyRateOverride" INTEGER,
    "notes" TEXT,
    "acknowledgedAt" DATETIME,
    "acknowledgedBy" INTEGER,
    CONSTRAINT "assignment_days_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_days_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assignment_days" ("assignmentId", "date", "dailyRateOverride", "endTime", "id", "notes", "overtimeHours", "startTime", "status") SELECT "assignmentId", "date", "dailyRateOverride", "endTime", "id", "notes", "overtimeHours", "startTime", "status" FROM "assignment_days";
DROP TABLE "assignment_days";
ALTER TABLE "new_assignment_days" RENAME TO "assignment_days";
CREATE UNIQUE INDEX "assignment_days_assignmentId_date_key" ON "assignment_days"("assignmentId", "date");
CREATE INDEX "assignment_days_date_idx" ON "assignment_days"("date");
CREATE INDEX "assignment_days_status_idx" ON "assignment_days"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
