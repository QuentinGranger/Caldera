// Data of /questions and /actualites: indexes and pages, with the products and
// landings matching each entry.
import 'server-only';
import { cache } from 'react';
import {
  getAllContent,
  getContentEntry,
  getRelatedContent,
  type ContentEntry,
} from '@/lib/content';
import { getContentLinks } from '@/lib/seo/links';
import { formatDateFr, type MetadataText } from '@/lib/seo/metadata';
import type { IndexDecision } from '@/lib/seo/types';
import type { EditorialPage } from './content';
import { DELIVERY_ZONE } from './delivery';
import { SHOP_FAQ_UPDATED } from './shopFaq';
import { RETURN_POLICY } from '@/lib/seo/policies';
import {
  editorialDecision,
  fitSentences,
  fittingTitle,
  kindCount,
  latestUpdate,
  upperFirst,
} from './editorial';

export const QUESTIONS_PATH = '/questions';
export const NEWS_PATH = '/actualites';

const PRODUCT_LIMIT = 8;
const RELATED_LIMIT = 6;

export interface SectionIndex {
  entries: ContentEntry[];
  heading: string;
  summary: string;
  updated: Date | null;
  text: MetadataText;
  decision: IndexDecision;
}

/**
 * /questions: the shop's FAQ (shopFaq.ts), then the questions about the
 * cards themselves, each with its own page. Always indexable: the FAQ is.
 */
export const getQuestionsIndex = cache(async (): Promise<SectionIndex> => {
  const entries = (await getAllContent()).filter(
    (entry) => entry.kind === 'question',
  );
  const heading = 'Questions fréquentes';
  const summary =
    'Commander, payer, être livré, changer d’avis : les réponses sur la boutique, d’après nos conditions générales de vente et le fonctionnement du site.';
  const latest = latestUpdate(entries);
  const updated =
    latest && latest > SHOP_FAQ_UPDATED ? latest : SHOP_FAQ_UPDATED;
  return {
    entries,
    heading,
    summary,
    updated,
    text: {
      title: 'Questions fréquentes : commande, livraison et retours',
      description: fitSentences([
        `Commande, paiement, livraison en ${DELIVERY_ZONE}, retours sous ${RETURN_POLICY.days} jours : les réponses sur la boutique, d’après nos conditions de vente.`,
      ]),
    },
    decision: editorialDecision(QUESTIONS_PATH, true),
  };
});

export const getNewsIndex = cache(async (): Promise<SectionIndex> => {
  const entries = (await getAllContent())
    .filter((entry) => entry.kind === 'actualite')
    .sort((a, b) => b.published.getTime() - a.published.getTime());
  const latest = entries[0];
  const heading = 'Actualités de la boutique et des jeux de cartes';
  const summary = latest
    ? `${upperFirst(kindCount('actualite', entries.length))}, la dernière publiée le ${formatDateFr(latest.published)} : ${latest.title}.`
    : 'Aucune actualité publiée pour le moment.';
  return {
    entries,
    heading,
    summary,
    updated: latest?.published ?? null,
    text: {
      title: fittingTitle(heading, 'Actualités'),
      description: fitSentences([summary]),
    },
    decision: editorialDecision(NEWS_PATH, entries.length > 0),
  };
});

/** A question or a news item; null for an unknown slug. */
export const getSectionPage = cache(
  async (
    section: 'questions' | 'actualites',
    slug: string,
  ): Promise<EditorialPage | null> => {
    const entry = await getContentEntry(section, slug);
    if (!entry) return null;
    const [related, shop] = await Promise.all([
      getRelatedContent(entry, RELATED_LIMIT),
      getContentLinks(entry, { limit: PRODUCT_LIMIT }),
    ]);
    return { entry, related, shop };
  },
);
