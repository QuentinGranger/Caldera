import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import {
  MERCHANDISING,
  isMerchandisingKey,
  merchandisingPath,
} from '@/lib/catalog/merchandising';
import { shopProductWhere } from '@/lib/catalog/shopGame';
import { getMerchandisingProducts } from '@/lib/catalog/queries';
import type { SearchParams } from '@/lib/catalog/params';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import {
  CatalogResults,
  catalogListingMetadata,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import {
  catalogItemListNode,
  catalogLoadPath,
} from '@/components/catalog/catalogLoad';
import { PageHero } from '@/components/catalog/PageHero';
import { VIEWS } from '@/components/catalog/pageCopy';
import { EmptyState } from '@/components/catalog/EmptyState';
import { graph, collectionPageNode } from '@/lib/seo/jsonld';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};
async function selection(params: Props['params']) {
  await connection();
  const { slug } = await params;
  if (!isMerchandisingKey(slug)) notFound();
  if (!(await getMerchandisingProducts(slug, 1, shopProductWhere)).length)
    redirect('/catalogue');
  return {
    key: slug,
    path: merchandisingPath(slug),
    copy: MERCHANDISING[slug],
  };
}
export async function generateMetadata({ params, searchParams }: Props) {
  const { key, path, copy } = await selection(params);
  return catalogListingMetadata({
    title: copy.title,
    description: copy.description,
    path,
    searchParams,
    scope: { merchandising: key },
    decision: {
      index: false,
      reason: 'editorial-selection',
      canonicalPath: path,
    },
  });
}
export default async function SelectionPage({ params, searchParams }: Props) {
  const { key, path, copy } = await selection(params);
  const load = await loadCatalog({
    path,
    searchParams,
    scope: { merchandising: key },
  });
  return (
    <CatalogShell
      hero={
        <PageHero
          breadcrumb={[
            { label: 'Accueil', href: '/' },
            { label: 'Catalogue', href: '/catalogue' },
            { label: copy.title },
          ]}
          path={path}
          eyebrow="Les choix de Caldera"
          title={copy.title}
          lead={copy.description}
          note={copy.note}
          view={{ src: VIEWS.archives, frame: 'backdrop' }}
          action={{
            href: '#catalogue-resultats',
            label: 'Découvrir la sélection',
          }}
        />
      }
      jsonLd={graph(
        collectionPageNode({
          path: catalogLoadPath(load),
          name: copy.title,
          description: copy.description,
          mainEntity: catalogItemListNode(load),
        }),
      )}
    >
      <CatalogResults
        load={load}
        path={path}
        emptyState={
          <EmptyState
            title="Aucun produit ne correspond à ces critères"
            actions={[{ href: '/catalogue', label: ALL_PRODUCTS_LABEL }]}
          />
        }
      />
    </CatalogShell>
  );
}
