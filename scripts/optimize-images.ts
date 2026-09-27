// Recompresses heavy images of public/ in place (same file name, so no
// reference changes). A lossy version is kept only when it stays visually
// identical (PSNR ≥ 40 dB against the original pixels); otherwise a lossless
// recompression is tried. next/image already serves AVIF/WebP to visitors:
// this mainly lightens Open Graph images, e-mail logos and cold optimisations.
// Usage: npm run images:optimize -- [files…] [--dry-run] [--min-kb 300]
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const minKbIndex = args.indexOf('--min-kb');
const minBytes = (minKbIndex >= 0 ? Number(args[minKbIndex + 1]) : 300) * 1024;
const MAX_SIDE = 2560;
const MIN_PSNR = 40;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

async function rawPixels(input: Buffer, width: number, height: number) {
  return sharp(input)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

/**
 * Peak signal-to-noise ratio in dB on alpha-weighted RGBA: the colour of a
 * fully transparent pixel is invisible and must not count.
 */
function psnr(a: Buffer, b: Buffer): number {
  let squared = 0;
  for (let index = 0; index < a.length; index += 4) {
    const alphaA = (a[index + 3] ?? 0) / 255;
    const alphaB = (b[index + 3] ?? 0) / 255;
    for (let channel = 0; channel < 3; channel++) {
      const difference =
        (a[index + channel] ?? 0) * alphaA - (b[index + channel] ?? 0) * alphaB;
      squared += difference * difference;
    }
    const alphaDifference = (a[index + 3] ?? 0) - (b[index + 3] ?? 0);
    squared += alphaDifference * alphaDifference;
  }
  const mse = squared / a.length;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

async function candidates(file: string, input: Buffer, width: number) {
  const base = () => {
    const image = sharp(input);
    return width > MAX_SIDE
      ? image.resize({ width: MAX_SIDE, withoutEnlargement: true })
      : image;
  };
  if (/\.png$/i.test(file))
    return [
      {
        label: 'png palette',
        lossy: true,
        data: await base()
          .png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 })
          .toBuffer(),
      },
      {
        label: 'png lossless',
        lossy: false,
        // No quality/effort/colours/dither: any of them implies a palette.
        data: await base()
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer(),
      },
    ];
  return [
    {
      label: 'jpeg mozjpeg',
      lossy: true,
      data: await base()
        .jpeg({ quality: 86, mozjpeg: true, progressive: true })
        .toBuffer(),
    },
  ];
}

async function optimize(file: string) {
  const input = await readFile(file);
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const reference = await rawPixels(input, width, height);
  for (const candidate of await candidates(file, input, width)) {
    if (candidate.data.length >= input.length) continue;
    const quality = psnr(
      reference,
      await rawPixels(candidate.data, width, height),
    );
    if (quality < MIN_PSNR) continue;
    if (!dryRun) await writeFile(file, candidate.data);
    return {
      file,
      before: input.length,
      after: candidate.data.length,
      method: candidate.label,
      psnr: quality,
    };
  }
  return {
    file,
    before: input.length,
    after: input.length,
    method: 'inchangé',
    psnr: Infinity,
  };
}

const explicit = args.filter(
  (arg, index) => !arg.startsWith('--') && args[index - 1] !== '--min-kb',
);
const files = explicit.length
  ? explicit
  : (await walk('public')).filter((file) => /\.(png|jpe?g)$/i.test(file));
let saved = 0;
for (const file of files) {
  if (!explicit.length && (await stat(file)).size < minBytes) continue;
  const result = await optimize(file);
  saved += result.before - result.after;
  const kb = (bytes: number) => `${Math.round(bytes / 1024)} Ko`;
  console.info(
    `${result.file} : ${kb(result.before)} → ${kb(result.after)} (${result.method}${
      Number.isFinite(result.psnr) ? `, PSNR ${result.psnr.toFixed(1)} dB` : ''
    })`,
  );
}
console.info(
  `${dryRun ? 'Simulation : ' : ''}${Math.round(saved / 1024)} Ko économisés.`,
);
