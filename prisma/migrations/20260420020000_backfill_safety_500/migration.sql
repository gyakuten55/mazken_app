-- 既存レコードの safetyOffset をバックフィル:
-- 現場配置があった日（site1Id or site2Id がある）で safetyOffset=0 の記録を 500 に更新
UPDATE "daily_payments"
SET "safetyOffset" = 500
WHERE "safetyOffset" = 0
  AND ("site1Id" IS NOT NULL OR "site2Id" IS NOT NULL);
