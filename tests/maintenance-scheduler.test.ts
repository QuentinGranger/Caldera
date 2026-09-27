import assert from 'node:assert/strict';
import { test } from 'node:test';
import scheduler from '../functions/maintenance';

const triggerRequest = () =>
  new Request('https://scheduler.invalid/', {
    method: 'POST',
    headers: { 'x-neon-trigger-invocation-id': 'test-invocation' },
  });

test('le planificateur refuse les appels publics et une configuration incomplète', async () => {
  const previousSecret = process.env.MAINTENANCE_SECRET;
  delete process.env.MAINTENANCE_SECRET;
  try {
    assert.equal(
      (await scheduler.fetch(new Request('https://scheduler.invalid/'))).status,
      405,
    );
    assert.equal(
      (
        await scheduler.fetch(
          new Request('https://scheduler.invalid/', { method: 'POST' }),
        )
      ).status,
      403,
    );
    assert.equal((await scheduler.fetch(triggerRequest())).status, 503);
  } finally {
    if (previousSecret === undefined) delete process.env.MAINTENANCE_SECRET;
    else process.env.MAINTENANCE_SECRET = previousSecret;
  }
});

test('un déclenchement Neon transmet le secret sans l’exposer', async () => {
  const previousSecret = process.env.MAINTENANCE_SECRET;
  const previousFetch = globalThis.fetch;
  const secret = 'scheduler_test_secret_123456789';
  process.env.MAINTENANCE_SECRET = secret;
  let authorization = '';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    return new Response(null, { status: 202 });
  };
  try {
    const response = await scheduler.fetch(triggerRequest());
    assert.equal(response.status, 202);
    assert.equal(authorization, `Bearer ${secret}`);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.MAINTENANCE_SECRET;
    else process.env.MAINTENANCE_SECRET = previousSecret;
  }
});

test('une maintenance refusée produit une erreur contrôlée', async () => {
  const previousSecret = process.env.MAINTENANCE_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.MAINTENANCE_SECRET = 'scheduler_test_secret_123456789';
  globalThis.fetch = async () => new Response(null, { status: 401 });
  try {
    assert.equal((await scheduler.fetch(triggerRequest())).status, 502);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.MAINTENANCE_SECRET;
    else process.env.MAINTENANCE_SECRET = previousSecret;
  }
});
