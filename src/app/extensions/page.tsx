import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
} from '@/components/landing/landingData';
import { LandingFacts } from '@/components/landing/LandingFacts';
import { getExtensionsIndex } from '@/components/landing/releaseData';
import { SetList } from '@/components/landing/SetList';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { Container } from '@/components/ui/Container/Container';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import styles from '@/components/catalog/Catalog.module.scss';
import landingStyles from '@/components/landing/Landing.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const index = await getExtensionsIndex();
  return buildMetadata({
    title: index.text.title,
    description: index.text.description,
    path: EXTENSIONS_PATH,
    index: index.decision.index,
    canonicalPath: index.decision.canonicalPath,
  });
}

export default async function Page() {
  await connection();
  const index = await getExtensionsIndex();
  const linked = index.groups.flatMap((group) =>
    group.entries.flatMap((entry) =>
      entry.href ? [{ path: entry.href, name: entry.name }] : [],
    ),
  );
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Extensions' }]}
          currentPath={EXTENSIONS_PATH}
        />
        <CatalogHeader
          eyebrow="Extensions"
          title={index.heading}
          intro={
            <>
              <LandingFacts facts={index.facts} />
              {index.calendarIndexable && index.upcoming.length > 0 && (
                <p>
                  <Link href={CALENDAR_PATH}>Calendrier des sorties</Link>
                </p>
              )}
            </>
          }
        />
        {index.groups.map((group) => (
          <section
            key={group.id}
            id={group.id}
            className={landingStyles.lead}
            aria-labelledby={`${group.id}-titre`}
          >
            <SectionTitle
              id={`${group.id}-titre`}
              title={group.title}
              link={
                group.href && group.gameName
                  ? {
                      href: group.href,
                      label: `Tous les produits ${group.gameName}`,
                    }
                  : undefined
              }
            />
            <SetList entries={group.entries} />
          </section>
        ))}
      </Container>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: EXTENSIONS_PATH,
            name: index.heading,
            description: index.text.description,
            mainEntity: linked.length ? itemListNode(linked) : null,
          }),
        )}
      />
    </main>
  );
}
