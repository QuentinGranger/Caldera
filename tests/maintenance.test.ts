import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from '../src/app/api/cron/maintenance/route';
import { cronSecret, isCronAuthorized } from '../src/lib/maintenance/auth';
import { runMaintenance, runMaintenanceJob } from '../src/lib/maintenance/jobs';
import type { EmailProvider } from '../src/lib/email/provider';
// Hors réseau : aucune base ni fournisseur ne doit être joint par cette suite.
for (const key of [
  'CRON_SECRET',
  'DATABASE_URL',
  'PRIMARY_DB_CONNECTION_STRING',
  'EMAILS_ENABLED',
  'EMAIL_FROM',
  'EMAIL_TEST_RECIPIENT',
])
  delete process.env[key];
const secret = 'cron_local_unit_test_only';
function logs(calls: { arguments: unknown[] }[]) {
  return calls.map(
    (call) => JSON.parse(String(call.arguments[0])) as Record<string, unknown>,
  );
}
test('secret cron : absent ou trop court refusé', () => {
  assert.equal(cronSecret(undefined), null);
  assert.equal(cronSecret(''), null);
  assert.equal(cronSecret('x'.repeat(15)), null);
  assert.equal(cronSecret(secret), secret);
});
test('en-tête Authorization : Bearer exact uniquement', () => {
  assert.equal(isCronAuthorized(`Bearer ${secret}`, secret), true);
  for (const header of [
    null,
    '',
    secret,
    `bearer ${secret}`,
    `Bearer  ${secret}`,
    `Bearer ${secret} `,
    `Bearer ${secret}x`,
    `Bearer ${secret.slice(0, -1)}`,
    'Bearer ',
    `Basic ${secret}`,
  ])
    assert.equal(isCronAuthorized(header, secret), false, String(header));
});
test('route cron : 503 sans secret, 401 sans Bearer valide, jamais en cache', async (t) => {
  const error = t.mock.method(console, 'error', () => {});
  const call = (authorization?: string) =>
    GET(
      new Request('http://localhost/api/cron/maintenance', {
        headers: authorization ? { authorization } : {},
      }),
    );
  process.env.CRON_SECRET = 'trop-court';
  let response = await call(`Bearer trop-court`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  process.env.CRON_SECRET = secret;
  try {
    for (const authorization of [
      undefined,
      'Bearer faux-secret-de-test',
      secret,
    ]) {
      response = await call(authorization);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { error: 'Non autorisé' });
    }
  } finally {
    delete process.env.CRON_SECRET;
  }
  assert.deepEqual(
    logs(error.mock.calls).map((entry) => entry.action),
    ['cron_secret_missing', ...Array(3).fill('cron_unauthorized')],
  );
  assert.doesNotMatch(
    error.mock.calls.map((c) => String(c.arguments[0])).join('\n'),
    /cron_local_unit_test_only|faux-secret/,
  );
});
test('emails désactivés : succès explicite sans accès base', async (t) => {
  const info = t.mock.method(console, 'info', () => {});
  const result = await runMaintenanceJob('process-emails');
  assert.equal(result.ok, true);
  assert.deepEqual(
    { ...logs(info.mock.calls)[0], durationMs: 0 },
    {
      scope: 'maintenance',
      action: 'job_completed',
      job: 'process-emails',
      durationMs: 0,
      sent: 0,
      failed: 0,
      disabled: true,
    },
  );
});
test('pannes isolées : chaque tâche journalise un code contrôlé, sans exception', async (t) => {
  const error = t.mock.method(console, 'error', () => {});
  let sends = 0;
  const provider: EmailProvider = {
    name: 'test',
    async send() {
      sends++;
      return { id: 'unused' };
    },
  };
  const results = await runMaintenance({ provider });
  assert.equal(sends, 0);
  assert.deepEqual(
    results.map(({ ok, job, action }) => ({ ok, job, action })),
    [
      { ok: false, job: 'expire-reservations', action: 'job_failed' },
      { ok: false, job: 'process-emails', action: 'job_failed' },
    ],
  );
  // Tâches concurrentes : l’ordre des lignes de log n’est pas garanti.
  const entries = logs(error.mock.calls).sort((a, b) =>
    String(a.job).localeCompare(String(b.job)),
  );
  assert.deepEqual(
    entries.map(({ scope, job, code }) => ({ scope, job, code })),
    [
      {
        scope: 'maintenance',
        job: 'expire-reservations',
        code: 'MAINTENANCE_JOB_FAILED',
      },
      {
        scope: 'maintenance',
        job: 'process-emails',
        code: 'CONFIGURATION_EXPEDITEUR',
      },
    ],
  );
  // Le message brut (ici « DATABASE_URL est manquante. ») n’est jamais journalisé.
  assert.doesNotMatch(JSON.stringify(entries), /DATABASE_URL|manquante/);
});
