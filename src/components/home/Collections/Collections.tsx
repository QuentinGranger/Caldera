import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { getCollections } from '@/lib/catalog/queries';
import styles from './Collections.module.scss';
export function Collections({
  collections,
}: {
  collections: Awaited<ReturnType<typeof getCollections>>;
}) {
  return (
    <section
      id="collections"
      className={styles.section}
      aria-labelledby="collections-title"
    >
      <Container>
        <SectionTitle
          id="collections-title"
          eyebrow="Des horizons à découvrir"
          title="À chaque passion, sa collection"
        />
        <div className={styles.grid}>
          {collections.map((collection, index) => (
            <Link
              href={collection.href}
              key={collection.slug}
              id={index === 0 ? 'scelles' : 'accessoires'}
              className={`${styles.card} ${index === 0 ? styles.prismatic : styles.accessories}`}
            >
              <div className={styles.copy}>
                <p>LES EXTENSIONS DU CATALOGUE</p>
                <h3>{collection.name}</h3>
                <span>
                  Découvrir la collection{' '}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </span>
              </div>
              <div className={styles.image}>
                <Image
                  src={collection.image}
                  alt={`Visuel de ${collection.name}`}
                  fill
                  sizes="(min-width: 768px) 300px, 45vw"
                />
              </div>
            </Link>
          ))}
        </div>
        {collections.length === 0 && (
          <p>Les collections seront bientôt disponibles.</p>
        )}
      </Container>
    </section>
  );
}
