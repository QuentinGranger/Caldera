// What each row would do, and what changes against the supplier's current
// offer. Nothing here writes: the preview shows it, the administrator
// validates, the importer applies it. Pure module.
import type { Candidate, MatchKind, MatchResult } from './matching';
import type { Issue, NormalizedValues } from './normalize';

export type RowAction =
  | 'CREATE_PRODUCT'
  | 'CREATE_OFFER'
  | 'UPDATE_OFFER'
  | 'UNCHANGED'
  | 'REVIEW'
  | 'REJECT'
  | 'IGNORE';

export type ChangeKind =
  | 'NEW_OFFER'
  | 'PRICE_DOWN'
  | 'PRICE_UP'
  | 'BACK_IN_STOCK'
  | 'OUT_OF_STOCK'
  | 'STOCK'
  | 'DISAPPEARED'
  | 'REAPPEARED'
  | 'RELEASE_DATE'
  | 'PACKAGING'
  | 'INFO';

export type Change = {
  kind: ChangeKind;
  field: string | null;
  before: string | number | null;
  after: string | number | null;
};

/** The supplier's offer as stored, values in the normalised form. */
export type OfferSnapshot = Omit<NormalizedValues, 'supplierSku'> & {
  id: string;
  supplierSku: string;
  variantId: string | null;
  status: 'ACTIVE' | 'MISSING';
};

export type AnalysedRow = {
  number: number;
  values: NormalizedValues;
  issues: Issue[];
  match: MatchKind;
  variantId: string | null;
  candidates: Candidate[];
  offerId: string | null;
  action: RowAction;
  changes: Change[];
};

/** A doubt on these fields stops the row until a person decides. */
const KEY_FIELDS = new Set([
  'supplierSku',
  'ean',
  'name',
  'language',
  'purchasePrice',
]);

/** Fields copied onto the offer; `null` never erases a known value. */
export const OFFER_FIELDS = [
  'ean',
  'name',
  'brand',
  'game',
  'series',
  'category',
  'language',
  'condition',
  'purchasePrice',
  'purchasePriceInclTax',
  'msrp',
  'vatRate',
  'stock',
  'availability',
  'releaseDate',
  'restockDate',
  'minOrderQty',
  'packaging',
  'packSize',
  'description',
  'imageUrl',
  'productUrl',
] as const satisfies readonly (keyof NormalizedValues)[];

const inStock = (stock: number | null, availability: string) =>
  availability === 'IN_STOCK' ||
  (availability === 'UNKNOWN' && (stock ?? 0) > 0);

/** What the new values change on an existing offer. */
export function diffOffer(
  offer: OfferSnapshot,
  values: NormalizedValues,
): Change[] {
  const changes: Change[] = [];
  if (offer.status === 'MISSING')
    changes.push({
      kind: 'REAPPEARED',
      field: null,
      before: null,
      after: null,
    });
  if (
    values.purchasePrice !== null &&
    values.purchasePrice !== offer.purchasePrice
  ) {
    changes.push({
      kind:
        offer.purchasePrice !== null &&
        Number(values.purchasePrice) < Number(offer.purchasePrice)
          ? 'PRICE_DOWN'
          : 'PRICE_UP',
      field: 'purchasePrice',
      before: offer.purchasePrice,
      after: values.purchasePrice,
    });
  }
  const stockKnown = values.stock !== null || values.availability !== 'UNKNOWN';
  if (stockKnown) {
    const was = inStock(offer.stock, offer.availability);
    const now = inStock(
      values.stock ?? offer.stock,
      values.availability === 'UNKNOWN'
        ? offer.availability
        : values.availability,
    );
    if (!was && now)
      changes.push({
        kind: 'BACK_IN_STOCK',
        field: 'stock',
        before: offer.stock,
        after: values.stock,
      });
    else if (was && !now)
      changes.push({
        kind: 'OUT_OF_STOCK',
        field: 'stock',
        before: offer.stock,
        after: values.stock,
      });
    else if (values.stock !== null && values.stock !== offer.stock)
      changes.push({
        kind: 'STOCK',
        field: 'stock',
        before: offer.stock,
        after: values.stock,
      });
    else if (
      values.availability !== 'UNKNOWN' &&
      values.availability !== offer.availability
    )
      changes.push({
        kind: 'STOCK',
        field: 'availability',
        before: offer.availability,
        after: values.availability,
      });
  }
  if (values.releaseDate !== null && values.releaseDate !== offer.releaseDate)
    changes.push({
      kind: 'RELEASE_DATE',
      field: 'releaseDate',
      before: offer.releaseDate,
      after: values.releaseDate,
    });
  for (const field of ['packaging', 'packSize'] as const)
    if (values[field] !== null && values[field] !== offer[field])
      changes.push({
        kind: 'PACKAGING',
        field,
        before: offer[field],
        after: values[field],
      });
  for (const field of [
    'ean',
    'name',
    'brand',
    'game',
    'series',
    'category',
    'language',
    'condition',
    'purchasePriceInclTax',
    'msrp',
    'vatRate',
    'restockDate',
    'minOrderQty',
    'description',
    'imageUrl',
    'productUrl',
  ] as const)
    if (values[field] !== null && values[field] !== offer[field])
      changes.push({
        kind: 'INFO',
        field,
        before: offer[field],
        after: values[field],
      });
  return changes;
}

/** A new product is only created from data that leaves no doubt. */
function reliableForCreation(values: NormalizedValues, issues: Issue[]) {
  return (
    Boolean(values.name) &&
    Boolean(values.supplierSku || values.ean) &&
    !issues.some(
      (issue) => issue.level !== 'info' && KEY_FIELDS.has(issue.field),
    )
  );
}

export function analyzeRows(
  rows: readonly {
    number: number;
    values: NormalizedValues;
    issues: Issue[];
  }[],
  match: (values: NormalizedValues) => MatchResult,
  offers: ReadonlyMap<string, OfferSnapshot>,
): AnalysedRow[] {
  // The same reference or EAN twice in one file: neither row decides alone.
  const seenSku = new Map<string, number>();
  const seenEan = new Map<string, number>();
  for (const row of rows) {
    const sku = row.values.supplierSku?.toUpperCase();
    if (sku) seenSku.set(sku, (seenSku.get(sku) ?? 0) + 1);
    if (row.values.ean)
      seenEan.set(row.values.ean, (seenEan.get(row.values.ean) ?? 0) + 1);
  }
  return rows.map((row) => {
    const issues = [...row.issues];
    const sku = row.values.supplierSku?.toUpperCase() ?? null;
    const duplicate =
      (sku && seenSku.get(sku)! > 1) ||
      (row.values.ean && seenEan.get(row.values.ean)! > 1);
    if (duplicate)
      issues.push({
        field: 'row',
        value: row.values.supplierSku ?? row.values.ean ?? '',
        problem: 'Doublon dans le fichier (même référence ou même EAN)',
        level: 'review',
      });
    const base = {
      number: row.number,
      values: row.values,
      issues,
      changes: [] as Change[],
    };
    if (
      issues.some(
        (issue) =>
          issue.level === 'error' &&
          (issue.field === 'name' || issue.field === 'supplierSku'),
      )
    )
      return {
        ...base,
        match: 'INVALID',
        variantId: null,
        candidates: [],
        offerId: null,
        action: 'REJECT',
      };
    const result = match(row.values);
    const offer = sku ? offers.get(sku) : undefined;
    const doubtful =
      duplicate ||
      issues.some(
        (issue) => issue.level === 'review' && KEY_FIELDS.has(issue.field),
      );
    const common = {
      ...base,
      match: result.match,
      variantId: result.variantId,
      candidates: result.candidates,
      offerId: offer?.id ?? null,
    };
    if (result.match === 'PROBABLE' || result.match === 'AMBIGUOUS' || doubtful)
      return { ...common, action: 'REVIEW' };
    if (result.match === 'CERTAIN') {
      if (!offer)
        return {
          ...common,
          action: 'CREATE_OFFER',
          changes: [
            {
              kind: 'NEW_OFFER',
              field: null,
              before: null,
              after: row.values.supplierSku,
            },
          ],
        };
      const changes = diffOffer(offer, row.values);
      return {
        ...common,
        action: changes.length ? 'UPDATE_OFFER' : 'UNCHANGED',
        changes,
      };
    }
    // NEW: a draft product with its offer, only from reliable data.
    if (!reliableForCreation(row.values, issues))
      return { ...common, action: 'REVIEW' };
    return {
      ...common,
      action: 'CREATE_PRODUCT',
      changes: offer
        ? diffOffer(offer, row.values)
        : [
            {
              kind: 'NEW_OFFER',
              field: null,
              before: null,
              after: row.values.supplierSku,
            },
          ],
    };
  });
}

/** Offers of a full catalogue that the new file no longer lists. */
export function disappearedOffers(
  rows: readonly { values: NormalizedValues }[],
  offers: ReadonlyMap<string, OfferSnapshot>,
) {
  const present = new Set(
    rows.map((row) => row.values.supplierSku?.toUpperCase()).filter(Boolean),
  );
  return [...offers.values()].filter(
    (offer) =>
      offer.status === 'ACTIVE' &&
      !present.has(offer.supplierSku.toUpperCase()),
  );
}

export type ImportSummary = {
  rows: number;
  newProducts: number;
  existing: number;
  offersCreated: number;
  offersUpdated: number;
  unchanged: number;
  priceChanges: number;
  priceDown: number;
  priceUp: number;
  stockChanges: number;
  backInStock: number;
  outOfStock: number;
  unavailable: number;
  duplicates: number;
  errors: number;
  rejected: number;
  ignored: number;
  toReview: number;
  disappeared: number;
};

export function summarize(
  rows: readonly Pick<
    AnalysedRow,
    'action' | 'match' | 'changes' | 'issues' | 'values'
  >[],
  disappeared: number,
): ImportSummary {
  const count = (test: (row: (typeof rows)[number]) => boolean) =>
    rows.filter(test).length;
  const changes = (kinds: ChangeKind[]) =>
    count(
      (row) =>
        row.action !== 'REJECT' &&
        row.action !== 'IGNORE' &&
        row.changes.some((change) => kinds.includes(change.kind)),
    );
  return {
    rows: rows.length,
    newProducts: count((row) => row.action === 'CREATE_PRODUCT'),
    existing: count(
      (row) => row.match === 'CERTAIN' || row.match === 'PROBABLE',
    ),
    offersCreated: count(
      (row) =>
        (row.action === 'CREATE_OFFER' || row.action === 'CREATE_PRODUCT') &&
        row.changes.some((change) => change.kind === 'NEW_OFFER'),
    ),
    offersUpdated: count((row) => row.action === 'UPDATE_OFFER'),
    unchanged: count((row) => row.action === 'UNCHANGED'),
    priceChanges: changes(['PRICE_DOWN', 'PRICE_UP']),
    priceDown: changes(['PRICE_DOWN']),
    priceUp: changes(['PRICE_UP']),
    stockChanges: changes(['BACK_IN_STOCK', 'OUT_OF_STOCK', 'STOCK']),
    backInStock: changes(['BACK_IN_STOCK']),
    outOfStock: changes(['OUT_OF_STOCK']),
    unavailable: count(
      (row) =>
        row.values.availability === 'OUT_OF_STOCK' ||
        row.values.availability === 'DISCONTINUED',
    ),
    duplicates: count((row) =>
      row.issues.some((issue) => issue.problem.startsWith('Doublon')),
    ),
    errors: count((row) => row.issues.some((issue) => issue.level === 'error')),
    rejected: count((row) => row.action === 'REJECT'),
    ignored: count((row) => row.action === 'IGNORE'),
    toReview: count((row) => row.action === 'REVIEW'),
    disappeared,
  };
}
