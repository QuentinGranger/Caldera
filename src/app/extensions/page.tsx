import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { Archive, Clock3, Sparkles } from 'lucide-react';
import { ExtensionsPageSkeleton } from '@/components/loading/LoadingSkeleton';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import {
  EXTENSIONS_PATH,
  type SetEntry,
} from '@/components/landing/landingData';
import { getExtensionsIndex } from '@/components/landing/releaseData';
import { RECENT_EXTENSION_MONTHS } from '@/components/landing/landingText';
import { SetCard } from '@/components/landing/SetCard';
import {
  ExtensionsHero,
  ExtensionsNavigation,
  ExtensionsGuide,
} from '@/components/landing/ExtensionsWorld';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import styles from '@/components/landing/ExtensionsWorld.module.scss';

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
  number,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  entries: readonly SetEntry[];
  emptyText: string;
  featuredFirst?: boolean;
  number: number;
}) {
  const Icon = number === 1 ? Clock3 : number === 2 ? Sparkles : Archive;
  return (
    <section id={id} className={styles.chapter} aria-labelledby={`${id}-titre`}>
      <div className={styles.chapterHeading}>
        <span className={styles.chapterNumber} aria-hidden="true">
          0{number}
        </span>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id={`${id}-titre`}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.chapterBody}>
        {entries.length ? (
          <ul className={styles.setGrid}>
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
          <div className={styles.empty}>
            <Icon strokeWidth={1} aria-hidden="true" />
            <p>{emptyText}</p>
          </div>
        )}
      </div>
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
  const ways = [
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
      world="extensions"
      hero={<ExtensionsHero calendar={index.calendarIndexable} />}
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
      <ExtensionsNavigation entries={ways} />

      <ExtensionSection
        number={1}
        id={UPCOMING}
        eyebrow="Sorties annoncées"
        title="À venir"
        description="Les prochaines extensions annoncées, de la sortie la plus proche à la plus lointaine."
        entries={index.upcoming}
        emptyText="Aucune extension annoncée pour le moment."
        featuredFirst
      />
      <ExtensionSection
        number={2}
        id={RECENT}
        eyebrow="Dernières sorties"
        title="Extensions récentes"
        description={`Les extensions sorties au cours des ${RECENT_EXTENSION_MONTHS} derniers mois, de la plus récente à la plus ancienne.`}
        entries={index.recent}
        emptyText={`Aucune extension sortie au cours des ${RECENT_EXTENSION_MONTHS} derniers mois.`}
      />
      <ExtensionSection
        number={3}
        id={RELEASED}
        eyebrow="Historique"
        title="Déjà sorties"
        description="Les extensions plus anciennes, de la plus récente à la plus ancienne."
        entries={index.released}
        emptyText="Aucune extension plus ancienne à afficher."
      />
      <ExtensionsGuide />
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
