import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
import {
  filenamePattern,
  imageBackend,
  normalizeImage,
} from '@/lib/storage/images';

/** Photos of a problem, per return: enough to see it, not an album. */
export const MAX_RETURN_PHOTOS = 6;
/** Per customer request (the form's own limit). */
export const MAX_REQUEST_PHOTOS = 3;
/** Kept as long as the return may be discussed: a year after it closed. */
const RETENTION_DAYS = 365;

export class ReturnPhotoError extends Error {}

/** The files of a form field, empty inputs left out. */
export function photoFiles(form: FormData, field = 'photos') {
  return form
    .getAll(field)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

/**
 * Re-encoded (WebP, 1600 px at most, metadata such as GPS dropped) and
 * written to the private `returns` folder. Never served by /media.
 */
export async function storeReturnPhotos(files: File[]) {
  const backend = imageBackend('returns');
  if (!backend)
    throw new ReturnPhotoError(
      'L’envoi de photos est momentanément indisponible. Envoyez votre demande sans photo : nous vous les demanderons par e-mail.',
    );
  const stored: string[] = [];
  try {
    for (const file of files) {
      let buffer: Buffer;
      try {
        buffer = await normalizeImage(file, 1600);
      } catch (error) {
        throw new ReturnPhotoError(
          `« ${file.name.slice(0, 80)} » : ${error instanceof Error ? error.message : 'image invalide.'}`,
        );
      }
      const filename = `${randomUUID()}.webp`;
      await backend.write(filename, buffer);
      stored.push(filename);
    }
    return stored;
  } catch (error) {
    await deleteReturnPhotoFiles(stored);
    throw error;
  }
}

export async function deleteReturnPhotoFiles(filenames: readonly string[]) {
  const backend = imageBackend('returns');
  for (const filename of filenames)
    if (filenamePattern.test(filename))
      await backend?.remove(filename).catch(() => {});
}

export async function readReturnPhoto(filename: string) {
  if (!filenamePattern.test(filename)) return null;
  return (await imageBackend('returns')?.read(filename)) ?? null;
}

/** Photos of returns closed for more than a year: files, then rows. */
export async function purgeReturnPhotos(now = new Date(), limit = 200) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400000);
  const photos = await getPrisma().returnPhoto.findMany({
    where: {
      returnRequest: {
        status: { in: ['REFUNDED', 'REPLACED', 'REJECTED', 'CANCELED'] },
        closedAt: { lt: cutoff },
      },
    },
    select: { id: true, filename: true },
    take: limit,
  });
  await deleteReturnPhotoFiles(photos.map((photo) => photo.filename));
  const { count } = await getPrisma().returnPhoto.deleteMany({
    where: { id: { in: photos.map((photo) => photo.id) } },
  });
  return { photosPurged: count };
}
