import assert from 'node:assert/strict';
import { test } from 'node:test';
import { secureCookieForHost } from '../src/lib/cookies/secure';

test('cart and wishlist cookies stay Secure on public hosts and HTTPS', () => {
  assert.equal(secureCookieForHost('lesterresdecaldera.fr', 'https', true), true);
  assert.equal(secureCookieForHost('lesterresdecaldera.fr', 'http', true), true);
  assert.equal(secureCookieForHost('192.168.1.17:3100', 'https', true), true);
  assert.equal(secureCookieForHost(null, null, true), true);
  assert.equal(secureCookieForHost('localhost:3100', 'http', true), false);
  assert.equal(secureCookieForHost('192.168.1.17:3100', 'http', true), false);
});

test('a forged localhost Host cannot disable Secure on Vercel', () => {
  const previous = process.env.VERCEL;
  try {
    process.env.VERCEL = '1';
    assert.equal(secureCookieForHost('localhost:3000', 'http', true), true);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
