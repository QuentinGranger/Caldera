'use client';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import styles from './ProductGallery.module.scss';
type GalleryImage = { url: string; alt: string };
export function ProductGallery({
  images,
  name,
}: {
  images: GalleryImage[];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const active = images[index] ?? images[0];
  if (!active) return null;
  const move = (step: number) =>
    setIndex((current) => (current + step + images.length) % images.length);
  return (
    <section aria-label={`Galerie de ${name}`} className={styles.gallery}>
      <button
        ref={trigger}
        type="button"
        className={styles.main}
        aria-label={`Agrandir : ${active.alt}`}
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => dialog.current?.showModal()}
      >
        <Image
          src={active.url}
          alt={active.alt}
          fill
          sizes="(min-width: 1440px) 680px, (min-width: 1200px) 50vw, (min-width: 768px) 80vw, 100vw"
          preload={index === 0}
        />
        <span className={styles.zoom}>
          <Expand size={16} aria-hidden="true" />
          Agrandir
        </span>
      </button>
      {images.length > 1 && (
        <div className={styles.thumbnails} aria-label="Choisir une image">
          {images.map((image, i) => (
            <button
              type="button"
              key={`${image.url}-${i}`}
              aria-label={`Voir l’image ${i + 1} : ${image.alt}`}
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
            >
              <Image src={image.url} alt="" fill sizes="80px" />
            </button>
          ))}
        </div>
      )}
      <p className={styles.caption} role="status">
        {index + 1} / {images.length} · {active.alt}
      </p>
      <dialog
        id={id}
        ref={dialog}
        className={styles.lightbox}
        aria-label={`Vue agrandie — ${name}`}
        onClose={() => trigger.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            move(1);
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            move(-1);
          }
        }}
      >
        <button
          type="button"
          className={styles.close}
          aria-label="Fermer la vue agrandie"
          onClick={() => dialog.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
        <div className={styles.expanded}>
          <Image
            src={active.url}
            alt={active.alt}
            fill
            sizes="(min-width: 1000px) 900px, 95vw"
          />
        </div>
        <div className={styles.controls}>
          {images.length > 1 && (
            <button
              type="button"
              aria-label="Image précédente"
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </button>
          )}
          <span role="status">
            Image {index + 1} sur {images.length}
          </span>
          {images.length > 1 && (
            <button
              type="button"
              aria-label="Image suivante"
              onClick={() => move(1)}
            >
              <ChevronRight />
            </button>
          )}
        </div>
      </dialog>
    </section>
  );
}
