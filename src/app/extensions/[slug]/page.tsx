import Image from 'next/image';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { CatalogPage } from '@/components/catalog/CatalogPage';
import { getExtension } from '@/lib/catalog/taxonomy';
import { catalogMetadata } from '@/lib/catalog/metadata';
import type { SearchParams } from '@/lib/catalog/params';
import styles from '@/components/catalog/Catalog.module.scss';
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  await connection();
  const set = await getExtension((await params).slug);
  if (!set) notFound();
  return catalogMetadata(
    set.name,
    set.description ?? `Explorez l’extension ${set.name}.`,
    `/extensions/${set.slug}`,
    await searchParams,
  );
}
export default async function Page({ params, searchParams }: Props) {
  await connection();
  const set = await getExtension((await params).slug);
  if (!set) notFound();
  return (
    <CatalogPage
      title={set.name}
      description={set.description}
      path={`/extensions/${set.slug}`}
      scope={{ set: set.slug }}
      searchParams={searchParams}
      breadcrumb={[
        { label: 'Accueil', href: '/' },
        { label: 'Extensions', href: '/extensions' },
        { label: set.name },
      ]}
    >
      <div className={styles.setInfo}>
        {set.logoUrl && (
          <Image
            src={set.logoUrl}
            alt={`Logo ${set.name}`}
            width={140}
            height={90}
          />
        )}
        {set.series && <p>{set.series}</p>}
        {set.releaseDate && (
          <p>
            Sortie :{' '}
            {set.releaseDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
          </p>
        )}
      </div>
    </CatalogPage>
  );
}
