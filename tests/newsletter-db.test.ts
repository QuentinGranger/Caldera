import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '../src/lib/newsletter/service';

if (process.env.NODE_ENV === 'production')
  throw new Error('Tests réservés au développement.');

test('inscription, idempotence, désinscription et réinscription', async (t) => {
  const db = getPrisma();
  const email = `newsletter-${randomUUID()}@example.test`;

  t.after(async () => {
    await db.newsletterSubscriber.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  const first = await subscribeToNewsletter(email.toUpperCase());
  assert.equal(first.activated, true);
  assert.equal(first.subscription.email, email);

  const duplicate = await subscribeToNewsletter(email);
  assert.equal(duplicate.activated, false);
  assert.equal(duplicate.subscription.id, first.subscription.id);

  assert.equal(
    await unsubscribeFromNewsletter(first.subscription.unsubscribeToken),
    true,
  );
  assert.equal(
    (await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } }))
      .status,
    'UNSUBSCRIBED',
  );

  const reactivated = await subscribeToNewsletter(email);
  assert.equal(reactivated.activated, true);
  assert.notEqual(
    reactivated.subscription.unsubscribeToken,
    first.subscription.unsubscribeToken,
  );
});
