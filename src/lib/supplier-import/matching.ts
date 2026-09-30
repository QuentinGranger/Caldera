// Which Caldera variant a supplier row is, in the order of trust asked for:
// EAN, known supplier offer, internal SKU, game / set / type / language,
// then the name alone, which never gives more than « probable ». Pure module.
import {
  normalizeEan,
  type Language,
  type NormalizedValues,
} from './normalize';

export type CatalogVariant = {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  language: Language;
  productName: string;
  productType: string;
  gameName: string | null;
  setName: string | null;
};

export type MatchKind =
  'CERTAIN' | 'PROBABLE' | 'NEW' | 'AMBIGUOUS' | 'INVALID';

export type Candidate = { variantId: string; reason: string; score: number };

export type MatchResult = {
  match: MatchKind;
  variantId: string | null;
  reason: string;
  candidates: Candidate[];
};

const STOP = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'et',
  'en',
  'the',
  'of',
  'a',
  'un',
  'une',
  'fr',
  'vf',
  'en',
  'eng',
  'jp',
  'version',
  'francaise',
  'anglaise',
  'pokemon',
  'tcg',
]);

export function nameTokens(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !STOP.has(word));
}

function bigrams(tokens: string[]) {
  const text = tokens.join(' ');
  const grams = new Map<string, number>();
  for (let index = 0; index < text.length - 1; index++) {
    const gram = text.slice(index, index + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

type Grams = { grams: Map<string, number>; total: number };

function gramsOf(value: string): Grams {
  const grams = bigrams(nameTokens(value));
  let total = 0;
  for (const count of grams.values()) total += count;
  return { grams, total };
}

function dice(left: Grams, right: Grams) {
  if (!left.total || !right.total) return 0;
  let common = 0;
  for (const [gram, count] of left.grams)
    common += Math.min(count, right.grams.get(gram) ?? 0);
  return (2 * common) / (left.total + right.total);
}

/** Sørensen–Dice similarity of two names, 0 to 1. */
export function nameSimilarity(a: string, b: string) {
  return dice(gramsOf(a), gramsOf(b));
}

const TYPES: [RegExp, string][] = [
  [/\b(etb|coffret dresseur|elite trainer)/, 'ETB'],
  [
    /\b(display|booster box|boite de 36|boite de 24|36 boosters|24 boosters|18 boosters)/,
    'DISPLAY',
  ],
  [/\b(tripack|tri pack|3 pack|3 boosters)/, 'TRIPACK'],
  [/\bblister/, 'BLISTER'],
  [/\bbundle/, 'BUNDLE'],
  [/\b(tin|pokebox|boite metal|boite en metal)/, 'TIN'],
  [/\b(deck|starter|kit de demarrage)/, 'DECK'],
  [
    /\b(protege|sleeves|classeur|binder|portfolio|tapis|playmat|toploader|deck box)/,
    'ACCESSORY',
  ],
  [/\b(coffret|collection|premium|box)/, 'COLLECTION_BOX'],
  [/\bbooster/, 'BOOSTER'],
];

/** Product type suggested by a name (drafts, and combination matching). */
export function productTypeFrom(value: string) {
  const text = nameTokens(value).join(' ');
  for (const [pattern, type] of TYPES) if (pattern.test(text)) return type;
  return 'OTHER';
}

/** Every word of `needle` is a word of the text. */
const containsAll = (text: string, words: readonly string[] | null) =>
  Boolean(words?.length) && words!.every((word) => text.includes(` ${word} `));

/** Candidates compared by name for one row, at most (roughly). */
const NEARBY_LIMIT = 300;

/** Words are indexed by their start: « flammes » finds « flamme ». */
const stem = (word: string) => word.slice(0, 4);

type Prepared = {
  variant: CatalogVariant;
  name: Grams;
  set: string[] | null;
  game: string[] | null;
};

export function createMatcher(
  variants: readonly CatalogVariant[],
  /** Offers of this supplier: reference (upper case) → linked variant. */
  offers: ReadonlyMap<string, { id: string; variantId: string | null }>,
) {
  const byEan = new Map<string, CatalogVariant[]>();
  const bySku = new Map<string, CatalogVariant>();
  const byId = new Map<string, CatalogVariant>();
  // Names are prepared once: each row is then compared with the few
  // products sharing a word with it, not the whole catalogue.
  const prepared: Prepared[] = [];
  const byWord = new Map<string, number[]>();
  for (const variant of variants) {
    byId.set(variant.id, variant);
    bySku.set(variant.sku.toUpperCase(), variant);
    const ean = variant.barcode ? normalizeEan(variant.barcode).value : null;
    if (ean) byEan.set(ean, [...(byEan.get(ean) ?? []), variant]);
    const set = variant.setName ? nameTokens(variant.setName) : null;
    const index = prepared.length;
    prepared.push({
      variant,
      name: gramsOf(variant.productName),
      set,
      game: variant.gameName ? nameTokens(variant.gameName) : null,
    });
    for (const word of new Set(
      [...nameTokens(variant.productName), ...(set ?? [])].map(stem),
    ))
      byWord.set(word, [...(byWord.get(word) ?? []), index]);
  }

  return (values: NormalizedValues): MatchResult => {
    const sku = values.supplierSku?.toUpperCase() ?? null;
    const offer = sku ? offers.get(sku) : undefined;
    // 1. EAN / GTIN.
    if (values.ean) {
      const found = byEan.get(values.ean) ?? [];
      if (found.length === 1) {
        if (offer?.variantId && offer.variantId !== found[0]!.id)
          return {
            match: 'AMBIGUOUS',
            variantId: null,
            reason:
              'L’EAN et l’offre fournisseur connue désignent deux produits différents',
            candidates: [
              { variantId: found[0]!.id, reason: 'EAN', score: 1 },
              {
                variantId: offer.variantId,
                reason: 'Offre fournisseur connue',
                score: 1,
              },
            ],
          };
        return {
          match: 'CERTAIN',
          variantId: found[0]!.id,
          reason: 'EAN',
          candidates: [],
        };
      }
      if (found.length > 1)
        return {
          match: 'AMBIGUOUS',
          variantId: null,
          reason: 'Plusieurs produits Caldera portent cet EAN',
          candidates: found.map((variant) => ({
            variantId: variant.id,
            reason: 'EAN',
            score: 1,
          })),
        };
    }
    // 2. Reference already linked for this supplier.
    if (offer?.variantId && byId.has(offer.variantId))
      return {
        match: 'CERTAIN',
        variantId: offer.variantId,
        reason: 'Offre fournisseur connue',
        candidates: [],
      };
    // 3. Internal SKU used by the supplier.
    if (sku && bySku.has(sku))
      return {
        match: 'CERTAIN',
        variantId: bySku.get(sku)!.id,
        reason: 'SKU Caldera',
        candidates: [],
      };
    if (!values.name)
      return { match: 'NEW', variantId: null, reason: '', candidates: [] };
    // 4. Game, set, type and language together.
    const type = productTypeFrom(values.name);
    const words = nameTokens(
      [values.name, values.series ?? '', values.game ?? ''].join(' '),
    );
    const text = ` ${words.join(' ')} `;
    const brand = ` ${nameTokens(values.brand ?? '').join(' ')} `;
    const name = gramsOf(values.name);
    // Rarest words first (a set name, a number); common ones (« booster »)
    // only while few candidates are found.
    const lists = [...new Set(words.map(stem))]
      .map((word) => byWord.get(word) ?? [])
      .filter((list) => list.length)
      .sort((a, b) => a.length - b.length);
    const nearby = new Set<number>();
    for (const list of lists) {
      if (nearby.size >= NEARBY_LIMIT && list.length > NEARBY_LIMIT / 4) break;
      for (const index of list) nearby.add(index);
    }
    const combined: Candidate[] = [];
    const fuzzy: Candidate[] = [];
    for (const index of nearby) {
      const { variant, set, game } = prepared[index]!;
      if (values.language && values.language !== variant.language) continue;
      let score = 0;
      if (type !== 'OTHER' && type === variant.productType) score += 0.35;
      if (values.language) score += 0.25;
      if (containsAll(text, set)) score += 0.25;
      if (containsAll(text, game) || containsAll(brand, game)) score += 0.15;
      if (score >= 0.85)
        combined.push({
          variantId: variant.id,
          reason: 'Jeu, extension, type et langue',
          score,
        });
      // 5. The name alone, last resort.
      const similarity = dice(name, prepared[index]!.name);
      if (similarity >= 0.6)
        fuzzy.push({
          variantId: variant.id,
          reason: `Nom proche (${Math.round(similarity * 100)} %)`,
          score: Math.round(similarity * 100) / 100,
        });
    }
    if (combined.length === 1)
      return {
        match: 'PROBABLE',
        variantId: combined[0]!.variantId,
        reason: combined[0]!.reason,
        candidates: combined,
      };
    fuzzy.sort((a, b) => b.score - a.score);
    const candidates = [
      ...combined,
      ...fuzzy.filter(
        (c) => !combined.some((d) => d.variantId === c.variantId),
      ),
    ].slice(0, 5);
    if (combined.length > 1)
      return {
        match: 'AMBIGUOUS',
        variantId: null,
        reason: 'Plusieurs produits Caldera correspondent',
        candidates,
      };
    const [best, second] = fuzzy;
    if (best && best.score >= 0.9 && (!second || second.score < 0.8))
      return {
        match: 'PROBABLE',
        variantId: best.variantId,
        reason: best.reason,
        candidates,
      };
    if (best)
      return {
        match: 'AMBIGUOUS',
        variantId: null,
        reason: 'Des produits Caldera au nom proche existent',
        candidates,
      };
    return {
      match: 'NEW',
      variantId: null,
      reason: 'Aucun produit Caldera correspondant',
      candidates: [],
    };
  };
}
