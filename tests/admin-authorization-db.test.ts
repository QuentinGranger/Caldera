import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { saveBusinessPilotage } from '../src/lib/admin/pilotage';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Fixtures réservées à PostgreSQL local de développement.');

test('pilotage : un administrateur désactivé ne peut pas écrire via le service', async () => {
  const db = getPrisma();
  const admin = await db.adminUser.create({
    data: {
      email: `inactive-pilotage-${randomUUID()}@example.com`,
      name: 'Admin inactif',
      isActive: false,
    },
  });
  const before = await db.businessPilotageSettings.findUnique({
    where: { id: 'caldera' },
  });
  const form = new FormData();
  form.set('revenueTarget', '10000');
  form.set('minimumMarginRate', '20');
  form.set('maxStockBudget', '5000');
  form.set('cashBalance', '1000');

  try {
    await assert.rejects(
      saveBusinessPilotage(admin.id, form),
      /Session administrateur invalide/,
    );
    const after = await db.businessPilotageSettings.findUnique({
      where: { id: 'caldera' },
    });
    assert.deepEqual(after, before);
  } finally {
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
