import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './Origins.module.scss';

export function Origins() {
  return (
    <section
      className={styles.section}
      aria-labelledby="origins-title"
      data-scroll-scene="origins"
    >
      <div
        className={styles.media}
        aria-hidden="true"
        data-journey-landscape
        data-depth-landscape
      >
        <Image
          src="/assets/images/PremiersExplorateurs.png"
          alt=""
          fill
          sizes="100vw"
        />
      </div>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Les origines de Caldera</p>
        <h2 id="origins-title">
          Chaque collection
          <br />
          commence <em>quelque part.</em>
        </h2>
        <p className={styles.lead}>
          Un monde de falaises, de brumes et de chemins à tracer. Découvrez
          l’histoire qui donne son nom à notre boutique.
        </p>
        <Link href="/univers/origines" className={styles.link}>
          Lire les origines <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <span className={styles.rule} aria-hidden="true" />
        <p className={styles.welcome}>Bienvenue dans Les Terres de Caldera.</p>
      </div>
    </section>
  );
}
