// Data of /guides and /glossaire: content entries, facts for the texts, and
// the products and landings matching each entry.
import 'server-only';
import { cache } from 'react';
import type { ProductType } from '@/generated/prisma/client';
import { listProductsAvailableFirst } from '@/lib/catalog/queries';
import {
  getAllContent,
  getContentEntry,
  getRelatedContent,
  type ContentEntry,
  type ContentPage,
} from '@/lib/content';
import { GLOSSARY_SLUG_BY_PRODUCT_TYPE } from '@/lib/content/library';
import { getContentLinks, type ContentLinks } from '@/lib/seo/links';
import { formatDateFr, listFr, type MetadataText } from '@/lib/seo/metadata';
import type { IndexDecision } from '@/lib/seo/types';
import {
  GLOSSARY_PATH,
  GUIDES_PATH,
  GUIDE_KINDS_IN_TEXT,
  editorialDecision,
  fitList,
  fitSentences,
  fittingTitle,
  groupByLetter,
  groupGuides,
  guideCountsLabel,
  isGuideKind,
  kindCount,
  latestUpdate,
  lowerFirst,
  upperFirst,
  type KindGroup,
  type LetterGroup,
} from './editorial';

const PRODUCT_LIMIT = 8;
const RELATED_LIMIT = 6;

// ---------------------------------------------------------------------------
// Indexes

export interface GuidesIndex {
  groups: KindGroup[];
  /** H1 and meta title base, e.g. « Guides, comparatifs et dossiers ». */
  heading: string;
  /** « 5 guides, 2 comparatifs et 1 dossier » */
  counts: string;
  /** « 5 guides, 2 comparatifs et 1 dossier sur les cartes à collectionner. » */
  summary: string;
  updated: Date | null;
  glossaryCount: number;
  text: MetadataText;
  decision: IndexDecision;
}

const HEADING_NOUNS = {
  guide: 'guides',
  comparatif: 'comparatifs',
  dossier: 'dossiers',
} as const;

export const getGuidesIndex = cache(async (): Promise<GuidesIndex> => {
  const all = await getAllContent();
  const guides = all.filter((entry) => isGuideKind(entry.kind));
  const groups = groupGuides(guides);
  const present = GUIDE_KINDS_IN_TEXT.filter((kind) =>
    groups.some((group) => group.kind === kind),
  );
  const heading = present.length
    ? upperFirst(listFr(present.map((kind) => HEADING_NOUNS[kind])))
    : 'Guides';
  const counts = guideCountsLabel(groups);
  const summary = groups.length
    ? `${upperFirst(counts)} sur les cartes à collectionner.`
    : 'Aucun guide publié pour le moment.';
  const updated = latestUpdate(guides);
  const glossaryCount = all.filter(
    (entry) => entry.kind === 'glossaire',
  ).length;
  return {
    groups,
    heading,
    counts,
    summary,
    updated,
    glossaryCount,
    text: {
      title: fittingTitle(
        `${heading} sur les cartes à collectionner`,
        `${heading} : cartes à collectionner`,
        heading,
      ),
      description: fitSentences([
        summary,
        updated && `Mis à jour le ${formatDateFr(updated)}.`,
        glossaryCount > 0 &&
          `Glossaire de ${kindCount('glossaire', glossaryCount)}.`,
      ]),
    },
    decision: editorialDecision(GUIDES_PATH, guides.length > 0),
  };
});

export interface GlossaryIndex {
  letters: LetterGroup[];
  terms: ContentEntry[];
  heading: string;
  /** « 29 termes définis, de Blister à Version japonaise. » */
  summary: string;
  updated: Date | null;
  text: MetadataText;
  decision: IndexDecision;
}

/** « ETB (Elite Trainer Box) » → « ETB », « Carte promo » → « carte promo ». */
function termName(title: string): string {
  const name = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const [first = '', ...rest] = name.split(' ');
  const keepCase =
    /\p{Lu}/u.test(first.slice(1)) || rest.some((w) => /\p{Lu}/u.test(w));
  return keepCase ? name : lowerFirst(name);
}

const TYPE_TERMS = new Set(
  Object.values(GLOSSARY_SLUG_BY_PRODUCT_TYPE).filter((slug): slug is string =>
    Boolean(slug),
  ),
);

export const getGlossaryIndex = cache(async (): Promise<GlossaryIndex> => {
  const all = await getAllContent();
  const terms = all.filter((entry) => entry.kind === 'glossaire');
  const letters = groupByLetter(terms);
  const ordered = letters.flatMap((group) => group.entries);
  const first = ordered[0];
  const last = ordered.at(-1);
  const heading = 'Glossaire des cartes à collectionner';
  const summary = !terms.length
    ? 'Aucun terme publié pour le moment.'
    : first && last && ordered.length > 1
      ? `${kindCount('glossaire', terms.length)} définis, de ${first.title} à ${last.title}.`
      : `${kindCount('glossaire', terms.length)} défini.`;
  // Product formats first: the words met on the product pages.
  const featured = [
    ...ordered.filter((entry) => TYPE_TERMS.has(entry.slug)),
    ...ordered.filter((entry) => !TYPE_TERMS.has(entry.slug)),
  ].map((entry) => termName(entry.title));
  return {
    letters,
    terms: ordered,
    heading,
    summary,
    updated: latestUpdate(terms),
    text: {
      title: fittingTitle(`${heading} (JCC)`, heading),
      description: terms.length
        ? fitList(
            `Définitions de ${kindCount('glossaire', terms.length)} des cartes à collectionner : `,
            featured,
          )
        : summary,
    },
    decision: editorialDecision(GLOSSARY_PATH, terms.length > 0),
  };
});

// ---------------------------------------------------------------------------
// Pages

export interface EditorialPage {
  entry: ContentPage;
  related: ContentEntry[];
  shop: ContentLinks;
}

/** A guide, comparison or file; null for an unknown slug. */
export const getGuidePage = cache(
  async (slug: string): Promise<EditorialPage | null> => {
    const entry = await getContentEntry('guides', slug);
    if (!entry) return null;
    const [related, shop] = await Promise.all([
      getRelatedContent(entry, RELATED_LIMIT),
      getContentLinks(entry, { limit: PRODUCT_LIMIT }),
    ]);
    return { entry, related, shop };
  },
);

const TYPES_BY_TERM = new Map<string, ProductType[]>();
for (const [type, slug] of Object.entries(GLOSSARY_SLUG_BY_PRODUCT_TYPE) as [
  ProductType,
  string | null,
][])
  if (slug) TYPES_BY_TERM.set(slug, [...(TYPES_BY_TERM.get(slug) ?? []), type]);

/** Product types described by a glossary term (etb → ETB). */
export const productTypesOfTerm = (slug: string): readonly ProductType[] =>
  TYPES_BY_TERM.get(slug) ?? [];

/**
 * Products of the type the term names (within its games) when there are some,
 * else the products of its facets; landings always come from its facets.
 */
async function termShop(entry: ContentEntry): Promise<ContentLinks> {
  const types = productTypesOfTerm(entry.slug);
  const [links, typed] = await Promise.all([
    getContentLinks(entry, { limit: PRODUCT_LIMIT }),
    types.length
      ? listProductsAvailableFirst(
          {
            productType: { in: [...types] },
            ...(entry.games.length
              ? { game: { is: { slug: { in: [...entry.games] } } } }
              : {}),
          },
          PRODUCT_LIMIT,
        )
      : Promise.resolve([]),
  ]);
  return {
    products: typed.length ? typed : links.products,
    landings: links.landings,
  };
}

/** A glossary term; null for an unknown slug. */
export const getGlossaryTermPage = cache(
  async (slug: string): Promise<EditorialPage | null> => {
    const entry = await getContentEntry('glossaire', slug);
    if (!entry) return null;
    const [related, shop] = await Promise.all([
      getRelatedContent(entry, RELATED_LIMIT + 2),
      termShop(entry),
    ]);
    return { entry, related, shop };
  },
);
