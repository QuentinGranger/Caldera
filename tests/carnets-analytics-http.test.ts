import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, after } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { measurementHash } from '../src/lib/analytics/server';
const base = process.env.MEASUREMENT_TEST_ORIGIN;
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw Error('QA locale uniquement');
const db = getPrisma();
after(() => db.$disconnect());
test(
  'HTTP lecture : consentement, session signée, accès et retrait sur toutes les sessions du navigateur',
  { skip: !base },
  async () => {
    const key = randomUUID(),
      visitor = randomUUID();
    const admin = await db.adminUser.create({
      data: {
        name: 'QA HTTP reading',
        email: `reading-http-${key}@example.com`,
      },
    });
    const chapter = await db.carnetChapter.create({
      data: {
        createdById: admin.id,
        number: 820098,
        slug: `reading-http-${key}`,
        title: 'QA HTTP',
        content: {},
        status: 'READY',
        earlyAccessAt: new Date(Date.now() - 20 * 86400000),
        publicAt: new Date(Date.now() - 86400000),
        publishedAt: new Date(Date.now() - 20 * 86400000),
      },
    });
    const post = (
      event: string,
      cookie = '',
      extras: Record<string, unknown> = {},
    ) =>
      fetch(base + '/api/measurement', {
        method: 'POST',
        headers: {
          Origin: base!,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({
          event,
          visitor,
          consent: true,
          chapterId: chapter.id,
          ...extras,
        }),
      });
    try {
      assert.equal((await post('carnet_view')).status, 400);
      const started = await post('page_view');
      assert.equal(started.status, 204);
      const cookie = started.headers.get('set-cookie')!.split(';')[0]!;
      assert.equal(
        (await post('carnet_view', cookie, { consent: false })).status,
        400,
      );
      assert.equal(
        await db.carnetReading.count({ where: { chapterId: chapter.id } }),
        0,
      );
      assert.equal((await post('carnet_view', cookie)).status, 204);
      assert.equal((await post('carnet_view', cookie)).status, 204);
      assert.equal(
        await db.carnetReading.count({ where: { chapterId: chapter.id } }),
        1,
      );
      await db.carnetChapter.update({
        where: { id: chapter.id },
        data: { status: 'DRAFT' },
      });
      const another = await post('page_view');
      const second = another.headers.get('set-cookie')!.split(';')[0]!;
      assert.equal((await post('carnet_view', second)).status, 204);
      assert.equal(
        await db.carnetReading.count({ where: { chapterId: chapter.id } }),
        1,
      );
      await db.measurementSession.create({
        data: {
          visitorHash: measurementHash(visitor)!,
          channel: 'direct',
          source: 'direct',
          carnetReadings: { create: { chapterId: chapter.id } },
        },
      });
      assert.equal((await post('withdraw', second)).status, 204);
      assert.equal(
        await db.measurementSession.count({
          where: { visitorHash: measurementHash(visitor)! },
        }),
        0,
      );
      assert.equal(
        await db.carnetReading.count({ where: { chapterId: chapter.id } }),
        0,
      );
      assert.equal((await post('carnet_view', cookie)).status, 400);
      const unsigned = await post('page_view');
      assert.equal(unsigned.status, 204);
      assert.equal((await post('withdraw')).status, 204); // withdrawal still erases history after cookie expiration
      assert.equal(
        await db.measurementSession.count({
          where: { visitorHash: measurementHash(visitor)! },
        }),
        0,
      );
    } finally {
      await db.measurementSession.deleteMany({
        where: { visitorHash: measurementHash(visitor)! },
      });
      await db.carnetChapter.delete({ where: { id: chapter.id } });
      await db.adminUser.delete({ where: { id: admin.id } });
    }
  },
);
