import { AsyncLocalStorage } from "node:async_hooks";

export type AuditActor = {
  userId: number | null;
  username: string | null;
};

const storage = new AsyncLocalStorage<AuditActor>();

export function getAuditActor(): AuditActor {
  return storage.getStore() ?? { userId: null, username: null };
}

/**
 * Set the audit actor for the current async context.
 * Uses AsyncLocalStorage.enterWith so subsequent awaits in the same request
 * inherit the actor without requiring an explicit .run() wrap.
 *
 * Call this once at the start of a route handler / server action after
 * resolving the session.
 */
export function setAuditActor(actor: AuditActor): void {
  storage.enterWith(actor);
}

export function runWithAuditActor<T>(
  actor: AuditActor,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return storage.run(actor, fn);
}
