import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomeCollection } from '@/components/home/homeData';
import { formatDateFr } from '@/lib/seo/metadata';
import styles from './Collections.module.scss';

/**
 * The latest sets, where the night of the territories turns to day: large
 * names, a product rising from its plate, alternating sides.
 */
export function Collections({
  collections,
}: {
  collections: HomeCollection[];
}) {
  if (!collections.length) return null;
  return (
    <section
      id="collections"
      className={styles.section}
      aria-labelledby="collections-title"
    >
      <div className={styles.inner}>
        <header className={styles.head} data-reveal="">
          <div>
            <p className={styles.eyebrow}>Par date de sortie</p>
            <h2 id="collections-title">Les dernières extensions</h2>
          </div>
          <Link href="/extensions" className={styles.all}>
            Toutes les extensions <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </header>
        <ol className={styles.list}>
          {collections.map((collection) => (
            <li key={collection.slug} data-reveal="">
              <Link
                href={collection.href}
                id={`extension-${collection.slug}`}
                className={styles.set}
              >
                <span className={styles.copy}>
                  <span className={styles.meta}>
                    {collection.gameName}
                    {collection.releaseDate &&
                      ` · Sortie le ${formatDateFr(collection.releaseDate)}`}
                  </span>
                  <span className={styles.name}>{collection.name}</span>
                  <span className={styles.cta}>
                    Voir les {collection.count} produits
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </span>
                <span className={styles.plate}>
                  <Image
                    src={collection.image.url}
                    alt={collection.image.alt}
                    fill
                    sizes="(min-width: 768px) 360px, 70vw"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
