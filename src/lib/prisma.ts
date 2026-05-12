import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { getAuditActor } from "./audit-context";

const AUDITED_MODELS = new Set([
  "Assignment",
  "AssignmentDay",
  "Staff",
  "JobSite",
  "User",
  "WorkCompletionForm",
  "Vehicle",
]);

const MUTATING_ACTIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

function actionToAuditAction(op: string): "create" | "update" | "delete" | null {
  if (op === "create" || op === "createMany") return "create";
  if (op === "update" || op === "updateMany" || op === "upsert") return "update";
  if (op === "delete" || op === "deleteMany") return "delete";
  return null;
}

function extractRecordId(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  if ("id" in r && r.id !== undefined && r.id !== null) return String(r.id);
  if ("count" in r) return `bulk(${String(r.count)})`;
  return "";
}

function safeJson(value: unknown): string | null {
  try {
    const s = JSON.stringify(value, (_k, v) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "string" && v.length > 500) return v.slice(0, 500) + "…";
      return v;
    });
    return s && s.length > 4000 ? s.slice(0, 4000) + "…" : s;
  } catch {
    return null;
  }
}

// 本番（Vercel + Turso）と開発（ローカル SQLite ファイル）の二刀流。
// TURSO_DATABASE_URL があれば libSQL adapter 経由、なければローカルファイル DB。
function buildPrisma(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const basePrisma = buildPrisma();

function createPrisma() {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const auditAction = actionToAuditAction(operation);
          const shouldAudit =
            !!model &&
            AUDITED_MODELS.has(model) &&
            MUTATING_ACTIONS.has(operation) &&
            auditAction !== null;

          const result = await query(args);

          if (shouldAudit) {
            // libSQL HTTP adapter ではクエリが直列実行されるため、
            // トランザクション中に basePrisma.user.findUnique() を呼ぶとデッドロックする。
            // setAuditActor() で AsyncLocalStorage に積まれた actor のみ使い、
            // 未設定なら audit log の userId/username は null で記録する。
            const actor = getAuditActor();
            const recordId = extractRecordId(result);
            const diff = safeJson({ args, result });
            basePrisma.auditLog
              .create({
                data: {
                  userId: actor.userId,
                  username: actor.username,
                  action: auditAction!,
                  model: model!,
                  recordId,
                  diff,
                },
              })
              .catch(() => {
                /* swallow audit errors to avoid breaking main op */
              });
          }

          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrisma> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { Prisma };
