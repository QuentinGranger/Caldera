// Supplier offers between the database and the pipeline: the normalised
// form compared by the diff engine, and the flat record written in bulk and
// kept on each row so an import can be undone. Pure module.
import type { OfferSnapshot } from './analysis';
import type { FieldKey } from './fields';
import type { Availability, Language, NormalizedValues } from './normalize';

/** Limits of one import (Vercel functions: 60 s, 4.5 MB per request). */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const CHUNK_SIZE = 3 * 1024 * 1024;
export const MAX_ROWS = 20_000;
export const MAX_PDF_PAGES = 150;

/** Hidden category of the drafts: publication needs a real one. */
export const IMPORT_CATEGORY_SLUG = 'a-classer-imports-fournisseurs';

export type FileKind = 'CSV' | 'XLSX' | 'XLS' | 'PDF' | 'JSON';

export function fileKindFrom(name: string): FileKind | null {
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (extension) {
    case 'csv':
    case 'txt':
    case 'tsv':
      return 'CSV';
    case 'xlsx':
    case 'xlsm':
      return 'XLSX';
    case 'xls':
      return 'XLS';
    case 'pdf':
      return 'PDF';
    case 'json':
      return 'JSON';
    default:
      return null;
  }
}

/** The first bytes must agree with the extension (a renamed file is refused). */
export function contentMatches(kind: FileKind, bytes: Uint8Array) {
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  switch (kind) {
    case 'PDF':
      return starts(0x25, 0x50, 0x44, 0x46, 0x2d);
    case 'XLSX':
      return starts(0x50, 0x4b, 0x03, 0x04);
    case 'XLS':
      // Binary workbook, or the HTML / XML « .xls » some tools export.
      return (
        starts(0xd0, 0xcf, 0x11, 0xe0) || !bytes.subarray(0, 512).includes(0)
      );
    case 'CSV':
    case 'JSON':
      // Text: UTF-16 (with its byte order mark) or no NUL byte at all.
      return (
        starts(0xff, 0xfe) ||
        starts(0xfe, 0xff) ||
        !bytes.subarray(0, 4096).includes(0)
      );
  }
}

/** Offer as stored, fields in database form (decimals and dates as objects). */
export type StoredOffer = {
  id: string;
  supplierSku: string;
  variantId: string | null;
  ean: string | null;
  name: string;
  brand: string | null;
  game: string | null;
  series: string | null;
  category: string | null;
  language: Language | null;
  condition: string | null;
  purchasePrice: { toString(): string } | null;
  purchasePriceInclTax: { toString(): string } | null;
  msrp: { toString(): string } | null;
  vatRate: { toString(): string } | null;
  stock: number | null;
  availability: Availability;
  releaseDate: Date | null;
  restockDate: Date | null;
  minOrderQty: number | null;
  packaging: string | null;
  packSize: number | null;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  status: 'ACTIVE' | 'MISSING';
  missingSince: Date | null;
  lastImportId: string | null;
  lastSeenAt: Date;
};

/** Flat JSON record: bulk writes, and the « before » kept for a revert. */
export type OfferRecord = Omit<
  StoredOffer,
  | 'purchasePrice'
  | 'purchasePriceInclTax'
  | 'msrp'
  | 'vatRate'
  | 'releaseDate'
  | 'restockDate'
  | 'missingSince'
  | 'lastSeenAt'
> & {
  purchasePrice: string | null;
  purchasePriceInclTax: string | null;
  msrp: string | null;
  vatRate: string | null;
  releaseDate: string | null;
  restockDate: string | null;
  missingSince: string | null;
  lastSeenAt: string;
};

const decimal = (value: { toString(): string } | null) =>
  value === null ? null : Number(value.toString()).toFixed(2);
const day = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : null;

export function offerRecord(offer: StoredOffer): OfferRecord {
  return {
    ...offer,
    purchasePrice: decimal(offer.purchasePrice),
    purchasePriceInclTax: decimal(offer.purchasePriceInclTax),
    msrp: decimal(offer.msrp),
    vatRate: decimal(offer.vatRate),
    releaseDate: day(offer.releaseDate),
    restockDate: day(offer.restockDate),
    missingSince: offer.missingSince?.toISOString() ?? null,
    lastSeenAt: offer.lastSeenAt.toISOString(),
  };
}

/** The offer in the form the diff engine compares with a new row. */
export function offerSnapshot(offer: StoredOffer): OfferSnapshot {
  const record = offerRecord(offer);
  return {
    id: record.id,
    supplierSku: record.supplierSku,
    variantId: record.variantId,
    status: record.status,
    ean: record.ean,
    name: record.name,
    brand: record.brand,
    game: record.game,
    series: record.series,
    category: record.category,
    language: record.language,
    condition: record.condition,
    purchasePrice: record.purchasePrice,
    purchasePriceInclTax: record.purchasePriceInclTax,
    msrp: record.msrp,
    vatRate: record.vatRate,
    stock: record.stock,
    availability: record.availability,
    releaseDate: record.releaseDate,
    restockDate: record.restockDate,
    minOrderQty: record.minOrderQty,
    packaging: record.packaging,
    packSize: record.packSize,
    description: record.description,
    imageUrl: record.imageUrl,
    productUrl: record.productUrl,
  };
}

const MERGED = [
  'ean',
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
  'releaseDate',
  'restockDate',
  'minOrderQty',
  'packaging',
  'packSize',
  'description',
  'imageUrl',
  'productUrl',
] as const satisfies readonly (keyof NormalizedValues & keyof OfferRecord)[];

/**
 * The offer after this row: a value absent from the file never erases what
 * is known, an unknown availability keeps the previous one.
 */
export function mergeOffer(
  existing: OfferRecord | null,
  values: NormalizedValues,
  context: {
    id: string;
    importId: string;
    variantId: string | null;
    now: Date;
  },
): OfferRecord {
  const next = {
    id: existing?.id ?? context.id,
    supplierSku: existing?.supplierSku ?? values.supplierSku!,
    variantId: context.variantId ?? existing?.variantId ?? null,
    name: values.name ?? existing?.name ?? values.supplierSku!,
    availability:
      values.availability !== 'UNKNOWN'
        ? values.availability
        : (existing?.availability ?? 'UNKNOWN'),
    status: 'ACTIVE',
    missingSince: null,
    lastImportId: context.importId,
    lastSeenAt: context.now.toISOString(),
  } as OfferRecord;
  const target = next as Record<string, unknown>;
  for (const field of MERGED)
    target[field] = values[field] ?? existing?.[field] ?? null;
  return next;
}

/** Corrections typed by the administrator, applied over the file's cells. */
export type RawRow = {
  cells: string[];
  corrections?: Partial<Record<FieldKey, string>>;
};

export function rowCells(
  headers: readonly string[],
  raw: RawRow,
  mapping: Partial<Record<FieldKey, string>>,
) {
  const cells: Record<string, string> = {};
  headers.forEach((header, index) => {
    cells[header] = raw.cells[index] ?? '';
  });
  const effective = { ...mapping };
  for (const [field, value] of Object.entries(raw.corrections ?? {})) {
    const column = `\u0000correction:${field}`;
    cells[column] = value ?? '';
    effective[field as FieldKey] = column;
  }
  return { cells, mapping: effective };
}
