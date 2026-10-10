import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { catalogFallback } from '@/components/landing/routes';
import { ExploreSection } from '@/components/catalog/ExploreSection';
import { PageHero, HeroStats } from '@/components/catalog/PageHero';
import { VIEWS } from '@/components/catalog/pageCopy';
import { CalendarPageSkeleton } from '@/components/loading/LoadingSkeleton';
import { CALENDAR_PATH, getToday } from '@/components/landing/landingData';
import { ReleaseMonths } from '@/components/landing/ReleaseMonths';
import {
  getCalendarYears,
  getReleaseCalendar,
} from '@/components/landing/releaseData';
import { JsonLd } from '@/components/seo/JsonLd';
import { Container } from '@/components/ui/Container/Container';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import styles from '@/components/catalog/Catalog.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const calendar = await getReleaseCalendar();
  if (!calendar.upcoming.length && !calendar.recent.length)
    redirect(await catalogFallback());
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
  if (!calendar.upcoming.length && !calendar.recent.length)
    redirect(await catalogFallback());
  const today = getToday();
  const entries = [...calendar.upcoming, ...calendar.recent];
  const thisMonth = entries.filter(
    (entry) =>
      entry.releaseDate.getUTCFullYear() === today.getUTCFullYear() &&
      entry.releaseDate.getUTCMonth() === today.getUTCMonth(),
  ).length;
  const games = new Set(entries.map((entry) => entry.gameSlug)).size;
  const linked = entries.flatMap((entry) =>
    entry.href ? [{ path: entry.href, name: entry.name }] : [],
  );

  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={`${styles.main} ${styles.immersive}`}
    >
      <PageHero
        breadcrumb={[
          { label: 'Accueil', href: '/' },
          { label: 'Calendrier des sorties' },
        ]}
        path={CALENDAR_PATH}
        eyebrow="Sorties & extensions"
        title="Calendrier des sorties"
        lead="Suivez les prochaines extensions et retrouvez les sorties récentes, classées par mois."
        view={{
          src: VIEWS.road,
          frame: 'backdrop',
          focus: '50% 52%',
          mobileFocus: '58% 52%',
        }}
      >
        <HeroStats
          label="Repères du calendrier"
          items={[
            { value: calendar.upcoming.length, label: 'Sorties à venir' },
            { value: thisMonth, label: 'Ce mois-ci' },
            { value: games, label: 'Jeux suivis' },
          ]}
        />
      </PageHero>
      <Container>
        <div className={styles.calendarContent}>
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
        </div>
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
