import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { POST } from '../src/app/api/contact/route';
import { getPrisma } from '../src/lib/db/prisma';
import {
  purgeContactMessages,
  setMessageHandled,
} from '../src/lib/admin/messages';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à la base de développement.');
const db = getPrisma();

test('messages de contact : gardés, traités, purgés', async (t) => {
  const key = randomUUID().slice(0, 8);
  const email = `contact-${key}@example.com`;
  const admin = await db.adminUser.create({
    data: { name: 'Test messages', email: `messages-${key}@example.com` },
  });
  const saved = process.env.EMAILS_ENABLED;
  try {
    await t.test(
      'e-mails coupés : le message est gardé quand même',
      async () => {
        process.env.EMAILS_ENABLED = 'false';
        const response = await POST(
          new Request('http://localhost:3000/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Camille Test',
              email,
              topic: 'commande',
              orderNumber: 'CAL-2026-ABCDEF0123456789ABCD',
              message: 'Il manque un booster dans mon colis.',
            }),
          }),
        );
        assert.equal(response.status, 200);
        const [message] = await db.contactMessage.findMany({
          where: { email },
        });
        assert.ok(message);
        assert.equal(message.topic, 'Commande');
        assert.equal(message.orderNumber, 'CAL-2026-ABCDEF0123456789ABCD');
        assert.equal(message.emailedAt, null);
        assert.equal(message.handledAt, null);
      },
    );

    await t.test('traité puis rouvert, avec le journal', async () => {
      const message = await db.contactMessage.findFirstOrThrow({
        where: { email },
      });
      await setMessageHandled(admin.id, message.id, true);
      const handled = await db.contactMessage.findUniqueOrThrow({
        where: { id: message.id },
      });
      assert.ok(handled.handledAt);
      assert.equal(handled.handledById, admin.id);
      await setMessageHandled(admin.id, message.id, false);
      assert.equal(
        (
          await db.contactMessage.findUniqueOrThrow({
            where: { id: message.id },
          })
        ).handledAt,
        null,
      );
      assert.deepEqual(
        (
          await db.adminAuditLog.findMany({
            where: { adminUserId: admin.id },
            orderBy: { createdAt: 'asc' },
          })
        ).map((row) => row.action),
        ['CONTACT_MESSAGE_HANDLED', 'CONTACT_MESSAGE_REOPENED'],
      );
    });

    await t.test('un an après traitement : supprimé', async () => {
      const message = await db.contactMessage.findFirstOrThrow({
        where: { email },
      });
      await db.contactMessage.update({
        where: { id: message.id },
        data: { handledAt: new Date(Date.now() - 400 * 86400000) },
      });
      assert.ok((await purgeContactMessages()).messagesPurged >= 1);
      assert.equal(await db.contactMessage.count({ where: { email } }), 0);
    });
  } finally {
    if (saved === undefined) delete process.env.EMAILS_ENABLED;
    else process.env.EMAILS_ENABLED = saved;
    await db.contactMessage.deleteMany({ where: { email } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
