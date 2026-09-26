// schema.org builders (docs/seo-architecture.md §6). The structured data only
// describes what the page shows; missing facts are omitted, never guessed.
import { absoluteUrl, siteOrigin } from '@/lib/site';
import type { Availability } from '@/types/product';
import { HANDLING_TIME, ORGANIZATION, RETURN_POLICY } from './policies';
import type { FaqEntry } from './types';

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue | undefined };

export interface JsonLdNode {
  '@type': string | string[];
  '@id'?: string;
  [key: string]: JsonLdValue | undefined;
}

export interface JsonLdGraph {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
}

const SCHEMA = 'https://schema.org';

export const organizationId = () => `${siteOrigin()}/#organization`;
export const websiteId = () => `${siteOrigin()}/#website`;

/** Drops undefined values so the serialized JSON has no empty keys. */
function node(value: JsonLdNode): JsonLdNode {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as JsonLdNode;
}

export function graph(
  ...nodes: (JsonLdNode | null | undefined | false)[]
): JsonLdGraph {
  return {
    '@context': SCHEMA,
    '@graph': nodes.filter((entry): entry is JsonLdNode => Boolean(entry)),
  };
}

/**
 * JSON for an inline <script>: « < » is escaped so no </script> or <!-- can
 * close the element, U+2028/U+2029 so the text stays valid everywhere.
 */
export function serializeJsonLd(data: JsonLdGraph | JsonLdNode): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function organizationNode(): JsonLdNode {
  return node({
    '@type': 'Organization',
    '@id': organizationId(),
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: absoluteUrl(ORGANIZATION.path),
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(ORGANIZATION.logo.path),
      width: ORGANIZATION.logo.width,
      height: ORGANIZATION.logo.height,
    },
    email: ORGANIZATION.email,
  });
}

export function websiteNode(): JsonLdNode {
  return node({
    '@type': 'WebSite',
    '@id': websiteId(),
    url: absoluteUrl('/'),
    name: ORGANIZATION.name,
    inLanguage: 'fr-FR',
    publisher: { '@id': organizationId() },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/catalogue')}?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

export interface JsonLdTrailItem {
  name: string;
  path: string;
}

export function breadcrumbListNode(
  items: readonly JsonLdTrailItem[],
): JsonLdNode | null {
  if (items.length < 2) return null;
  return node({
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  });
}

/**
 * Breadcrumb component items → JSON-LD trail: linked items keep their href, the
 * current page (last item without href) uses `currentPath` or is left out.
 */
export function breadcrumbTrail(
  items: readonly { label: string; href?: string }[],
  currentPath?: string,
): JsonLdTrailItem[] {
  return items.flatMap((item, index) => {
    const path =
      item.href ?? (index === items.length - 1 ? currentPath : undefined);
    return path ? [{ name: item.label, path }] : [];
  });
}

export interface ItemListEntry {
  path: string;
  name?: string;
}

export function itemListNode(
  items: readonly ItemListEntry[],
  { id, startPosition = 1 }: { id?: string; startPosition?: number } = {},
): JsonLdNode {
  return node({
    '@type': 'ItemList',
    '@id': id,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) =>
      node({
        '@type': 'ListItem',
        position: startPosition + index,
        url: absoluteUrl(item.path),
        name: item.name,
      }),
    ),
  });
}

export interface CollectionPageInput {
  path: string;
  name: string;
  description?: string | null;
  /** ItemList node or reference shown on the page. */
  mainEntity?: JsonLdNode | { '@id': string } | null;
}

export function collectionPageNode({
  path,
  name,
  description,
  mainEntity,
}: CollectionPageInput): JsonLdNode {
  const url = absoluteUrl(path);
  return node({
    '@type': 'CollectionPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description: description || undefined,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': websiteId() },
    mainEntity: mainEntity ?? undefined,
  });
}

export interface ArticleInput {
  path: string;
  headline: string;
  description?: string | null;
  dateModified: Date | string;
  datePublished?: Date | string | null;
  image?: string | null;
}

const isoDate = (value: Date | string) =>
  typeof value === 'string' ? value : value.toISOString();

export function articleNode({
  path,
  headline,
  description,
  dateModified,
  datePublished,
  image,
}: ArticleInput): JsonLdNode {
  const url = absoluteUrl(path);
  return node({
    '@type': 'Article',
    '@id': `${url}#article`,
    headline,
    description: description || undefined,
    url,
    mainEntityOfPage: url,
    inLanguage: 'fr-FR',
    dateModified: isoDate(dateModified),
    datePublished: datePublished ? isoDate(datePublished) : undefined,
    image: image ? absoluteUrl(image) : undefined,
    author: { '@id': organizationId() },
    publisher: { '@id': organizationId() },
  });
}

export interface DefinedTermInput {
  path: string;
  name: string;
  description?: string | null;
  /** Glossary index path, e.g. /glossaire. */
  termSetPath?: string;
}

const termId = (path: string) => `${absoluteUrl(path)}#term`;
const termSetId = (path: string) => `${absoluteUrl(path)}#termset`;

export function definedTermNode({
  path,
  name,
  description,
  termSetPath,
}: DefinedTermInput): JsonLdNode {
  return node({
    '@type': 'DefinedTerm',
    '@id': termId(path),
    name,
    description: description || undefined,
    url: absoluteUrl(path),
    inDefinedTermSet: termSetPath
      ? { '@id': termSetId(termSetPath) }
      : undefined,
  });
}

export interface DefinedTermSetInput {
  path: string;
  name: string;
  description?: string | null;
  terms: readonly { path: string; name: string }[];
}

export function definedTermSetNode({
  path,
  name,
  description,
  terms,
}: DefinedTermSetInput): JsonLdNode {
  return node({
    '@type': 'DefinedTermSet',
    '@id': termSetId(path),
    name,
    description: description || undefined,
    url: absoluteUrl(path),
    hasDefinedTerm: terms.map((term) => ({
      '@type': 'DefinedTerm',
      '@id': termId(term.path),
      name: term.name,
      url: absoluteUrl(term.path),
    })),
  });
}

/** Only for a FAQ displayed on the page. */
export function faqPageNode(entries: readonly FaqEntry[]): JsonLdNode | null {
  const valid = entries.filter(
    (entry) => entry.question.trim() && entry.answer.trim(),
  );
  if (!valid.length) return null;
  return node({
    '@type': 'FAQPage',
    mainEntity: valid.map((entry) => ({
      '@type': 'Question',
      name: entry.question.trim(),
      acceptedAnswer: { '@type': 'Answer', text: entry.answer.trim() },
    })),
  });
}

// ---------------------------------------------------------------------------
// Product

const GTIN_KEYS: Record<number, string> = {
  8: 'gtin8',
  12: 'gtin12',
  13: 'gtin13',
  14: 'gtin14',
};

/** GS1 check digit over the full code. */
function hasValidCheckDigit(code: string): boolean {
  const digits = [...code].map(Number);
  const check = digits.pop() ?? 0;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** { gtin13: "…" } for a valid GTIN-8/12/13/14 barcode, {} otherwise. */
export function gtinProperty(
  barcode: string | null | undefined,
): Record<string, string> {
  const code = barcode?.trim() ?? '';
  const key = GTIN_KEYS[code.length];
  if (!key || !/^\d+$/.test(code) || !hasValidCheckDigit(code)) return {};
  return { [key]: code };
}

const PLACEHOLDER_PATH = /^\/assets\/products\/placeholder[-.]/;

/** Replacement visuals (public/assets/products/placeholder-*) never describe a product. */
export function isPlaceholderImage(url: string): boolean {
  try {
    return PLACEHOLDER_PATH.test(new URL(url, 'http://local').pathname);
  } catch {
    return true;
  }
}

export type OfferAvailability = Availability | 'DISCONTINUED';

const AVAILABILITY_URLS: Record<OfferAvailability, string> = {
  IN_STOCK: `${SCHEMA}/InStock`,
  LOW_STOCK: `${SCHEMA}/InStock`,
  OUT_OF_STOCK: `${SCHEMA}/OutOfStock`,
  PREORDER: `${SCHEMA}/PreOrder`,
  DISCONTINUED: `${SCHEMA}/Discontinued`,
};

export interface ProductJsonLdVariant {
  sku: string;
  barcode?: string | null;
  /** Decimal string, e.g. "54.90". */
  price: string;
  isActive: boolean;
  /** Same computation as the product page (getAvailability on this variant). */
  availability: OfferAvailability;
}

export interface ShippingMethodInput {
  name: string;
  /** Decimal strings. */
  price: string;
  freeFromAmount?: string | null;
  /** Carrier transit time in business days, as shown at checkout. */
  minDays?: number | null;
  maxDays?: number | null;
  /** ISO 3166-1 alpha-2 codes of the active destinations. */
  countries: readonly string[];
}

export interface ProductJsonLdInput {
  name: string;
  /** /produit/{slug} */
  path: string;
  description?: string | null;
  images: readonly string[];
  /** Game name. */
  brand?: string | null;
  category?: string | null;
  releaseDate?: Date | null;
  variants: readonly ProductJsonLdVariant[];
  shippingMethods?: readonly ShippingMethodInput[];
}

function toCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

const BUSINESS_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
].map((day) => `${SCHEMA}/${day}`);

function shippingDetails(
  method: ShippingMethodInput,
  offerPrice: string,
): JsonLdValue | undefined {
  const countries = [...new Set(method.countries)].filter((code) =>
    /^[A-Z]{2}$/.test(code),
  );
  const rate = toCents(method.price);
  if (!countries.length || rate === null) return undefined;
  const threshold = method.freeFromAmount
    ? toCents(method.freeFromAmount)
    : null;
  const offerCents = toCents(offerPrice);
  const free =
    threshold !== null && offerCents !== null && offerCents >= threshold;
  const hasTransit =
    Number.isInteger(method.minDays) &&
    Number.isInteger(method.maxDays) &&
    (method.minDays ?? 0) >= 0 &&
    (method.maxDays ?? 0) >= (method.minDays ?? 0);
  return {
    '@type': 'OfferShippingDetails',
    name: method.name,
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: free ? 0 : rate / 100,
      currency: 'EUR',
    },
    shippingDestination: countries.map((code) => ({
      '@type': 'DefinedRegion',
      addressCountry: code,
    })),
    ...(hasTransit
      ? {
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            businessDays: {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: BUSINESS_DAYS,
            },
            handlingTime: {
              '@type': 'QuantitativeValue',
              minValue: HANDLING_TIME.minDays,
              maxValue: HANDLING_TIME.maxDays,
              unitCode: 'DAY',
            },
            transitTime: {
              '@type': 'QuantitativeValue',
              minValue: method.minDays ?? 0,
              maxValue: method.maxDays ?? 0,
              unitCode: 'DAY',
            },
          },
        }
      : {}),
  };
}

const RETURN_METHODS: Record<(typeof RETURN_POLICY)['method'], string> = {
  mail: `${SCHEMA}/ReturnByMail`,
};
const RETURN_FEES: Record<(typeof RETURN_POLICY)['fees'], string> = {
  customer: `${SCHEMA}/ReturnFeesCustomerResponsibility`,
};

/** From RETURN_POLICY (CGV): 14-day window, return by mail at the customer's cost. */
export function merchantReturnPolicyNode(): JsonLdValue {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: [...RETURN_POLICY.countries],
    returnPolicyCountry: RETURN_POLICY.returnCountry,
    returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: RETURN_POLICY.days,
    returnMethod: RETURN_METHODS[RETURN_POLICY.method],
    returnFees: RETURN_FEES[RETURN_POLICY.fees],
    merchantReturnLink: absoluteUrl(RETURN_POLICY.path),
  };
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Product with one Offer per active variant. Returns null without an active
 * variant: such a page is noindex and carries no Product markup.
 */
export function productNode(input: ProductJsonLdInput): JsonLdNode | null {
  const variants = input.variants.flatMap((variant) => {
    const cents = variant.isActive ? toCents(variant.price) : null;
    return cents === null
      ? []
      : [{ ...variant, price: (cents / 100).toFixed(2) }];
  });
  if (!variants.length) return null;
  const url = absoluteUrl(input.path);
  const images = [
    ...new Set(
      input.images
        .map((image) => image.trim())
        .filter((image) => image && !isPlaceholderImage(image))
        .map(absoluteUrl),
    ),
  ];
  const returnPolicy = merchantReturnPolicyNode();
  const offers = variants.map((variant) => {
    const shipping = (input.shippingMethods ?? [])
      .map((method) => shippingDetails(method, variant.price))
      .filter((detail): detail is JsonLdValue => detail !== undefined);
    return node({
      '@type': 'Offer',
      sku: variant.sku,
      ...gtinProperty(variant.barcode),
      price: variant.price,
      priceCurrency: 'EUR',
      availability: AVAILABILITY_URLS[variant.availability],
      availabilityStarts:
        variant.availability === 'PREORDER' && input.releaseDate
          ? isoDay(input.releaseDate)
          : undefined,
      itemCondition: `${SCHEMA}/NewCondition`,
      url,
      seller: { '@id': organizationId() },
      shippingDetails: shipping.length ? shipping : undefined,
      hasMerchantReturnPolicy: returnPolicy,
    });
  });
  const single = variants.length === 1 ? variants[0] : undefined;
  return node({
    '@type': 'Product',
    '@id': `${url}#product`,
    name: input.name,
    description: input.description?.trim() || undefined,
    url,
    image: images.length ? images : undefined,
    sku: single?.sku,
    ...(single ? gtinProperty(single.barcode) : {}),
    brand: input.brand ? { '@type': 'Brand', name: input.brand } : undefined,
    category: input.category || undefined,
    offers: offers.length === 1 ? offers[0] : offers,
  });
}
