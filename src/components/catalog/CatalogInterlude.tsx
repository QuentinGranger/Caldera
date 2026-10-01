import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './Catalog.module.scss';

/**
 * A window on the universe between two rows of products: mostly image, one
 * line, one way in. It speaks of the shop's world only, never of the
 * products, and whoever is shopping just scrolls past it.
 */
export function CatalogInterlude() {
  return (
    <aside className={styles.interlude} aria-labelledby="interlude-title">
      <Image
        src="/assets/images/PremiersExplorateurs.png"
        alt=""
        fill
        sizes="(min-width: 1312px) 1312px, 100vw"
      />
      <div className={styles.interludeText}>
        <p className={styles.interludeEyebrow}>Explorer Caldera</p>
        <h3 id="interlude-title">Au-delà des collections</h3>
        <p>
          Le monde qui a donné son nom à la boutique&nbsp;: cinq territoires,
          des archives et une route à suivre.
        </p>
        <Link href="/univers" className={styles.interludeLink}>
          Découvrir l’univers <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
