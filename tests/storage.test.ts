import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import sharp from 'sharp';
import { GET } from '../src/app/media/[filename]/route';
import { imageStorage, readUploadedImage } from '../src/lib/storage/images';
const env = process.env as Record<string, string | undefined>;
const keys = [
  'NODE_ENV',
  'UPLOAD_DIR',
  'BLOB_STORE_ID',
  'BLOB_READ_WRITE_TOKEN',
] as const;
const original = Object.fromEntries(keys.map((key) => [key, env[key]]));
function configure(values: Partial<Record<(typeof keys)[number], string>>) {
  for (const key of keys)
    if (values[key] === undefined) delete env[key];
    else env[key] = values[key];
}
after(() => configure(original));
async function png() {
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#b4442c' },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buffer)], 'test.png', { type: 'image/png' });
}
function media(filename: string) {
  return GET(new Request(`http://localhost/media/${filename}`), {
    params: Promise.resolve({ filename }),
  });
}
const unknown = '00000000-0000-4000-8000-000000000000.webp';
test('production sans stockage : upload refusé, /media répond 404', async () => {
  configure({ NODE_ENV: 'production' });
  assert.equal(await readUploadedImage(unknown), null);
  assert.equal((await media(unknown)).status, 404);
  await assert.rejects(imageStorage.upload(await png()), /non configuré/);
  await imageStorage.delete(`/media/${unknown}`);
});
test('UPLOAD_DIR : aller-retour WebP servi par /media', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'caldera-uploads-'));
  try {
    configure({ NODE_ENV: 'production', UPLOAD_DIR: directory });
    const url = await imageStorage.upload(await png());
    assert.match(url, /^\/media\/[0-9a-f-]{36}\.webp$/);
    const filename = url.split('/').pop()!;
    assert.deepEqual(await readdir(directory), [filename]);
    const response = await media(filename);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.match(response.headers.get('cache-control')!, /s-maxage/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal((await sharp(bytes).metadata()).format, 'webp');
    for (const invalid of ['../.env', 'image.png', `${filename}/..`])
      assert.equal(await readUploadedImage(invalid), null);
    await imageStorage.delete(url);
    assert.equal(await readUploadedImage(filename), null);
    assert.equal((await media(filename)).status, 404);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test(
  'Vercel Blob : aller-retour sur le store configuré',
  {
    skip:
      !original.BLOB_READ_WRITE_TOKEN &&
      'BLOB_READ_WRITE_TOKEN absent : test réel ignoré',
  },
  async () => {
    configure({
      NODE_ENV: 'production',
      BLOB_READ_WRITE_TOKEN: original.BLOB_READ_WRITE_TOKEN,
    });
    const url = await imageStorage.upload(await png());
    try {
      const response = await media(url.split('/').pop()!);
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal((await sharp(bytes).metadata()).format, 'webp');
    } finally {
      await imageStorage.delete(url);
    }
  },
);
