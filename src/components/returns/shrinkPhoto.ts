/** Longest side sent: enough to see a dent, light enough for a phone. */
const MAX_SIDE = 1600;

/**
 * A phone photo (often 4 to 8 MB) re-drawn as a JPEG of 1600 px at most
 * before upload, so that three of them fit in one request. The server
 * re-encodes it anyway; whatever cannot be decoded here is sent as is.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext('2d')
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (!blob) return file;
    return new File(
      [blob],
      `${file.name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`,
      {
        type: 'image/jpeg',
      },
    );
  } catch {
    return file;
  }
}
