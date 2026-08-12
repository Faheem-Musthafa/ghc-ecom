import { Prisma } from '@prisma/client';

type AuditValue = Prisma.JsonValue | Date | undefined;
type AuditSnapshot = object;

const jsonValue = (value: AuditValue): Prisma.InputJsonValue => {
  if (value instanceof Date) return value.toISOString();
  return (value ?? null) as Prisma.InputJsonValue;
};

export const auditChangeMetadata = (
  entityLabel: string,
  before: AuditSnapshot,
  after: AuditSnapshot,
  fields: readonly string[],
): Prisma.InputJsonObject => {
  const changes: Record<string, Prisma.InputJsonValue> = {};
  const previousSnapshot = before as Record<string, AuditValue>;
  const nextSnapshot = after as Record<string, AuditValue>;
  for (const field of fields) {
    const previous = jsonValue(previousSnapshot[field]);
    const next = jsonValue(nextSnapshot[field]);
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    changes[field] = { before: previous, after: next };
  }
  return { entityLabel, changes };
};
