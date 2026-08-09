import { Prisma } from '@prisma/client';

type AuditScalar = string | number | boolean | Date | null | undefined;
type AuditSnapshot = object;

const jsonScalar = (value: AuditScalar): string | number | boolean | null => {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
};

export const auditChangeMetadata = (
  entityLabel: string,
  before: AuditSnapshot,
  after: AuditSnapshot,
  fields: readonly string[],
): Prisma.InputJsonObject => {
  const changes: Record<string, Prisma.InputJsonValue> = {};
  const previousSnapshot = before as Record<string, AuditScalar>;
  const nextSnapshot = after as Record<string, AuditScalar>;
  for (const field of fields) {
    const previous = jsonScalar(previousSnapshot[field]);
    const next = jsonScalar(nextSnapshot[field]);
    if (previous === next) continue;
    changes[field] = { before: previous, after: next };
  }
  return { entityLabel, changes };
};
