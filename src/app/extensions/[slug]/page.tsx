import type { Metadata } from 'next';
import Image from 'next/image';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import {
  CatalogResults,
  catalogItemListNode,
  catalogListingMetadata,
  catalogLoadPath,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { LandingEditorial } from '@/components/landing/LandingEditorial';
import { LandingFacts } from '@/components/landing/LandingFacts';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingGuides } from '@/components/landing/LandingGuides';
import { requireStandaloneSet } from '@/components/landing/routes';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { Container } from '@/components/ui/Container/Container';
import type { SearchParams } from '@/lib/catalog/params';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import styles from '@/components/catalog/Catalog.module.scss';
import landingStyles from '@/components/landing/Landing.module.scss';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};

// A set attached to an active game lives at /{game}/{set}: this route answers
// 308 for it and only renders the sets without game.
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const view = await requireStandaloneSet((await params).slug, searchParams);
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
  const view = await requireStandaloneSet((await params).slug, searchParams);
  const load = await loadCatalog({
    path: view.path,
    searchParams,
    scope: view.catalogScope,
  });
  const { set } = view;
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb items={view.breadcrumb} currentPath={view.path} />
        <CatalogHeader
          eyebrow="Extension"
          title={set.name}
          description={set.description}
          intro={
            <>
              {set.logoUrl && (
                <Image
                  src={set.logoUrl}
                  alt={`Logo ${set.name}`}
                  width={180}
                  height={90}
                  className={landingStyles.logo}
                />
              )}
              <LandingFacts facts={view.facts} />
            </>
          }
        />
        {firstPage && <LandingEditorial html={view.editorialHtml} />}
        <CatalogResults load={load} path={view.path} />
        {firstPage && (
          <LandingGuides entries={view.guides} subject={set.name} />
        )}
        <LandingFaq entries={faq} subject={set.name} />
      </Container>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: catalogLoadPath(load),
            name: set.name,
            description: view.text.description,
            mainEntity: catalogItemListNode(load),
          }),
          faqPageNode(faq),
        )}
      />
    </main>
  );
}
