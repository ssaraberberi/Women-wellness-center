import type { Prisma, StudioSettings } from '@prisma/client';
import { prisma, type Tx } from './prisma.js';

export const DEFAULT_OPENING_HOURS = {
  '1': { open: '07:00', close: '21:00' },
  '2': { open: '07:00', close: '21:00' },
  '3': { open: '07:00', close: '21:00' },
  '4': { open: '07:00', close: '21:00' },
  '5': { open: '07:00', close: '21:00' },
  '6': { open: '09:00', close: '15:00' },
  '7': null,
};

/** The single settings row, created with defaults on first read. */
export async function getSettings(db: Tx | typeof prisma = prisma): Promise<StudioSettings> {
  const row = await db.studioSettings.findUnique({ where: { id: 1 } });
  if (row) return row;
  return db.studioSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, openingHours: DEFAULT_OPENING_HOURS },
  });
}

export async function audit(
  db: Tx | typeof prisma,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  data?: Prisma.InputJsonValue,
  ip?: string,
) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, data, ip } });
}
