// Structured data checks of a crawled page: every ld+json block parses, has a
// @context, and every Product carries complete offers.

export interface StructuredDataProblem {
  kind: 'invalid' | 'no-context' | 'product-offer';
  detail: string;
}

export interface StructuredDataResult {
  /** Product nodes found anywhere in the blocks. */
  productCount: number;
  problems: StructuredDataProblem[];
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

function typesOf(node: JsonObject): string[] {
  return asArray(node['@type']).filter(
    (type): type is string => typeof type === 'string',
  );
}

/** « Product », « schema:Product » and « https://schema.org/Product ». */
function hasType(node: JsonObject, type: string): boolean {
  return typesOf(node).some((value) => value.split(/[/:#]/).pop() === type);
}

function hasContext(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasContext);
  return isObject(value);
}

/** Every object of the tree, the root included. */
function walk(value: unknown, visit: (node: JsonObject) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!isObject(value)) return;
  visit(value);
  for (const [key, child] of Object.entries(value))
    if (key !== '@context') walk(child, visit);
}

function isPrice(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim());
}

function offerPrice(offer: JsonObject): unknown {
  if (offer.price !== undefined) return offer.price;
  const specification = asArray(offer.priceSpecification).find(isObject);
  return specification?.price;
}

/** Missing parts of the offers of a Product; empty when complete. */
export function productOfferProblems(product: JsonObject): string[] {
  const offers = asArray(product.offers);
  if (!offers.length) return ['offers absent'];
  const problems: string[] = [];
  offers.forEach((offer, index) => {
    const label = offers.length > 1 ? `offre ${index + 1}` : 'offre';
    if (!isObject(offer)) {
      problems.push(`${label} : pas un objet`);
      return;
    }
    if (hasType(offer, 'AggregateOffer')) {
      if (!isPrice(offer.lowPrice))
        problems.push(`${label} : lowPrice absent ou invalide`);
      return;
    }
    if (!isPrice(offerPrice(offer)))
      problems.push(`${label} : price absent ou invalide`);
    const availability = offer.availability;
    if (typeof availability !== 'string' || !availability.trim())
      problems.push(`${label} : availability absente`);
  });
  return problems;
}

function productLabel(product: JsonObject): string {
  const name = product.name;
  return typeof name === 'string' && name.trim()
    ? `Product « ${name.trim()} »`
    : 'Product';
}

export function checkStructuredData(
  blocks: readonly string[],
): StructuredDataResult {
  let productCount = 0;
  const problems: StructuredDataProblem[] = [];
  blocks.forEach((raw, index) => {
    const block = blocks.length > 1 ? `bloc ${index + 1}` : 'bloc';
    let data: unknown;
    try {
      data = JSON.parse(raw.trim());
    } catch (error) {
      problems.push({
        kind: 'invalid',
        detail: `${block} : ${error instanceof Error ? error.message : String(error)}`,
      });
      return;
    }
    const roots = asArray(data);
    if (!roots.length || roots.some((root) => !isObject(root))) {
      problems.push({
        kind: 'invalid',
        detail: `${block} : ni objet ni liste d’objets`,
      });
      return;
    }
    for (const root of roots as JsonObject[]) {
      if (!hasContext(root['@context']))
        problems.push({ kind: 'no-context', detail: `${block} sans @context` });
      walk(root, (node) => {
        if (!hasType(node, 'Product')) return;
        productCount++;
        const missing = productOfferProblems(node);
        if (missing.length)
          problems.push({
            kind: 'product-offer',
            detail: `${productLabel(node)} : ${missing.join(', ')}`,
          });
      });
    }
  });
  return { productCount, problems };
}
