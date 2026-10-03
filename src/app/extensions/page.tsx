import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { AisleNav } from '@/components/catalog/AisleNav';
import { ExtensionsPageSkeleton } from '@/components/loading/LoadingSkeleton';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import { EXTENSIONS_COPY } from '@/components/catalog/pageCopy';
import { PageHero } from '@/components/catalog/PageHero';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
  type SetEntry,
} from '@/components/landing/landingData';
import { getExtensionsIndex } from '@/components/landing/releaseData';
import { RECENT_EXTENSION_MONTHS } from '@/components/landing/landingText';
import { SetCard } from '@/components/landing/SetCard';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import type { SeoLink } from '@/lib/seo/types';
import catalogStyles from '@/components/catalog/Catalog.module.scss';
import landingStyles from '@/components/landing/Landing.module.scss';
import setStyles from '@/components/landing/Sets.module.scss';

const UPCOMING = 'a-venir';
const RECENT = 'extensions-recentes';
const RELEASED = 'deja-sorties';

function ExtensionSection({
  id,
  eyebrow,
  title,
  description,
  entries,
  emptyText,
  featuredFirst = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  entries: readonly SetEntry[];
  emptyText: string;
  featuredFirst?: boolean;
}) {
  return (
    <section
      id={id}
      className={landingStyles.section}
      aria-labelledby={`${id}-titre`}
    >
      <SectionTitle
        id={`${id}-titre`}
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      {entries.length ? (
        <ul className={setStyles.grid}>
          {entries.map((entry, position) => (
            <li key={entry.id}>
              <SetCard
                entry={entry}
                featured={featuredFirst && position === 0}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className={setStyles.emptyState}>{emptyText}</p>
      )}
    </section>
  );
}

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

/**
 * /extensions: one chronological map of releases, split into three mutually
 * exclusive sections. The shared SetCard keeps links, images and dates aligned
 * with every other catalogue surface.
 */
async function ExtensionsContent() {
  await connection();
  const index = await getExtensionsIndex();
  const ways: SeoLink[] = [
    {
      href: `#${UPCOMING}`,
      label: 'À venir',
      count: index.upcoming.length,
    },
    {
      href: `#${RECENT}`,
      label: 'Extensions récentes',
      count: index.recent.length,
    },
    {
      href: `#${RELEASED}`,
      label: 'Déjà sorties',
      count: index.released.length,
    },
    ...(index.calendarIndexable
      ? [{ href: CALENDAR_PATH, label: 'Calendrier des sorties' }]
      : []),
  ];
  const linked = [
    ...index.upcoming,
    ...index.recent,
    ...index.released,
  ].flatMap((entry) =>
    entry.href ? [{ path: entry.href, name: entry.name }] : [],
  );

  return (
    <CatalogShell
      hero={
        <PageHero
          breadcrumb={[
            { label: 'Accueil', href: '/' },
            { label: 'Extensions' },
          ]}
          path={EXTENSIONS_PATH}
          eyebrow={EXTENSIONS_COPY.eyebrow}
          title={index.heading}
          lead={EXTENSIONS_COPY.lead}
          view={EXTENSIONS_COPY.view}
          action={
            index.calendarIndexable
              ? { href: CALENDAR_PATH, label: 'Voir le calendrier' }
              : undefined
          }
        />
      }
      newsletter="Recevez les prochaines sorties, réassorts et sélections sans avoir à surveiller le catalogue."
      jsonLd={graph(
        collectionPageNode({
          path: EXTENSIONS_PATH,
          name: index.heading,
          description: index.text.description,
          mainEntity: linked.length ? itemListNode(linked) : null,
        }),
      )}
    >
      <div className={catalogStyles.explorer}>
        <AisleNav aisles={ways} label="Parcourir les extensions" />
      </div>

      <ExtensionSection
        id={UPCOMING}
        eyebrow="Sorties annoncées"
        title="À venir"
        description="Les prochaines extensions annoncées, de la sortie la plus proche à la plus lointaine."
        entries={index.upcoming}
        emptyText="Aucune extension annoncée pour le moment."
        featuredFirst
      />
      <ExtensionSection
        id={RECENT}
        eyebrow="Dernières sorties"
        title="Extensions récentes"
        description={`Les extensions sorties au cours des ${RECENT_EXTENSION_MONTHS} derniers mois, de la plus récente à la plus ancienne.`}
        entries={index.recent}
        emptyText={`Aucune extension sortie au cours des ${RECENT_EXTENSION_MONTHS} derniers mois.`}
      />
      <ExtensionSection
        id={RELEASED}
        eyebrow="Historique"
        title="Déjà sorties"
        description="Les extensions plus anciennes, de la plus récente à la plus ancienne."
        entries={index.released}
        emptyText="Aucune extension plus ancienne à afficher."
      />
    </CatalogShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ExtensionsPageSkeleton />}>
      <ExtensionsContent />
    </Suspense>
  );
}
