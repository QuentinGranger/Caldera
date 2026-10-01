import type { Metadata } from 'next';
import { connection } from 'next/server';
import { AisleNav } from '@/components/catalog/AisleNav';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import { EmptyState } from '@/components/catalog/EmptyState';
import { EXTENSIONS_COPY } from '@/components/catalog/pageCopy';
import { PageHero } from '@/components/catalog/PageHero';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
} from '@/components/landing/landingData';
import { getExtensionsIndex } from '@/components/landing/releaseData';
import { SetCard } from '@/components/landing/SetCard';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import type { SeoLink } from '@/lib/seo/types';
import catalogStyles from '@/components/catalog/Catalog.module.scss';
import landingStyles from '@/components/landing/Landing.module.scss';
import setStyles from '@/components/landing/Sets.module.scss';

const UPCOMING = 'a-venir';

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
 * /extensions: the map of the releases. The same entrance as the aisles,
 * then the announced sets, then those already out (newest first), game by
 * game; each set once, on the same card as everywhere else.
 */
export default async function Page() {
  await connection();
  const index = await getExtensionsIndex();
  const announced = new Set(index.upcoming.map((entry) => entry.id));
  const released = index.groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => !announced.has(entry.id)),
    }))
    .filter((group) => group.entries.length);
  const several = released.length > 1;
  const ways: SeoLink[] = [
    ...(index.upcoming.length
      ? [
          {
            href: `#${UPCOMING}`,
            label: 'À venir',
            count: index.upcoming.length,
          },
        ]
      : []),
    ...released.map((group) => ({
      href: `#${group.id}`,
      label: several ? (group.gameName ?? 'Autres extensions') : 'Déjà sorties',
      count: group.entries.length,
    })),
    ...(index.calendarIndexable
      ? [{ href: CALENDAR_PATH, label: 'Calendrier des sorties' }]
      : []),
  ];
  const linked = index.groups.flatMap((group) =>
    group.entries.flatMap((entry) =>
      entry.href ? [{ path: entry.href, name: entry.name }] : [],
    ),
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
        {!index.total && (
          <EmptyState
            title="Aucune extension en ligne pour le moment"
            actions={[{ href: '/catalogue', label: 'Voir tous les produits' }]}
          />
        )}
      </div>
      {index.upcoming.length > 0 && (
        <section
          id={UPCOMING}
          className={landingStyles.section}
          aria-labelledby={`${UPCOMING}-titre`}
        >
          <SectionTitle
            id={`${UPCOMING}-titre`}
            eyebrow="Sorties annoncées"
            title="À venir"
          />
          <ul className={setStyles.grid}>
            {index.upcoming.map((entry, position) => (
              <li key={entry.id}>
                <SetCard entry={entry} featured={position === 0} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {released.map((group) => (
        <section
          key={group.id}
          id={group.id}
          className={landingStyles.section}
          aria-labelledby={`${group.id}-titre`}
        >
          <SectionTitle
            id={`${group.id}-titre`}
            eyebrow={group.gameName ?? 'Extensions'}
            title={several ? group.title : 'Déjà sorties'}
            link={
              group.href && group.gameName
                ? {
                    href: group.href,
                    label: `Voir tous les produits ${group.gameName}`,
                  }
                : undefined
            }
          />
          <ul className={setStyles.grid}>
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <SetCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </CatalogShell>
  );
}
