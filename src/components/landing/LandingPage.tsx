import Image from 'next/image';
import type { ReactNode } from 'react';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import {
  CatalogResults,
  catalogItemListNode,
  catalogLoadPath,
  type CatalogLoad,
} from '@/components/catalog/CatalogPage';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { Container } from '@/components/ui/Container/Container';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import type { SeoLinkGroup } from '@/lib/seo/types';
import type { LandingView } from './landingData';
import { LandingEditorial } from './LandingEditorial';
import { LandingEmpty } from './LandingEmpty';
import { LandingFacts } from './LandingFacts';
import { LandingFaq } from './LandingFaq';
import { LandingGuides } from './LandingGuides';
import catalogStyles from '@/components/catalog/Catalog.module.scss';
import styles from './Landing.module.scss';

const EMPTY_TITLES: Partial<Record<LandingView['kind'], string>> = {
  set: 'Aucun produit en ligne pour cette extension',
  category: 'Aucun produit en ligne dans cette famille',
};

/**
 * /{game} and /{game}/{facets}: facts, editorial intro, `children` (game hub
 * releases), products with their links, guides and FAQ. Editorial blocks and
 * the FAQ are shown on the first page only.
 */
export function LandingPage({
  view,
  load,
  linkGroups,
  children,
}: {
  view: LandingView;
  load: CatalogLoad;
  linkGroups: readonly SeoLinkGroup[];
  children?: ReactNode;
}) {
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  return (
    <main id="contenu" tabIndex={-1} className={catalogStyles.main}>
      <Container>
        <Breadcrumb items={view.breadcrumb} currentPath={view.path} />
        <CatalogHeader
          eyebrow={view.eyebrow}
          title={view.heading}
          description={view.description}
          intro={
            <>
              {view.logo && (
                <Image
                  src={view.logo.url}
                  alt={view.logo.alt}
                  width={180}
                  height={90}
                  className={styles.logo}
                />
              )}
              <LandingFacts facts={view.facts} />
            </>
          }
        />
        {firstPage && <LandingEditorial html={view.editorialHtml} />}
        {firstPage && children}
        <CatalogResults
          load={load}
          path={view.path}
          emptyState={
            <LandingEmpty
              title={
                EMPTY_TITLES[view.kind] ??
                'Aucun produit en ligne pour le moment'
              }
              links={view.fallbackLinks}
            />
          }
          linkGroups={[...linkGroups, ...view.emptyLinkGroups]}
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
