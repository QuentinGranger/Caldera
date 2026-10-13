import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  carnetAccessState,
  carnetAccessToken,
  verifyCarnetAccess,
} from '../src/lib/carnets/access';
import {
  carnetPublicDate,
  parseCarnetDate,
  formatCarnetDate,
} from '../src/lib/carnets/dates';
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
const early = new Date('2026-11-01T07:00:00Z');
const chapter = {
  id: randomUUID(),
  status: 'READY',
  earlyAccessAt: early,
  publicAt: carnetPublicDate(early),
  publishedAt: null,
  releaseCampaignId: randomUUID(),
};
test('Cycle temporel : brouillon, prévision, programmation, avant-première et frontière exacte publique', () => {
  assert.equal(
    carnetAccessState({ ...chapter, status: 'DRAFT' }, early),
    'hidden',
  );
  assert.equal(
    carnetAccessState({ ...chapter, status: 'ARCHIVED' }, early),
    'hidden',
  );
  assert.equal(
    carnetAccessState({ ...chapter, releaseCampaignId: null }, early),
    'hidden',
  );
  assert.equal(
    carnetAccessState(chapter, new Date(early.getTime() - 1)),
    'scheduled',
  );
  assert.equal(carnetAccessState(chapter, early), 'early');
  assert.equal(
    carnetAccessState(chapter, new Date(chapter.publicAt.getTime() - 1)),
    'early',
  );
  assert.equal(carnetAccessState(chapter, chapter.publicAt), 'public');
  assert.equal(
    carnetAccessState({ ...chapter, status: 'EARLY_ACCESS' }, chapter.publicAt),
    'public',
  );
  assert.equal(
    carnetAccessState(
      { ...chapter, releaseCampaignId: null, publishedAt: early },
      chapter.publicAt,
    ),
    'public',
  );
});
test('Token HMAC : valide, aléatoire, altéré, autre chapitre, pré-J, expiré, calendrier changé et secret absent', () => {
  const token = carnetAccessToken(chapter);
  assert.ok(verifyCarnetAccess(chapter, token, early));
  for (const invalid of [
    null,
    undefined,
    [],
    {},
    '',
    'x'.repeat(100000),
    token + '.',
    token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'),
  ])
    assert.equal(verifyCarnetAccess(chapter, invalid, early), false);
  assert.equal(
    verifyCarnetAccess({ ...chapter, id: randomUUID() }, token, early),
    false,
  );
  assert.equal(
    verifyCarnetAccess({ ...chapter, status: 'DRAFT' }, token, early),
    false,
  );
  assert.equal(
    verifyCarnetAccess(chapter, token, new Date(early.getTime() - 1)),
    false,
  );
  assert.equal(verifyCarnetAccess(chapter, token, chapter.publicAt), false);
  assert.equal(
    verifyCarnetAccess(
      { ...chapter, earlyAccessAt: new Date(early.getTime() + 1) },
      token,
      new Date(early.getTime() + 2),
    ),
    false,
  );
  assert.equal(
    verifyCarnetAccess(
      { ...chapter, publicAt: new Date(chapter.publicAt.getTime() + 1) },
      token,
      early,
    ),
    false,
  );
  const secret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = '';
  assert.equal(verifyCarnetAccess(chapter, token, early), false);
  process.env.BETTER_AUTH_SECRET = secret;
  assert.ok(!token.includes(chapter.id));
});
test('Paris : 14 jours calendaires, changement été/hiver, secondes, exemples éditoriaux', () => {
  for (const [from, to, hours] of [
    ['2026-11-01T08:00', '2026-11-15T08:00', 336],
    ['2026-10-20T08:00', '2026-11-03T08:00', 337],
    ['2026-03-20T08:00', '2026-04-03T08:00', 335],
  ] as const) {
    const d = parseCarnetDate(from, 'Test')!;
    const result = carnetPublicDate(d);
    assert.equal(formatCarnetDate(result), to);
    assert.equal((result.getTime() - d.getTime()) / 3600000, hours);
    const precise = carnetPublicDate(new Date(d.getTime() + 42123));
    assert.equal(precise.getTime() - result.getTime(), 42123);
  }
  assert.throws(
    () => carnetPublicDate(parseCarnetDate('2026-03-15T02:30', 'Test')!),
    /ambiguë|inexistante/,
  );
  assert.throws(
    () => carnetPublicDate(parseCarnetDate('2026-10-11T02:30', 'Test')!),
    /ambiguë|inexistante/,
  );
});

test('SEO Carnets : le catalogue démo ne force pas noindex sur les vrais récits éditoriaux', async () => {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import('../src/proxy');
  const previousDemo = process.env.CATALOG_DEMO_MODE,
    previousOpen = process.env.STORE_OPEN;
  process.env.CATALOG_DEMO_MODE = '1';
  process.env.STORE_OPEN = '1';
  try {
    const request = (path: string) =>
      new NextRequest(`https://lesterresdecaldera.fr${path}`, {
        headers: { host: 'lesterresdecaldera.fr' },
      });
    for (const path of ['/univers/carnets', '/univers/carnets/001-le-lac']) {
      const response = await proxy(request(path));
      assert.equal(response.headers.get('X-Robots-Tag'), null);
      assert.match(
        response.headers.get('Cache-Control') ?? '',
        /private.*no-store/,
      );
    }
    assert.match(
      (await proxy(request('/catalogue'))).headers.get('X-Robots-Tag') ?? '',
      /noindex/,
    );
    assert.match(
      (await proxy(request('/admin/carnets'))).headers.get('X-Robots-Tag') ??
        '',
      /noindex/,
    );
  } finally {
    if (previousDemo === undefined) delete process.env.CATALOG_DEMO_MODE;
    else process.env.CATALOG_DEMO_MODE = previousDemo;
    if (previousOpen === undefined) delete process.env.STORE_OPEN;
    else process.env.STORE_OPEN = previousOpen;
  }
});
