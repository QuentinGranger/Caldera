import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/db/prisma';
import { carnetAccessToken } from '../src/lib/carnets/access';
import { carnetPublicDate } from '../src/lib/carnets/dates';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw Error('HTTP QA locale uniquement.');
const db = getPrisma();
after(() => db.$disconnect());
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const marker = 'NARRATION_PRIVEE_HTTP_' + randomUUID();
const content = {
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Ouverture privée du récit.' }],
      },
      { type: 'newsletterCut' },
      { type: 'paragraph', content: [{ type: 'text', text: marker }] },
    ],
  },
};
function earlyFor(target: Date) {
  const early = new Date(target.getTime() - 14 * 86400000);
  return new Date(
    early.getTime() + target.getTime() - carnetPublicDate(early).getTime(),
  );
}
test('HTTP Carnets : accès serveur HTML/RSC, metadata, archives, sitemap et bascule réelle sans redeploy', async () => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Carnets HTTP QA', email: `carnet-http-${key}@example.com` },
  });
  try {
    const early = new Date(Date.now() - 86400000);
    const chapter = await db.carnetChapter.create({
      data: {
        number: 678903,
        title: 'Carnet lecture HTTP',
        slug: `carnet-http-${key}`,
        status: 'READY',
        content,
        earlyAccessAt: early,
        publicAt: carnetPublicDate(early),
        publishedAt: early,
        createdById: admin.id,
      },
    });
    const path = `/univers/carnets/${chapter.slug}`;
    const token = carnetAccessToken(chapter);
    for (const suffix of [
      '',
      '?access=incorrect',
      `?access=${token.slice(0, -1)}x`,
    ]) {
      const response = await fetch(base + path + suffix);
      assert.equal(response.status, 200);
      assert.match(
        response.headers.get('cache-control') ?? '',
        /private.*no-store/,
      );
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      const html = await response.text();
      assert.doesNotMatch(html, new RegExp(marker));
      assert.match(html, /réservé aux abonnés/);
      assert.match(html, /<meta name="robots" content="noindex/);
      assert.ok(html.includes(`href="https://lesterresdecaldera.fr${path}"`));
    }
    const flight = await fetch(base + path, { headers: { RSC: '1' } });
    assert.equal(flight.status, 200);
    assert.doesNotMatch(await flight.text(), new RegExp(marker));
    const authorized = await fetch(`${base}${path}?access=${token}`);
    const html = await authorized.text();
    assert.match(html, new RegExp(marker));
    assert.match(html, /<meta name="robots" content="noindex/);
    assert.doesNotMatch(html, /<link rel="canonical"[^>]*access=/);
    const other = await db.carnetChapter.create({
      data: {
        number: 678904,
        title: 'Autre Carnet',
        slug: `autre-http-${key}`,
        status: 'READY',
        content,
        earlyAccessAt: early,
        publicAt: carnetPublicDate(early),
        publishedAt: early,
        createdById: admin.id,
      },
    });
    const wrong = await fetch(
      `${base}/univers/carnets/${other.slug}?access=${token}`,
    );
    assert.doesNotMatch(await wrong.text(), new RegExp(marker));
    const archive = await (await fetch(`${base}/univers/carnets`)).text();
    assert.ok(!archive.includes(path));
    const sitemapResponse = await fetch(`${base}/sitemaps/content.xml`);
    assert.match(
      sitemapResponse.headers.get('cache-control') ?? '',
      /no-store/,
    );
    assert.ok(!(await sitemapResponse.text()).includes(path));
    // Use the same built process and URL, crossing the deadline with no cron, rebuild or revalidation.
    const deadline = new Date(Date.now() + 2000);
    const starts = earlyFor(deadline);
    await db.carnetChapter.update({
      where: { id: chapter.id },
      data: { earlyAccessAt: starts, publicAt: deadline },
    });
    const before = await fetch(base + path);
    assert.doesNotMatch(await before.text(), new RegExp(marker));
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, deadline.getTime() - Date.now() + 100)),
    );
    const publicResponse = await fetch(base + path);
    const publicHtml = await publicResponse.text();
    assert.equal(publicResponse.status, 200);
    assert.ok(!publicResponse.headers.get('x-robots-tag')?.includes('noindex'));
    assert.match(publicHtml, new RegExp(marker));
    assert.match(publicHtml, /<meta name="robots" content="index, follow/);
    const historical = await fetch(`${base}${path}?access=ancien-token`);
    assert.equal(new URL(historical.url).pathname, path);
    assert.equal(new URL(historical.url).search, '');
    assert.match(await historical.text(), new RegExp(marker));
    assert.ok(
      (await (await fetch(`${base}/univers/carnets`)).text()).includes(path),
    );
    assert.ok(
      (await (await fetch(`${base}/sitemaps/content.xml`)).text()).includes(
        path,
      ),
    );
    assert.ok(
      !publicHtml.includes(`/univers/carnets/${other.slug}`),
      'Le suivant réservé reste absent',
    );
    await db.carnetChapter.update({
      where: { id: chapter.id },
      data: { status: 'DRAFT' },
    });
    assert.equal((await fetch(base + path)).status, 404);
  } finally {
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
  }
});
