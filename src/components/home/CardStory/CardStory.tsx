'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import styles from './CardStory.module.scss';

const chapters = [
  {
    title: 'L’envie de découvrir.',
    text: 'Un univers tient parfois dans le creux de la main. Le plaisir commence avant même la première ouverture.',
  },
  {
    title: 'Le goût du détail.',
    text: 'Une illustration qui retient le regard. Une collection qui prend forme, pièce après pièce.',
  },
  {
    title: 'À vous la suite.',
    text: 'Ouvrir, jouer, collectionner. Découvrez les produits Pokémon sélectionnés par Caldera.',
  },
];

export function CardStory({
  skipTo,
}: {
  /** The section that follows the story, for those who skip it. */
  skipTo: { href: string; label: string };
}) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const section = root.current;
    const surface = canvas.current;
    if (
      !section ||
      !surface ||
      !('IntersectionObserver' in window) ||
      !('ResizeObserver' in window)
    )
      return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const size = window.matchMedia(
      '(min-width: 360px) and (min-height: 600px)',
    );
    let cleanup: (() => void) | undefined;
    let controller: AbortController | undefined;
    let loading = false;
    let stopped = false;
    let generation = 0;
    let nearby = false;
    const reset = () => {
      generation++;
      controller?.abort();
      cleanup?.();
      cleanup = undefined;
      delete section.dataset.cardLayout;
      section
        .querySelectorAll('[data-card-chapter]')
        .forEach((chapter) => chapter.removeAttribute('aria-hidden'));
      loading = false;
    };
    const start = async () => {
      if (
        stopped ||
        loading ||
        cleanup ||
        !nearby ||
        motion.matches ||
        !size.matches
      )
        return;
      loading = true;
      controller = new AbortController();
      const signal = controller.signal;
      const current = ++generation;
      try {
        const { mountCardStory } = await import('@/lib/three/card-story');
        if (stopped || current !== generation) return;
        const dispose = await mountCardStory(section, surface, signal);
        if (stopped || current !== generation) dispose();
        else cleanup = dispose;
      } catch {
        // Keep the server-rendered illustration and all three chapters available.
        if (current === generation) {
          delete section.dataset.cardLayout;
          section.dataset.cardState = 'fallback';
          section
            .querySelectorAll('[data-card-chapter]')
            .forEach((chapter) => chapter.removeAttribute('aria-hidden'));
        }
      } finally {
        if (current === generation) loading = false;
      }
    };
    const prepareLayout = () => {
      if (!motion.matches && size.matches) {
        section.dataset.cardLayout = 'pinned';
        section
          .querySelectorAll('[data-card-chapter]')
          .forEach((chapter, index) =>
            chapter.setAttribute('aria-hidden', String(index !== 0)),
          );
      }
    };
    // Reserve the scroll chapter before loading the renderer, while still below the fold.
    prepareLayout();
    const observer = new IntersectionObserver(
      ([entry]) => {
        nearby = Boolean(entry?.isIntersecting);
        if (nearby) void start();
      },
      { rootMargin: '700px' },
    );
    observer.observe(section);
    const preference = () => {
      reset();
      prepareLayout();
      void start();
    };
    motion.addEventListener('change', preference);
    size.addEventListener('change', preference);
    return () => {
      stopped = true;
      observer.disconnect();
      motion.removeEventListener('change', preference);
      size.removeEventListener('change', preference);
      reset();
    };
  }, []);
  return (
    <section
      ref={root}
      id="experience"
      className={styles.story}
      aria-labelledby="card-story-title"
      data-card-story
    >
      <div className={styles.stage} data-card-stage>
        <div className={styles.atmosphere} aria-hidden="true" />
        <p className={styles.wordmark} aria-hidden="true">
          Caldera
        </p>
        <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
        <div className={styles.fallback} aria-hidden="true">
          <Image
            className={styles.fallbackLeft}
            src="/assets/images/experience/giratina-v-186-196.webp"
            alt=""
            width={600}
            height={825}
            sizes="(min-width: 768px) 360px, 50vw"
          />
          <Image
            className={styles.fallbackRight}
            src="/assets/images/experience/rayquaza-gold-star-107-107.webp"
            alt=""
            width={600}
            height={825}
            sizes="(min-width: 768px) 360px, 50vw"
          />
          <Image
            className={styles.fallbackMain}
            src="/assets/images/experience/noctali-vmax-215-203.webp"
            alt=""
            width={600}
            height={825}
            sizes="(min-width: 768px) 360px, 50vw"
          />
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>L’esprit de la collection</p>
          <h2 id="card-story-title">
            Tout commence
            <br />
            par <em>une carte.</em>
          </h2>
          <div className={styles.chapters}>
            {chapters.map((chapter, index) => (
              <div
                className={styles.chapter}
                data-card-chapter={index}
                key={chapter.title}
              >
                <span className={styles.number}>0{index + 1}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.text}</p>
              </div>
            ))}
          </div>
          <Link className={styles.skip} href={skipTo.href}>
            {skipTo.label} <ArrowDown size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.footer}>
          <span>Cartes emblématiques du JCC Pokémon</span>
          <span className={styles.cue}>
            Faites défiler pour explorer{' '}
            <ArrowDown size={14} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.progress} aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}
