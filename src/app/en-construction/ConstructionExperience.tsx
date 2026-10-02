'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import styles from './page.module.scss';

const features = [
  {
    index: '01',
    title: 'Produits scellés',
    text: 'Une sélection pensée pour jouer, collectionner et conserver.',
  },
  {
    index: '02',
    title: 'Guides & actualités',
    text: 'Des repères clairs pour suivre le JCC et ses nouveautés.',
  },
  {
    index: '03',
    title: 'Univers Caldera',
    text: 'Une boutique conçue comme un territoire à explorer.',
  },
] as const;

export function ConstructionExperience() {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const command = 'W3AR3N0T30P3NY3T';
    const previous = Object.getOwnPropertyDescriptor(window, command);

    if (previous && !previous.configurable) return;

    Object.defineProperty(window, command, {
      configurable: true,
      get() {
        document.cookie =
          'caldera_preview=1; Path=/; Max-Age=604800; SameSite=Lax; Secure';
        window.location.assign('/');
        return 'Ouverture de Caldera…';
      },
    });

    return () => {
      const current = Object.getOwnPropertyDescriptor(window, command);
      if (current?.configurable) {
        delete (window as Window & Record<string, unknown>)[command];
      }
    };
  }, []);

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const element = mainRef.current;
    if (!element) return;

    const bounds = element.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

    element.style.setProperty('--parallax-x', `${(x * 16).toFixed(2)}px`);
    element.style.setProperty('--parallax-y', `${(y * 12).toFixed(2)}px`);
    element.style.setProperty('--content-x', `${(x * -4).toFixed(2)}px`);
    element.style.setProperty('--content-y', `${(y * -3).toFixed(2)}px`);
  }

  function resetParallax() {
    const element = mainRef.current;
    if (!element) return;

    element.style.setProperty('--parallax-x', '0px');
    element.style.setProperty('--parallax-y', '0px');
    element.style.setProperty('--content-x', '0px');
    element.style.setProperty('--content-y', '0px');
  }

  return (
    <main
      ref={mainRef}
      id="contenu"
      tabIndex={-1}
      className={styles.main}
      data-caldera-construction
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      <div className={styles.intro} aria-hidden="true">
        <div className={styles.introMark} />
        <p>Préparation du territoire</p>
        <span />
      </div>

      <div className={styles.background} aria-hidden="true" />
      <div className={styles.light} aria-hidden="true" />
      <div className={styles.fog} aria-hidden="true" />
      <div className={styles.embers} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <section className={styles.content} aria-labelledby="construction-title">
        <div className={styles.brand}>
          <Image
            className={styles.logo}
            src="/assets/brand/logo-header-no-bg.png"
            alt="Caldera"
            width={560}
            height={220}
            priority
            sizes="(max-width: 48rem) 72vw, 27rem"
          />
        </div>

        <p className={styles.eyebrow}>
          <span aria-hidden="true" />
          Ouverture prochaine
          <span aria-hidden="true" />
        </p>

        <h1 id="construction-title" className={styles.title}>
          Les portes de Caldera
          <br />
          <em>s&apos;ouvrent bientôt.</em>
        </h1>

        <p className={styles.lead}>
          Nous préparons une boutique pensée pour les collectionneurs, les
          joueurs et ceux qui aiment découvrir le JCC autrement.
        </p>

        <div className={styles.divider} aria-hidden="true">
          <span />
          <i />
          <span />
        </div>

        <p className={styles.note}>
          Chaque détail est encore en cours d&apos;ajustement avant
          l&apos;ouverture.
        </p>

        <div className={styles.features} aria-label="Ce qui arrive chez Caldera">
          {features.map((feature) => (
            <article className={styles.feature} key={feature.index}>
              <span className={styles.featureIndex}>{feature.index}</span>
              <div>
                <h2>{feature.title}</h2>
                <p>{feature.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p
        className={styles.signature}
        aria-label="Caldera, cartes, collection, aventure"
      >
        Cartes <span>·</span> Collection <span>·</span> Aventure
      </p>
    </main>
  );
}
