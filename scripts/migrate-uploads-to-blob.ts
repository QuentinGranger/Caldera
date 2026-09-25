import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { blobBackend, filenamePattern } from '../src/lib/storage/images';
// Copies local uploads into the Vercel Blob store under the same filename,
// so existing /media/<uuid>.webp URLs resolve once the site reads from Blob.
// Usage: npm run media:migrate -- [directory] [--dry-run]
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const directory = path.resolve(
  args.find((arg) => !arg.startsWith('--')) ??
    process.env.UPLOAD_DIR ??
    '.data/uploads',
);
if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID)
  throw new Error(
    'Définissez BLOB_READ_WRITE_TOKEN pour cibler le store Blob.',
  );
const result = { directory, dryRun, uploaded: 0, present: 0, ignored: 0 };
for (const filename of (await readdir(directory)).sort()) {
  if (!filenamePattern.test(filename)) {
    result.ignored++;
    continue;
  }
  if (await blobBackend.read(filename)) {
    result.present++;
    continue;
  }
  if (!dryRun)
    await blobBackend.write(
      filename,
      await readFile(path.join(directory, filename)),
    );
  result.uploaded++;
}
console.info(JSON.stringify(result));
