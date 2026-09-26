import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { HomeCollection } from '@/components/home/homeData';
import { formatDateFr } from '@/lib/seo/metadata';
import styles from './Collections.module.scss';
const TONES = ['sand', 'sage'] as const;
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
      <Container>
        <SectionTitle
          id="collections-title"
          eyebrow="Par date de sortie"
          title="Les dernières extensions"
          link={{ href: '/extensions', label: 'Toutes les extensions' }}
        />
        <div className={styles.grid}>
          {collections.map((collection, index) => (
            <Link
              href={collection.href}
              key={collection.slug}
              id={`extension-${collection.slug}`}
              className={`${styles.card} ${styles[TONES[index % TONES.length]!]}`}
            >
              <div className={styles.copy}>
                <p>
                  {collection.gameName}
                  {collection.releaseDate &&
                    ` · Sortie le ${formatDateFr(collection.releaseDate)}`}
                </p>
                <h3>{collection.name}</h3>
                <span>
                  Voir les {collection.count} produits{' '}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </span>
              </div>
              <div className={styles.image}>
                <Image
                  src={collection.image.url}
                  alt={collection.image.alt}
                  fill
                  sizes="(min-width: 768px) 300px, 45vw"
                />
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
