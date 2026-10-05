import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Fixtures réservées à la base de développement.');
// Server started with EMAILS_ENABLED=false and PASSWORD_BREACH_CHECK=off.
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const origin = new URL(base).origin;
const manifest = JSON.parse(
  await readFile('.next/server/server-reference-manifest.json', 'utf8'),
) as { node: Record<string, { exportedName?: string }> };
const db = getPrisma();

async function formAction(
  path: string,
  name: string,
  values: Record<string, string>,
) {
  const id = Object.entries(manifest.node).find(
    ([, value]) => value.exportedName === name,
  )?.[0];
  assert.ok(id, `Action absente du manifest : ${name}`);
  const data = new FormData();
  for (const [field, value] of Object.entries(values))
    data.set(`_1_${field}`, value);
  data.set('0', JSON.stringify([{ success: false, message: '' }, '$K1']));
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Next-Action': id, Accept: 'text/x-component', Origin: origin },
    body: data,
    redirect: 'manual',
  });
  return { response, body: await response.text() };
}

/** The action's answer message, from the RSC payload. */
const message = (body: string) => /"message":"([^"]*)"/.exec(body)?.[1] ?? '';

test('mot de passe oublié HTTP : pages privées, réponse identique, lien invalide refusé', async (t) => {
  const key = randomUUID().slice(0, 8);
  const customerEmail = `reset-http-${key}@example.com`;
  const adminEmail = `admin-reset-http-${key}@example.com`;
  await db.customer.create({
    data: { email: customerEmail, name: 'Reset HTTP', emailVerified: true },
  });
  const admin = await db.adminUser.create({
    data: { email: adminEmail, name: 'Admin Reset HTTP' },
  });
  try {
    await t.test('pages : jamais indexées ni en cache partagé', async () => {
      for (const path of [
        '/compte/mot-de-passe-oublie',
        '/compte/nouveau-mot-de-passe',
        '/admin/mot-de-passe-oublie',
        '/admin/nouveau-mot-de-passe',
      ]) {
        const response = await fetch(`${base}${path}`);
        assert.equal(response.status, 200, path);
        assert.match(
          response.headers.get('cache-control') ?? '',
          /no-store/,
          path,
        );
        assert.match(
          response.headers.get('x-robots-tag') ?? '',
          /noindex/,
          path,
        );
        // The token is read in the browser, from the fragment.
        if (path.endsWith('nouveau-mot-de-passe'))
          assert.match(await response.text(), /name="token" value=""/, path);
      }
    });

    await t.test(
      'anciens jetons en query : retirés avant le rendu',
      async () => {
        const token = `query-token-${key}`;
        for (const path of [
          '/compte/verification',
          '/compte/nouveau-mot-de-passe',
          '/admin/nouveau-mot-de-passe',
        ]) {
          const response = await fetch(
            `${base}${path}?token=${token}&source=test`,
            {
              redirect: 'manual',
            },
          );
          assert.equal(response.status, 307, path);
          const location = response.headers.get('location');
          assert.ok(location, path);
          const target = new URL(location, base);
          assert.equal(target.pathname, path);
          assert.equal(target.search, '?source=test');
          assert.ok(!(await response.text()).includes(token), path);
        }
      },
    );

    for (const [label, path, action, known, field] of [
      [
        'client',
        '/compte/mot-de-passe-oublie',
        'requestPasswordResetAction',
        customerEmail,
        'email',
      ],
      [
        'admin',
        '/admin/mot-de-passe-oublie',
        'requestAdminPasswordResetAction',
        adminEmail,
        'email',
      ],
    ] as const)
      await t.test(
        `demande ${label} : même réponse pour un compte existant, inconnu ou après la limite`,
        async () => {
          const unknown = `inconnu-${key}-${label}@example.com`;
          const answers: string[] = [];
          for (let attempt = 0; attempt < 5; attempt++) {
            answers.push(
              message(
                (await formAction(path, action, { [field]: known })).body,
              ),
            );
            answers.push(
              message(
                (await formAction(path, action, { [field]: unknown })).body,
              ),
            );
          }
          const normalized = answers.map((text) =>
            text.replaceAll(known, 'X').replaceAll(unknown, 'X'),
          );
          assert.ok(normalized[0]);
          assert.ok(normalized.every((text) => text === normalized[0]));
        },
      );

    await t.test('lien falsifié : refusé sans rien modifier', async () => {
      const customer = await formAction(
        '/compte/nouveau-mot-de-passe',
        'resetPasswordAction',
        {
          token: 'faux-jeton',
          password: 'une phrase assez longue',
          confirmation: 'une phrase assez longue',
        },
      );
      assert.match(message(customer.body), /plus valable/);
      const adminResult = await formAction(
        '/admin/nouveau-mot-de-passe',
        'resetAdminPasswordAction',
        {
          token: 'faux-jeton',
          password: 'une phrase assez longue',
          confirmation: 'une phrase assez longue',
        },
      );
      assert.match(message(adminResult.body), /expiré|déjà servi/);
      const missing = await formAction(
        '/admin/nouveau-mot-de-passe',
        'resetAdminPasswordAction',
        {
          token: '',
          password: 'une phrase assez longue',
          confirmation: 'une phrase assez longue',
        },
      );
      assert.match(message(missing.body), /incomplet/);
    });
  } finally {
    await db.customer.deleteMany({ where: { email: customerEmail } });
    await db.adminVerification.deleteMany({ where: { value: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.customerAuthAttempt.deleteMany({
      where: { key: { not: 'global' } },
    });
    await db.adminLoginAttempt.deleteMany({
      where: { key: { startsWith: 'reset:' } },
    });
    await db.$disconnect();
  }
});
