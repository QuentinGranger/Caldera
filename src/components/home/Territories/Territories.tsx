import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { territories } from '@/data/universe';
import styles from './Territories.module.scss';

/**
 * The five territories as one landscape that changes with the name under
 * the scroll, pointer or keyboard focus. On phones, a vertical sequence.
 * Each leads to its chapter of /univers/territoires.
 */
export function Territories() {
  return (
    <section
      id="territoires"
      data-scroll-scene="territories"
      className={styles.section}
      aria-labelledby="territories-title"
    >
      <div className={styles.stage}>
        <div className={styles.inner}>
          <header className={styles.head}>
            <p className={styles.eyebrow}>L’univers de Caldera</p>
            <h2 id="territories-title">
              Une terre, <em>cinq façons d’explorer.</em>
            </h2>
            <p>
              Chaque extension ouvre un nouveau territoire. Nos chroniques
              racontent le monde qui donne son nom à la boutique.
            </p>
          </header>
          <ol className={styles.list}>
            {territories.map((territory, index) => (
              <li key={territory.slug} className={styles.item}>
                <Link
                  href={`/univers/territoires#${territory.slug}`}
                  className={styles.link}
                  data-territory={index}
                >
                  <span className={styles.visual} aria-hidden="true">
                    <Image
                      src={territory.image.src}
                      alt=""
                      fill
                      sizes="100vw"
                    />
                  </span>
                  <span className={styles.number} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{territory.name}</span>
                    <span className={styles.tagline}>{territory.tagline}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <Link href="/univers/territoires" className={styles.more}>
            Parcourir les territoires{' '}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
