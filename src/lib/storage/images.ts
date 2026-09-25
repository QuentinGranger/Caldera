import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BlobError, del, get, put } from '@vercel/blob';
import sharp from 'sharp';
import { AdminError } from '@/lib/admin/validation';
export interface ImageStorage {
  upload(file: File): Promise<string>;
  delete(url: string): Promise<void>;
  getPublicUrl(filename: string): string;
}
// Where the WebP bytes live. Public URLs stay /media/<filename> whatever the backend,
// so URLs already stored in the database keep working after a backend change.
interface ImageBackend {
  write(filename: string, buffer: Buffer): Promise<void>;
  read(filename: string): Promise<Buffer | null>;
  remove(filename: string): Promise<void>;
}
export const filenamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;
function filesystemBackend(directory: string): ImageBackend {
  return {
    async write(filename, buffer) {
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, filename), buffer, {
        flag: 'wx',
        mode: 0o600,
      });
    },
    async read(filename) {
      try {
        return await readFile(path.join(directory, filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async remove(filename) {
      await unlink(path.join(directory, filename)).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        },
      );
    },
  };
}
// Private store: blobs are only reachable through /media, never by their store URL.
// On Vercel the SDK authenticates with OIDC + BLOB_STORE_ID; elsewhere with BLOB_READ_WRITE_TOKEN.
export const blobBackend: ImageBackend = {
  async write(filename, buffer) {
    try {
      await put(`media/${filename}`, buffer, {
        access: 'private',
        contentType: 'image/webp',
        cacheControlMaxAge: 31536000,
      });
    } catch (error) {
      if (!(error instanceof BlobError)) throw error;
      console.error('Image storage write failed', { error: error.message });
      throw new AdminError(
        'Stockage des images indisponible ou mal configuré. Réessayez plus tard.',
      );
    }
  },
  async read(filename) {
    const result = await get(`media/${filename}`, { access: 'private' });
    if (result?.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  },
  async remove(filename) {
    await del(`media/${filename}`);
  },
};
function backend(): ImageBackend | null {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
    return blobBackend;
  if (process.env.UPLOAD_DIR) return filesystemBackend(process.env.UPLOAD_DIR);
  if (process.env.NODE_ENV !== 'production')
    return filesystemBackend(path.join(process.cwd(), '.data/uploads'));
  return null;
}
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
    const target = backend();
    if (!target)
      throw new AdminError(
        'Stockage des images non configuré : connectez un store Vercel Blob ou définissez UPLOAD_DIR.',
      );
    const buffer = await normalizeImage(file);
    const filename = `${randomUUID()}.webp`;
    await target.write(filename, buffer);
    return this.getPublicUrl(filename);
  },
  async delete(url) {
    const filename = url.replace(/^\/media\//, '');
    if (!url.startsWith('/media/') || !filenamePattern.test(filename)) return;
    await backend()?.remove(filename);
  },
  getPublicUrl(filename) {
    if (!filenamePattern.test(filename)) throw new Error('Invalid filename');
    return `/media/${filename}`;
  },
};
// Unconfigured storage reads as "not found" so /media answers 404, never 500.
export async function readUploadedImage(filename: string) {
  if (!filenamePattern.test(filename)) return null;
  return (await backend()?.read(filename)) ?? null;
}
