import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';

import styles from './not-found.module.scss';

export default function NotFound() {
  return (
    <main id="contenu" className={styles.scene} data-caldera-not-found>
      <div className={styles.landscape} aria-hidden="true">
        <Image
          src="/assets/images/errors/background-404.png"
          alt=""
          fill
          sizes="100vw"
          preload
          className={styles.background}
        />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.mist} aria-hidden="true" />

      <Link
        href="/"
        className={styles.brand}
        aria-label="Les Terres de Caldera — Accueil"
      >
        <Image
          src="/assets/brand/logo-header-no-bg.png"
          alt=""
          width={1774}
          height={887}
          sizes="(max-width: 767px) 420px, 650px"
          className={styles.wordmark}
        />
      </Link>

      <div className={styles.content}>
        <div className={styles.errorCode} role="img" aria-label="Erreur 404">
          <span className={styles.flourish} aria-hidden="true" />
          <span className={styles.digit} aria-hidden="true">
            4
          </span>
          <Image
            src="/assets/images/errors/0-404.png"
            alt=""
            width={1254}
            height={1254}
            sizes="(max-width: 767px) 39vw, 304px"
            loading="eager"
            className={styles.zero}
          />
          <span className={styles.digit} aria-hidden="true">
            4
          </span>
          <span className={styles.flourish} aria-hidden="true" />
        </div>

        <h1>Oups, cette page semble introuvable.</h1>
        <p className={styles.description}>
          Elle s’est perdue dans les terres de Caldera.
        </p>
        <Link href="/" className={styles.returnLink}>
          Retour à l’accueil
          <ArrowRight size={26} strokeWidth={1.7} aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.signature}>
        <div className={styles.compass} aria-hidden="true">
          <span />
          <Compass size={28} strokeWidth={1} />
          <span />
        </div>
        <p>L’aventure continue toujours</p>
      </div>
    </main>
  );
}
