import type { Metadata } from 'next';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import {
  CatalogResults,
  catalogItemListNode,
  catalogListingMetadata,
  catalogLoadPath,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { requireCategoryHub } from '@/components/landing/routes';
import { LandingEditorial } from '@/components/landing/LandingEditorial';
import { LandingFacts } from '@/components/landing/LandingFacts';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingGuides } from '@/components/landing/LandingGuides';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { Container } from '@/components/ui/Container/Container';
import type { SearchParams } from '@/lib/catalog/params';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import styles from '@/components/catalog/Catalog.module.scss';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const view = await requireCategoryHub((await params).slug, searchParams);
  return catalogListingMetadata({
    path: view.path,
    searchParams,
    scope: view.catalogScope,
    title: view.text.title,
    description: view.text.description,
    decision: view.decision,
    image: view.image,
  });
}

export default async function Page({ params, searchParams }: Props) {
  const view = await requireCategoryHub((await params).slug, searchParams);
  const load = await loadCatalog({
    path: view.path,
    searchParams,
    scope: view.catalogScope,
  });
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb items={view.breadcrumb} currentPath={view.path} />
        <CatalogHeader
          eyebrow="Famille de produits"
          title={view.heading}
          description={view.description}
          intro={<LandingFacts facts={view.facts} />}
        />
        {firstPage && <LandingEditorial html={view.editorialHtml} />}
        <CatalogResults
          load={load}
          path={view.path}
          linkGroups={view.linkGroups}
        />
        {firstPage && (
          <LandingGuides entries={view.guides} subject={view.heading} />
        )}
        <LandingFaq entries={faq} subject={view.heading} />
      </Container>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: catalogLoadPath(load),
            name: view.heading,
            description: view.text.description,
            mainEntity: catalogItemListNode(load),
          }),
          faqPageNode(faq),
        )}
      />
    </main>
  );
}
