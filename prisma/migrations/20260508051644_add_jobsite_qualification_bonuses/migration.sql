-- CreateTable
CREATE TABLE "job_site_qualification_bonuses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobSiteId" INTEGER NOT NULL,
    "qualificationId" INTEGER NOT NULL,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_site_qualification_bonuses_jobSiteId_fkey" FOREIGN KEY ("jobSiteId") REFERENCES "job_sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_site_qualification_bonuses_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "qualifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "job_site_qualification_bonuses_jobSiteId_idx" ON "job_site_qualification_bonuses"("jobSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "job_site_qualification_bonuses_jobSiteId_qualificationId_key" ON "job_site_qualification_bonuses"("jobSiteId", "qualificationId");
