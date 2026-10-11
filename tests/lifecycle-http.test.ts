import assert from 'node:assert/strict';
import { test } from 'node:test';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
test('automations HTTP : cron privé, reprise sans accès au compte et consentement non précoché', async () => {
  const denied = await fetch(`${base}/api/cron/lifecycle`);
  assert.equal(denied.status, process.env.CRON_SECRET ? 401 : 503);
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  if (process.env.CRON_SECRET) {
    const scheduled = await fetch(`${base}/api/cron/lifecycle`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    assert.equal(
      scheduled.status,
      202,
      'Vercel backup scheduler remains authorized',
    );
  }

  const recovery = await fetch(`${base}/panier/reprendre`);
  assert.equal(recovery.status, 200);
  const html = await recovery.text();
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.ok(html.includes('Aucun paiement'));
  assert.ok(html.includes('Reprendre ma sélection'));
  assert.ok(!html.includes('tokenHash'));
  const newsletter = await (await fetch(`${base}/newsletter`)).text();
  assert.match(newsletter, /<input[^>]*name="personalized"/);
  assert.ok(!/<input(?=[^>]*name="personalized")[^>]*checked/.test(newsletter));
});
