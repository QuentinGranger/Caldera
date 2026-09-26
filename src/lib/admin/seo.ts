import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { toFaqEntries } from '@/lib/catalog/taxonomy';
import { isReservedFacetSlug, isReservedRootSlug } from '@/lib/seo/facets';
import type { FaqEntry } from '@/lib/seo/types';
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_MAX_ENTRIES,
  FAQ_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
  FAQ_SEPARATOR,
  INTRO_MAX_LENGTH,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
} from './limits';
import { AdminError, text } from './validation';

// The layout template already appends the brand to every title.
const BRAND_SUFFIX = /[|–—·:-]\s*(?:les\s+terres\s+de\s+)?caldera\s*$/i;

function limited(form: FormData, key: string, max: number, label: string) {
  const value = text(form, key, Number.MAX_SAFE_INTEGER, false);
  if (value.length > max)
    throw new AdminError(
      `${label} : ${max} caractères maximum (${value.length} saisis).`,
    );
  return value;
}

/** Parses the FAQ textarea, one « Question :: Réponse » pair per line. */
export function parseFaq(value: string): FaqEntry[] {
  const entries: FaqEntry[] = [];
  const questions = new Set<string>();
  value.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const separator = line.indexOf(FAQ_SEPARATOR);
    const question = separator < 0 ? '' : line.slice(0, separator).trim();
    const answer =
      separator < 0 ? '' : line.slice(separator + FAQ_SEPARATOR.length).trim();
    if (!question || !answer)
      throw new AdminError(
        `FAQ, ligne ${index + 1} : écrivez « Question :: Réponse ».`,
      );
    if (question.length > FAQ_QUESTION_MAX_LENGTH)
      throw new AdminError(
        `FAQ, ligne ${index + 1} : question de ${FAQ_QUESTION_MAX_LENGTH} caractères maximum.`,
      );
    if (answer.length > FAQ_ANSWER_MAX_LENGTH)
      throw new AdminError(
        `FAQ, ligne ${index + 1} : réponse de ${FAQ_ANSWER_MAX_LENGTH} caractères maximum.`,
      );
    const key = question.toLocaleLowerCase('fr-FR');
    if (questions.has(key))
      throw new AdminError(
        `FAQ, ligne ${index + 1} : cette question est déjà posée.`,
      );
    questions.add(key);
    entries.push({ question, answer });
  });
  if (entries.length > FAQ_MAX_ENTRIES)
    throw new AdminError(`FAQ : ${FAQ_MAX_ENTRIES} questions maximum.`);
  return entries;
}

/** Stored FAQ back to the textarea format: one line per entry, parseable again. */
export function faqInput(value: Prisma.JsonValue | null): string {
  return toFaqEntries(value)
    .map(
      ({ question, answer }) =>
        `${question.replaceAll(FAQ_SEPARATOR, ':').replace(/\s+/g, ' ')} ${FAQ_SEPARATOR} ${answer.replace(/\s+/g, ' ')}`,
    )
    .join('\n');
}

/** seoTitle / seoDescription overrides: empty means generated from the data. */
export function seoMetaFields(form: FormData) {
  const seoTitle = limited(form, 'seoTitle', SEO_TITLE_MAX_LENGTH, 'Titre SEO');
  if (BRAND_SUFFIX.test(seoTitle))
    throw new AdminError(
      'Titre SEO : n’ajoutez pas « Caldera », le site l’ajoute à chaque titre.',
    );
  return {
    seoTitle: seoTitle || null,
    seoDescription:
      limited(
        form,
        'seoDescription',
        SEO_DESCRIPTION_MAX_LENGTH,
        'Meta description',
      ) || null,
  };
}

/** Editorial block of a game, set or category page: intro, FAQ and overrides. */
export function editorialFields(form: FormData) {
  const faq = parseFaq(limited(form, 'faq', FAQ_MAX_LENGTH, 'FAQ'));
  return {
    intro: limited(form, 'intro', INTRO_MAX_LENGTH, 'Introduction') || null,
    faq: faq.length
      ? faq.map(({ question, answer }) => ({ question, answer }))
      : Prisma.DbNull,
    ...seoMetaFields(form),
  };
}

/** A game slug is a root segment: never a reserved route, unique among games. */
export async function assertGameSlug(
  tx: Prisma.TransactionClient,
  slug: string,
  gameId?: string,
) {
  if (isReservedRootSlug(slug))
    throw new AdminError(
      `Le slug « ${slug} » est réservé à une page du site : choisissez-en un autre.`,
    );
  const other = await tx.game.findFirst({
    where: { slug, ...(gameId ? { NOT: { id: gameId } } : {}) },
    select: { name: true },
  });
  if (other)
    throw new AdminError(
      `Le slug « ${slug} » est déjà utilisé par le jeu « ${other.name} ».`,
    );
}

/**
 * Set and category slugs share the facet segment of /{game}/{facet}: never a
 * language or status slug, and never the slug of a set or of a category.
 */
export async function assertFacetSlug(
  tx: Prisma.TransactionClient,
  kind: 'set' | 'category',
  slug: string,
  entityId?: string,
) {
  if (isReservedFacetSlug(slug))
    throw new AdminError(
      `Le slug « ${slug} » est réservé aux filtres de langue et de disponibilité : choisissez-en un autre.`,
    );
  const exclude = entityId ? { NOT: { id: entityId } } : {};
  const set = await tx.tcgSet.findFirst({
    where: { slug, ...(kind === 'set' ? exclude : {}) },
    select: { name: true },
  });
  const category = set
    ? null
    : await tx.category.findFirst({
        where: { slug, ...(kind === 'category' ? exclude : {}) },
        select: { name: true },
      });
  if (!set && !category) return;
  const owner = set
    ? `l’extension « ${set.name} »`
    : `la catégorie « ${category!.name} »`;
  const shared =
    (kind === 'set') === Boolean(set)
      ? ''
      : ' Une extension et une catégorie ne peuvent pas partager une adresse.';
  throw new AdminError(
    `Le slug « ${slug} » est déjà utilisé par ${owner}.${shared}`,
  );
}
