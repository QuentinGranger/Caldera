/** Ignore the transparent padding around packshots when placing their foot on the stage. */
export function productPhotoBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  let left = width,
    right = -1,
    top = height,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) < 12) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < left
    ? null
    : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export function prepareProductPhoto(photo: HTMLImageElement) {
  const scratch = document.createElement('canvas');
  const scale = Math.min(
    1,
    1024 / Math.max(photo.naturalWidth, photo.naturalHeight),
  );
  scratch.width = Math.max(1, Math.round(photo.naturalWidth * scale));
  scratch.height = Math.max(1, Math.round(photo.naturalHeight * scale));
  const context = scratch.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Product texture unavailable');
  context.drawImage(photo, 0, 0, scratch.width, scratch.height);
  // A cross-origin image without CORS falls back to the existing HTML gallery.
  const pixels = context.getImageData(0, 0, scratch.width, scratch.height);
  const bounds = productPhotoBounds(pixels.data, scratch.width, scratch.height);
  if (!bounds) throw new Error('Empty product texture');
  const cropped = document.createElement('canvas');
  cropped.width = bounds.width;
  cropped.height = bounds.height;
  const target = cropped.getContext('2d');
  if (!target) throw new Error('Product texture unavailable');
  target.drawImage(
    scratch,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  scratch.width = scratch.height = 1;
  return cropped;
}
