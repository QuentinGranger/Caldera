import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { ExploreSection } from '@/components/catalog/ExploreSection';
import { PageHero, HeroStats } from '@/components/catalog/PageHero';
import { VIEWS } from '@/components/catalog/pageCopy';
import { CALENDAR_PATH } from '@/components/landing/landingData';
import { ReleaseMonths } from '@/components/landing/ReleaseMonths';
import {
  getCalendarYears,
  getYearCalendar,
} from '@/components/landing/releaseData';
import { JsonLd } from '@/components/seo/JsonLd';
import { Container } from '@/components/ui/Container/Container';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import styles from '@/components/catalog/Catalog.module.scss';

type Props = { params: Promise<{ annee: string }> };

async function resolve(params: Props['params']) {
  await connection();
  const calendar = await getYearCalendar((await params).annee);
  if (!calendar) notFound();
  return calendar;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const calendar = await resolve(params);
  return buildMetadata({
    title: calendar.text.title,
    description: calendar.text.description,
    path: calendar.path,
    index: calendar.decision.index,
    canonicalPath: calendar.decision.canonicalPath,
  });
}

export default async function Page({ params }: Props) {
  const calendar = await resolve(params);
  const years = await getCalendarYears();
  const others = years.filter(
    (page) => page.indexable && page.path !== calendar.path,
  );
  const entries = [...calendar.released, ...calendar.upcoming];
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
          { label: 'Calendrier des sorties', href: CALENDAR_PATH },
          { label: calendar.heading },
        ]}
        path={calendar.path}
        eyebrow={calendar.game ? `Sorties ${calendar.game.name}` : 'Sorties & extensions'}
        title={calendar.heading}
        lead={
          calendar.game
            ? `Retrouvez les extensions ${calendar.game.name} prévues et déjà parues en ${calendar.year}, classées par mois.`
            : `Retrouvez les extensions prévues et déjà parues en ${calendar.year}, classées par mois.`
        }
        view={{
          src: VIEWS.road,
          frame: 'backdrop',
          focus: '50% 52%',
          mobileFocus: '58% 52%',
        }}
      >
        <HeroStats
          label={`Repères du calendrier ${calendar.year}`}
          items={[
            { value: entries.length, label: `Sorties ${calendar.year}` },
            { value: calendar.upcoming.length, label: 'À venir' },
            { value: calendar.released.length, label: 'Déjà sorties' },
          ]}
        />
      </PageHero>
      <Container>
        <div className={styles.calendarContent}>
          <ReleaseMonths
            id="a-paraitre"
            eyebrow="À paraître"
            title={`Prochaines sorties ${calendar.year}`}
            entries={calendar.upcoming}
          />
          <ReleaseMonths
            id="deja-sorties"
            eyebrow="Déjà sorties"
            title={`Sorties ${calendar.year} déjà parues`}
            entries={calendar.released}
          />
          <ExploreSection
            eyebrow="Calendrier des sorties"
            title="Continuer l’exploration"
            groups={[
              {
                title: 'Autres calendriers',
                links: [
                  { href: CALENDAR_PATH, label: 'Prochaines sorties, tous jeux' },
                  ...others.map((page) => ({
                    href: page.path,
                    label: page.label,
                  })),
                ],
              },
            ]}
          />
        </div>
      </Container>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: calendar.path,
            name: calendar.heading,
            description: calendar.text.description,
            mainEntity: linked.length ? itemListNode(linked) : null,
          }),
        )}
      />
    </main>
  );
}
