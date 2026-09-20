import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { AdminError } from '@/lib/admin/validation';
export interface ImageStorage {
  upload(file: File): Promise<string>;
  delete(url: string): Promise<void>;
  getPublicUrl(filename: string): string;
}
function directory() {
  if (process.env.NODE_ENV === 'production' && !process.env.UPLOAD_DIR)
    throw new AdminError(
      'Configurez un volume persistant UPLOAD_DIR avant de téléverser en production.',
    );
  return process.env.UPLOAD_DIR || path.join(process.cwd(), '.data/uploads');
}
const filenamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;
export async function normalizeImage(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new AdminError('Image requise, limitée à 5 Mo.');
  const extension = path.extname(file.name).toLowerCase();
  const formats: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  if (!formats[extension] || formats[extension] !== file.type)
    throw new AdminError('Formats autorisés : JPEG, PNG, WebP.');
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const decoder = sharp(buffer, {
      limitInputPixels: 20000000,
      failOn: 'warning',
    });
    const metadata = await decoder.metadata();
    const expected =
      file.type === 'image/jpeg' ? 'jpeg' : file.type.split('/')[1];
    if (metadata.format !== expected || (metadata.pages ?? 1) !== 1)
      throw new Error('Invalid image');
    return await decoder
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AdminError(
      'Le contenu du fichier ne correspond pas à une image valide, ou ses dimensions sont trop grandes.',
    );
  }
}
export const imageStorage: ImageStorage = {
  async upload(file) {
    const buffer = await normalizeImage(file);
    const filename = `${randomUUID()}.webp`;
    await mkdir(directory(), { recursive: true });
    await writeFile(path.join(directory(), filename), buffer, {
      flag: 'wx',
      mode: 0o600,
    });
    return this.getPublicUrl(filename);
  },
  async delete(url) {
    const filename = url.replace(/^\/media\//, '');
    if (!url.startsWith('/media/') || !filenamePattern.test(filename)) return;
    await unlink(path.join(directory(), filename)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      },
    );
  },
  getPublicUrl(filename) {
    if (!filenamePattern.test(filename)) throw new Error('Invalid filename');
    return `/media/${filename}`;
  },
};
export async function readUploadedImage(filename: string) {
  if (!filenamePattern.test(filename)) return null;
  try {
    return await readFile(path.join(directory(), filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
