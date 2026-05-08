-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffId" INTEGER,
    "jobSiteId" INTEGER NOT NULL,
    "vehicleId" INTEGER,
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
    CONSTRAINT "assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_jobSiteId_fkey" FOREIGN KEY ("jobSiteId") REFERENCES "job_sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assignments" ("assignmentType", "createdAt", "dailyRateOverride", "endDate", "endTime", "id", "jobSiteId", "notes", "shiftType", "staffId", "startDate", "startTime", "updatedAt", "vehicleId") SELECT "assignmentType", "createdAt", "dailyRateOverride", "endDate", "endTime", "id", "jobSiteId", "notes", "shiftType", "staffId", "startDate", "startTime", "updatedAt", "vehicleId" FROM "assignments";
DROP TABLE "assignments";
ALTER TABLE "new_assignments" RENAME TO "assignments";
CREATE INDEX "assignments_staffId_idx" ON "assignments"("staffId");
CREATE INDEX "assignments_jobSiteId_idx" ON "assignments"("jobSiteId");
CREATE INDEX "assignments_vehicleId_idx" ON "assignments"("vehicleId");
CREATE INDEX "assignments_startDate_endDate_idx" ON "assignments"("startDate", "endDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
