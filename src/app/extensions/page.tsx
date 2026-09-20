import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { getExtensions } from '@/lib/catalog/taxonomy';
import { catalogMetadata } from '@/lib/catalog/metadata';
import styles from '@/components/catalog/Catalog.module.scss';
export const metadata = catalogMetadata(
  'Extensions Pokémon',
  'Chaque extension ouvre un nouveau territoire. Explorez celles de notre catalogue.',
  '/extensions',
);
export default async function Page() {
  await connection();
  const sets = await getExtensions();
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Extensions' }]}
        />
        <header className={styles.heading}>
          <p className={styles.eyebrow}>De nouveaux territoires</p>
          <h1>Extensions Pokémon</h1>
          <p className={styles.description}>
            Chaque extension ouvre un nouveau territoire. Trouvez celui qui fera
            grandir votre collection.
          </p>
        </header>
        <div className={styles.extensions}>
          {sets.map((set) => (
            <Link
              key={set.id}
              href={`/extensions/${set.slug}`}
              className={styles.extensionCard}
            >
              {set.logoUrl && (
                <Image
                  src={set.logoUrl}
                  alt={`Logo ${set.name}`}
                  width={240}
                  height={100}
                />
              )}
              <h2>{set.name}</h2>
              {set.series && <p>{set.series}</p>}
              {set.releaseDate && (
                <p>
                  Sortie :{' '}
                  {set.releaseDate.toLocaleDateString('fr-FR', {
                    timeZone: 'UTC',
                  })}
                </p>
              )}
              <span>Explorer l’extension →</span>
            </Link>
          ))}
        </div>
        {!sets.length && (
          <p>De nouvelles extensions seront bientôt à découvrir.</p>
        )}
      </Container>
    </main>
  );
}
