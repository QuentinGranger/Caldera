import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { CalendarPageSkeleton } from '@/components/loading/LoadingSkeleton';
import { CALENDAR_PATH } from '@/components/landing/landingData';
import { LandingFacts } from '@/components/landing/LandingFacts';
import { ReleaseMonths } from '@/components/landing/ReleaseMonths';
import {
  getCalendarYears,
  getReleaseCalendar,
} from '@/components/landing/releaseData';
import { ExploreSection } from '@/components/catalog/ExploreSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { Container } from '@/components/ui/Container/Container';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import styles from '@/components/catalog/Catalog.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const calendar = await getReleaseCalendar();
  return buildMetadata({
    title: calendar.text.title,
    description: calendar.text.description,
    path: CALENDAR_PATH,
    index: calendar.decision.index,
    canonicalPath: calendar.decision.canonicalPath,
  });
}

async function CalendarContent() {
  await connection();
  const [calendar, years] = await Promise.all([
    getReleaseCalendar(),
    getCalendarYears(),
  ]);
  const linked = [...calendar.upcoming, ...calendar.recent].flatMap((entry) =>
    entry.href ? [{ path: entry.href, name: entry.name }] : [],
  );
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Calendrier des sorties' },
          ]}
          currentPath={CALENDAR_PATH}
        />
        <CatalogHeader
          eyebrow="Extensions"
          title={calendar.heading}
          intro={<LandingFacts facts={calendar.facts} />}
        />
        <ReleaseMonths
          id="a-paraitre"
          eyebrow="À paraître"
          title="Prochaines sorties"
          entries={calendar.upcoming}
        />
        <ReleaseMonths
          id="sorties-recentes"
          eyebrow="Déjà sorties"
          title="Sorties des 12 derniers mois"
          entries={calendar.recent}
        />
        <ExploreSection
          eyebrow="Calendrier des sorties"
          title="Continuer l’exploration"
          groups={[
            {
              title: 'Calendriers par année',
              links: years
                .filter((page) => page.indexable)
                .map((page) => ({ href: page.path, label: page.label })),
            },
          ]}
        />
      </Container>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: CALENDAR_PATH,
            name: calendar.heading,
            description: calendar.text.description,
            mainEntity: linked.length ? itemListNode(linked) : null,
          }),
        )}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<CalendarPageSkeleton />}>
      <CalendarContent />
    </Suspense>
  );
}
