import Link from 'next/link';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { CatalogPage } from '@/components/catalog/CatalogPage';
import { getCategory } from '@/lib/catalog/taxonomy';
import { catalogMetadata } from '@/lib/catalog/metadata';
import type { SearchParams } from '@/lib/catalog/params';
import styles from '@/components/catalog/Catalog.module.scss';
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  await connection();
  const category = await getCategory((await params).slug);
  if (!category) notFound();
  return catalogMetadata(
    category.name,
    category.description ?? `Découvrez ${category.name} sur Caldera.`,
    `/categorie/${category.slug}`,
    await searchParams,
  );
}
export default async function Page({ params, searchParams }: Props) {
  await connection();
  const category = await getCategory((await params).slug);
  if (!category) notFound();
  return (
    <CatalogPage
      title={category.name}
      description={category.description}
      path={`/categorie/${category.slug}`}
      scope={{ category: category.slug }}
      searchParams={searchParams}
      breadcrumb={[
        { label: 'Accueil', href: '/' },
        { label: 'Catalogue', href: '/catalogue' },
        ...category.ancestors.map((c) => ({
          label: c.name,
          href: `/categorie/${c.slug}`,
        })),
        { label: category.name },
      ]}
    >
      {category.children.length > 0 && (
        <section className={styles.explore} aria-label="Sous-catégories">
          <h2>Explorer</h2>
          <div>
            {category.children.map((child) => (
              <Link key={child.id} href={`/categorie/${child.slug}`}>
                {child.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </CatalogPage>
  );
}
