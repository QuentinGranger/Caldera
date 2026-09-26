import Image from 'next/image';
import { universeImage } from '@/data/universe';

/** Illustrated figure of a chronicle; nothing while the image is not published. */
export function UniverseFigure({
  src,
  alt,
  caption,
  className,
  imageClassName,
}: {
  src: string;
  alt: string;
  caption: string;
  className?: string;
  imageClassName?: string;
}) {
  const image = universeImage(src, alt);
  if (!image) return null;
  return (
    <figure className={className}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="(min-width: 75rem) 46rem, 100vw"
        className={imageClassName}
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
