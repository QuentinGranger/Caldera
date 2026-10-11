import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
const origin = process.env.MEASUREMENT_TEST_ORIGIN;
test(
  'mesure HTTP : consentement, origine, payload, cookie signé et retrait',
  { skip: !origin },
  async () => {
    const base = new URL(origin!);
    assert.ok(
      ['localhost', '127.0.0.1'].includes(base.hostname),
      'QA locale seulement',
    );
    const visitor = randomUUID();
    const post = (body: unknown, source = origin!, cookie = '') =>
      fetch(new URL('/api/measurement', base), {
        method: 'POST',
        headers: {
          Origin: source,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post(
          { event: 'page_view', visitor, consent: true },
          'https://evil.example',
        )
      ).status,
      403,
    );
    assert.equal(
      (await post({ event: 'page_view', visitor, consent: false })).status,
      400,
    );
    assert.equal(
      (await post({ event: 'purchase', visitor, consent: true, revenue: 999 }))
        .status,
      400,
    );
    assert.equal(
      (await post({ event: 'page_view', visitor: 'bad', consent: true }))
        .status,
      400,
    );
    assert.equal(
      (
        await post({
          event: 'page_view',
          visitor,
          consent: true,
          extra: 'x'.repeat(2100),
        })
      ).status,
      413,
    );
    const started = await post({
      event: 'page_view',
      visitor,
      consent: true,
      source: 'newsletter',
      medium: 'email',
      campaign: 'qa_measurement',
    });
    assert.equal(started.status, 204);
    const header = started.headers.get('set-cookie')!;
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=lax/i);
    const cookie = header.split(';')[0];
    assert.equal(
      (
        await post(
          { event: 'add_to_cart', visitor, consent: true },
          origin!,
          cookie,
        )
      ).status,
      204,
    );
    const withdrawn = await post({ event: 'withdraw' }, origin!, cookie);
    assert.equal(withdrawn.status, 204);
    assert.match(
      withdrawn.headers.get('set-cookie')!,
      /expires=Thu, 01 Jan 1970/i,
    );
  },
);
