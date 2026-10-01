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
import {
  getGlossaryDocument,
  type GlossaryDocument,
} from '@/lib/content/glossaryDocument';
import { isShopGame } from '@/lib/catalog/shopGame';
import { getContentLinks, type ContentLinks } from '@/lib/seo/links';
import { formatDateFr, listFr, type MetadataText } from '@/lib/seo/metadata';
import type { IndexDecision } from '@/lib/seo/types';
import {
  GLOSSARY_PATH,
  GUIDES_PATH,
  GUIDE_KINDS_IN_TEXT,
  editorialDecision,
  fitSentences,
  fittingTitle,
  groupGuides,
  guideCountsLabel,
  isGuideKind,
  kindCount,
  latestUpdate,
  upperFirst,
  type KindGroup,
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
  /** The A to Z of the Pokémon TCG (content/pages/glossaire-pokemon.md). */
  document: GlossaryDocument;
  /** Terms with a page of their own, about Pokémon or no game in particular. */
  fiches: ContentEntry[];
  heading: string;
  /** « 170 termes du JCC Pokémon, d’Ability à Lost Zone. » */
  summary: string;
  updated: Date | null;
  text: MetadataText;
  decision: IndexDecision;
}

export const getGlossaryIndex = cache(async (): Promise<GlossaryIndex> => {
  const [all, document] = await Promise.all([
    getAllContent(),
    getGlossaryDocument(),
  ]);
  const fiches = all.filter(
    (entry) => entry.kind === 'glossaire' && isShopGame(entry.games),
  );
  const { terms } = document;
  const first = terms[0]?.text.split(' — ')[0];
  const last = terms.at(-1)?.text.split(' — ')[0];
  const summary = !terms.length
    ? 'Aucun terme publié pour le moment.'
    : `${kindCount('glossaire', terms.length)} du JCC Pokémon, de ${first} à ${last}.`;
  const updates = [document.updated, latestUpdate(fiches)].filter(
    (date): date is Date => date !== null,
  );
  return {
    document,
    fiches,
    heading: document.title,
    summary,
    updated: updates.length
      ? new Date(Math.max(...updates.map((date) => date.getTime())))
      : null,
    text: { title: document.title, description: document.description },
    decision: editorialDecision(
      GLOSSARY_PATH,
      terms.length > 0 || fiches.length > 0,
    ),
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
