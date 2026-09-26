// /categorie/{slug}: multi-game family hub. A family sold for a single game
// points its canonical to /{game}/{family}.
import 'server-only';
import { cache } from 'react';
import {
  getIndexableListings,
  getScopeGames,
} from '@/components/catalog/listingHub';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb/Breadcrumb';
import type { CatalogScope } from '@/lib/catalog/params';
import {
  getCategories,
  getCategory,
  toCategoryRef,
} from '@/lib/catalog/taxonomy';
import { renderMarkdown, type ContentEntry } from '@/lib/content';
import { LANGUAGE_LABELS, landingPath } from '@/lib/seo/facets';
import { decideCategoryHubIndexation } from '@/lib/seo/indexation';
import {
  categoryHubText,
  type MetadataImage,
  type MetadataText,
} from '@/lib/seo/metadata';
import { findSlugRedirect } from '@/lib/seo/redirects';
import {
  categoryHubPath,
  getCategoryHubStats,
  getScopeBreakdown,
} from '@/lib/seo/registry';
import type {
  FaqEntry,
  IndexDecision,
  ScopeStats,
  SeoLink,
  SeoLinkGroup,
} from '@/lib/seo/types';
import {
  breakdownFamilies,
  getIndexedPages,
  getSiloGames,
  scopeGuides,
} from './landingData';
import {
  categoryHubFacts,
  categoryHubHeading,
  familyAndSubject,
  inSentence,
  type CountedLink,
  type Fact,
} from './landingText';

const MAX_LINKS = 12;

export interface CategoryHubView {
  name: string;
  path: string;
  catalogScope: CatalogScope;
  stats: ScopeStats;
  /** Decision of the unrefined first page. */
  decision: IndexDecision;
  text: MetadataText;
  image: MetadataImage | null;
  heading: string;
  description: string | null;
  facts: Fact[];
  breadcrumb: BreadcrumbItem[];
  editorialHtml: string;
  faq: FaqEntry[];
  guides: ContentEntry[];
  linkGroups: SeoLinkGroup[];
}

export type HubResolution =
  | { type: 'ok'; view: CategoryHubView }
  | { type: 'redirect'; path: string }
  | { type: 'not-found' };

/** /categorie/{slug}: the hub, or where its renamed slug now lives. */
export const resolveCategoryHub = cache(
  async (slug: string): Promise<HubResolution> => {
    const category = await getCategory(slug);
    if (!category) {
      const moved = await findSlugRedirect('CATEGORY', slug);
      const target =
        moved && (await getCategories()).find((c) => c.id === moved.entityId);
      return target && target.slug !== slug
        ? { type: 'redirect', path: categoryHubPath(target.slug) }
        : { type: 'not-found' };
    }
    const ref = toCategoryRef(category);
    const path = categoryHubPath(category.slug);
    const [hub, scopeGames, breakdown, indexed, games, listings] =
      await Promise.all([
        getCategoryHubStats(category.slug),
        getScopeGames({ category: { id: category.id } }),
        getScopeBreakdown({ category }),
        getIndexedPages(),
        getSiloGames(),
        getIndexableListings(),
      ]);
    if (!hub) return { type: 'not-found' };
    const counted = (href: string, label: string): SeoLink[] =>
      href !== path && indexed.has(href)
        ? [{ href, label, count: indexed.get(href) }]
        : [];
    const single = hub.singleGameSlug
      ? games.find((game) => game.slug === hub.singleGameSlug)
      : undefined;
    const decision = decideCategoryHubIndexation({
      path,
      stats: hub.stats,
      distinctGames: hub.distinctGames,
      hasGamelessProducts: hub.hasGamelessProducts,
      singleGamePath: single
        ? landingPath({ game: single, category: ref })
        : null,
    });
    const scopeGameRefs = scopeGames.games.map(({ game }) => game);
    const gameNames = scopeGameRefs.map((game) => game.name);
    const gameLinks: CountedLink[] = scopeGames.games.map(({ game, count }) => {
      const href = landingPath({ game, category: ref });
      return {
        label: game.name,
        count,
        href: indexed.has(href) ? href : undefined,
      };
    });
    const subFamilies = breakdownFamilies(breakdown, category, (childSlug) => {
      const href = categoryHubPath(childSlug);
      return indexed.has(href) ? href : undefined;
    });
    const languages: CountedLink[] = breakdown.languages.flatMap(
      ({ language, count }) =>
        language === 'OTHER'
          ? []
          : [{ label: LANGUAGE_LABELS[language], count }],
    );
    const parent = category.ancestors.at(-1);
    const linkGroups: SeoLinkGroup[] = [
      {
        title: `${category.name} par jeu`,
        links: scopeGameRefs.flatMap((game) =>
          counted(
            landingPath({ game, category: ref }),
            familyAndSubject(category.name, game.name),
          ),
        ),
      },
      {
        title: `Dans les ${inSentence(category.name)}`,
        links: category.children.flatMap((child) => {
          const hubLink = counted(
            categoryHubPath(child.slug),
            `${child.name} pour tous les jeux`,
          );
          if (hubLink.length) return hubLink;
          return scopeGameRefs.flatMap((game) =>
            counted(
              landingPath({ game, category: toCategoryRef(child) }),
              familyAndSubject(child.name, game.name),
            ),
          );
        }),
      },
      {
        title: 'Voir aussi',
        links: parent
          ? counted(
              categoryHubPath(parent.slug),
              `${parent.name} pour tous les jeux`,
            )
          : [],
      },
    ]
      .map((group) => ({ ...group, links: group.links.slice(0, MAX_LINKS) }))
      .filter((group) => group.links.length);
    return {
      type: 'ok',
      view: {
        name: category.name,
        path,
        catalogScope: { category: category.slug },
        stats: hub.stats,
        decision,
        text: categoryHubText({
          name: category.name,
          stats: hub.stats,
          gameNames,
          overrides: category,
        }),
        image: category.imageUrl
          ? { url: category.imageUrl, alt: category.name }
          : null,
        heading: categoryHubHeading(
          category.name,
          gameNames,
          hub.hasGamelessProducts,
        ),
        description: category.description,
        facts: categoryHubFacts({
          stats: hub.stats,
          games: gameLinks,
          gamelessCount: scopeGames.gamelessCount,
          families: subFamilies,
          languages,
        }),
        breadcrumb: [
          { label: 'Accueil', href: '/' },
          ...(listings.has('catalogue')
            ? [{ label: 'Catalogue', href: '/catalogue' }]
            : []),
          ...category.ancestors.flatMap((ancestor): BreadcrumbItem[] => {
            const href = categoryHubPath(ancestor.slug);
            return indexed.has(href) ? [{ label: ancestor.name, href }] : [];
          }),
          { label: category.name },
        ],
        editorialHtml: renderMarkdown(category.intro),
        faq: category.faq,
        guides: await scopeGuides({}, [
          category,
          ...[...category.ancestors].reverse(),
        ]),
        linkGroups,
      },
    };
  },
);
