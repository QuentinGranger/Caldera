import type { Metadata } from 'next';
import Image from 'next/image';

import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'Caldera — Ouverture prochaine',
  description:
    'Caldera prépare sa boutique en ligne dédiée aux jeux de cartes à collectionner. Ouverture prochaine.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ConstructionPage() {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={styles.main}
      data-caldera-construction
    >
      <div className={styles.landscape} aria-hidden="true" />
      <div className={styles.embers} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <section className={styles.content} aria-labelledby="construction-title">
        <Image
          className={styles.logo}
          src="/assets/brand/logo-header-no-bg.png"
          alt="Caldera"
          width={520}
          height={196}
          priority
          sizes="(max-width: 48rem) 66vw, 23rem"
        />

        <p className={styles.eyebrow}>
          <span aria-hidden="true" />
          Ouverture prochaine
          <span aria-hidden="true" />
        </p>

        <h1 id="construction-title" className={styles.title}>
          Le territoire
          <br />
          <em>se prépare.</em>
        </h1>

        <p className={styles.lead}>
          Caldera façonne sa boutique, prépare ses premières collections et
          affine chaque détail de l&apos;expérience.
        </p>

        <div className={styles.divider} aria-hidden="true">
          <span />
          <i />
          <span />
        </div>

        <p className={styles.note}>
          Encore un peu de patience. L&apos;aventure commence bientôt.
        </p>
      </section>

      <p className={styles.signature} aria-label="Caldera, cartes, collection, aventure">
        Cartes <span>·</span> Collection <span>·</span> Aventure
      </p>
    </main>
  );
}
