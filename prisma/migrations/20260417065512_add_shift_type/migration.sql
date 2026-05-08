-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffId" INTEGER NOT NULL,
    "jobSiteId" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'commute',
    "shiftType" TEXT NOT NULL DEFAULT 'day',
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00',
    "dailyRateOverride" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assignments_jobSiteId_fkey" FOREIGN KEY ("jobSiteId") REFERENCES "job_sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_assignments" ("assignmentType", "createdAt", "dailyRateOverride", "endDate", "endTime", "id", "jobSiteId", "notes", "staffId", "startDate", "startTime", "updatedAt") SELECT "assignmentType", "createdAt", "dailyRateOverride", "endDate", "endTime", "id", "jobSiteId", "notes", "staffId", "startDate", "startTime", "updatedAt" FROM "assignments";
DROP TABLE "assignments";
ALTER TABLE "new_assignments" RENAME TO "assignments";
CREATE INDEX "assignments_staffId_idx" ON "assignments"("staffId");
CREATE INDEX "assignments_jobSiteId_idx" ON "assignments"("jobSiteId");
CREATE INDEX "assignments_startDate_endDate_idx" ON "assignments"("startDate", "endDate");
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'office',
    "branchOfficeId" INTEGER,
    "staffId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_branchOfficeId_fkey" FOREIGN KEY ("branchOfficeId") REFERENCES "branch_offices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("branchOfficeId", "createdAt", "id", "isActive", "name", "passwordHash", "role", "username") SELECT "branchOfficeId", "createdAt", "id", "isActive", "name", "passwordHash", "role", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_staffId_key" ON "users"("staffId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
