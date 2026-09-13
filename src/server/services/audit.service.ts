import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";

interface WriteAuditLogInput {
  actor: SessionPayload;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Single write path for the audit trail. Every mutating admin Server Action
 * calls this after (or as part of) its mutation — see
 * `src/server/actions/*` — so the log stays complete without relying on
 * each call site to remember every field.
 */
export async function writeAuditLog({ actor, action, entityType, entityId, before, after }: WriteAuditLogInput) {
  await prisma.auditLog.create({
    data: {
      actorId: actor.sub,
      action,
      entityType,
      entityId,
      beforeState: before === undefined ? undefined : toJsonValue(before),
      afterState: after === undefined ? undefined : toJsonValue(after),
    },
  });
}

/** Prisma's Json input type doesn't accept `undefined` nested values or Decimal instances directly. */
function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  actorEmail: string | null;
  beforeState: unknown;
  afterState: unknown;
  createdAt: Date;
}

export async function listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true, email: true } } },
  });

  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actorName: entry.actor?.name ?? null,
    actorEmail: entry.actor?.email ?? null,
    beforeState: entry.beforeState,
    afterState: entry.afterState,
    createdAt: entry.createdAt,
  }));
}
