import 'server-only';
import { createHash } from 'node:crypto';
import type {
  Prisma,
  SupplierChangeKind,
  SupplierImportStatus,
  SupplierRowAction,
} from '@/generated/prisma/client';
import { requireAdmin } from '@/lib/admin/auth';
import {
  pageNumber,
  pageSize,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { getPrisma } from '@/lib/db/prisma';
import { signatureSource } from './mapping';
import type { Candidate } from './matching';
import { aiExtractionAvailable } from './parsers/ai';

const IMPORT_STATUSES: readonly SupplierImportStatus[] = [
  'UPLOADING',
  'EXTRACTING',
  'MAPPING',
  'REVIEW',
  'APPLIED',
  'REVERTED',
  'CANCELED',
  'FAILED',
];

/** The changes worth a look; stock counts and details are on request. */
export const WATCH_KINDS: readonly SupplierChangeKind[] = [
  'PRICE_DOWN',
  'PRICE_UP',
  'BACK_IN_STOCK',
  'OUT_OF_STOCK',
  'NEW_OFFER',
  'DISAPPEARED',
  'REAPPEARED',
  'RELEASE_DATE',
  'PACKAGING',
];

const ALL_KINDS: readonly SupplierChangeKind[] = [
  ...WATCH_KINDS,
  'STOCK',
  'INFO',
];

export async function getSuppliers() {
  await requireAdmin();
  const db = getPrisma();
  const [suppliers, offers] = await Promise.all([
    db.supplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        imports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true, fileName: true },
        },
      },
    }),
    db.supplierOffer.groupBy({
      by: ['supplierId', 'status'],
      _count: { _all: true },
    }),
  ]);
  return suppliers.map((supplier) => ({
    ...supplier,
    active:
      offers.find(
        (row) => row.supplierId === supplier.id && row.status === 'ACTIVE',
      )?._count._all ?? 0,
    missing:
      offers.find(
        (row) => row.supplierId === supplier.id && row.status === 'MISSING',
      )?._count._all ?? 0,
  }));
}

export async function getSupplierImports(
  params: SearchParams,
  take = pageSize,
) {
  await requireAdmin();
  const status = IMPORT_STATUSES.find(
    (value) => value === param(params, 'status'),
  );
  const supplierId = param(params, 'supplier');
  const search = param(params, 'search').trim();
  const where: Prisma.SupplierImportWhereInput = {
    ...(status ? { status } : {}),
    ...(search ? { fileName: { contains: search, mode: 'insensitive' } } : {}),
    ...(/^[0-9a-f-]{36}$/i.test(supplierId) ? { supplierId } : {}),
  };
  const page = pageNumber(params);
  const db = getPrisma();
  const [rows, total] = await Promise.all([
    db.supplierImport.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        status: true,
        fileName: true,
        fileKind: true,
        fileSize: true,
        scope: true,
        summary: true,
        error: true,
        createdAt: true,
        appliedAt: true,
        durationMs: true,
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        appliedBy: { select: { name: true } },
      },
    }),
    db.supplierImport.count({ where }),
  ]);
  return { rows, total, page };
}

export async function getSupplierWatch(params: SearchParams, take = pageSize) {
  await requireAdmin();
  const kind = ALL_KINDS.find((value) => value === param(params, 'kind'));
  const supplierId = param(params, 'supplier');
  const search = param(params, 'search').trim();
  const where: Prisma.SupplierOfferChangeWhereInput = {
    kind: kind ?? { in: [...WATCH_KINDS] },
    offer: {
      ...(/^[0-9a-f-]{36}$/i.test(supplierId) ? { supplierId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { supplierSku: { contains: search, mode: 'insensitive' } },
              { ean: { contains: search } },
            ],
          }
        : {}),
    },
  };
  const page = pageNumber(params);
  const db = getPrisma();
  const [rows, total] = await Promise.all([
    db.supplierOfferChange.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * take,
      take,
      include: {
        offer: {
          select: {
            id: true,
            name: true,
            supplierSku: true,
            purchasePrice: true,
            supplier: { select: { id: true, name: true } },
            variant: {
              select: {
                sku: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    db.supplierOfferChange.count({ where }),
  ]);
  return { rows, total, page };
}

export async function getSupplier(id: string, params: SearchParams) {
  await requireAdmin();
  const db = getPrisma();
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      profiles: { orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }] },
    },
  });
  if (!supplier) return null;
  const search = param(params, 'search').trim();
  const status = param(params, 'status');
  const link = param(params, 'link');
  const where: Prisma.SupplierOfferWhereInput = {
    supplierId: id,
    ...(status === 'ACTIVE' || status === 'MISSING' ? { status } : {}),
    ...(link === 'linked'
      ? { variantId: { not: null } }
      : link === 'unlinked'
        ? { variantId: null }
        : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { supplierSku: { contains: search, mode: 'insensitive' } },
            { ean: { contains: search } },
          ],
        }
      : {}),
  };
  const page = pageNumber(params);
  const [offers, total] = await Promise.all([
    db.supplierOffer.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        variant: {
          select: {
            sku: true,
            price: true,
            product: { select: { id: true, name: true, status: true } },
          },
        },
      },
    }),
    db.supplierOffer.count({ where }),
  ]);
  return { supplier, offers, total, page };
}

export async function getSupplierOptions() {
  await requireAdmin();
  return getPrisma().supplier.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });
}

export async function getImport(id: string) {
  await requireAdmin();
  const db = getPrisma();
  const record = await db.supplierImport.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      profile: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      appliedBy: { select: { name: true } },
      pages: {
        orderBy: { page: 'asc' },
        select: {
          page: true,
          method: true,
          status: true,
          confidence: true,
          note: true,
        },
      },
    },
  });
  if (!record) return null;
  const [sample, actions, chunks, later, drafts, others] = await Promise.all([
    db.supplierImportRow.findMany({
      where: { importId: id },
      orderBy: { rowNumber: 'asc' },
      take: 12,
      select: { rowNumber: true, source: true, raw: true },
    }),
    db.supplierImportRow.groupBy({
      by: ['action'],
      where: { importId: id },
      _count: { _all: true },
    }),
    db.supplierImportChunk.count({ where: { importId: id } }),
    record.appliedAt
      ? db.supplierImport.count({
          where: {
            supplierId: record.supplierId,
            status: 'APPLIED',
            appliedAt: { gt: record.appliedAt },
          },
        })
      : 0,
    db.product.findMany({
      where: { sourceImportId: id },
      orderBy: { name: 'asc' },
      take: 100,
      select: { id: true, name: true, status: true },
    }),
    // Another supplier whose saved format has exactly these columns.
    record.profileId
      ? []
      : db.supplierProfile.findMany({
          where: {
            supplierId: { not: record.supplierId },
            signature: createHash('sha256')
              .update(
                signatureSource((record.headers as string[] | null) ?? []),
              )
              .digest('hex'),
          },
          select: { name: true, supplier: { select: { name: true } } },
          take: 3,
        }),
  ]);
  const pageRows = await db.supplierImportRow.groupBy({
    by: ['source'],
    where: { importId: id },
    _count: { _all: true },
  });
  return {
    record,
    sample,
    actions: Object.fromEntries(
      actions.map((row) => [row.action ?? 'PENDING', row._count._all]),
    ) as Partial<Record<SupplierRowAction | 'PENDING', number>>,
    uploaded: chunks,
    revertible: record.status === 'APPLIED' && later === 0,
    drafts,
    otherProfiles: others,
    rowsByPage: new Map(
      pageRows.map((row) => [
        Number(row.source?.match(/^page (\d+)/)?.[1] ?? 0),
        row._count._all,
      ]),
    ),
    aiAvailable: aiExtractionAvailable(),
  };
}

const ROW_FILTERS: Record<string, Prisma.SupplierImportRowWhereInput> = {
  review: { action: 'REVIEW' },
  rejected: { action: 'REJECT' },
  products: { action: 'CREATE_PRODUCT' },
  created: { action: 'CREATE_OFFER' },
  updated: { action: 'UPDATE_OFFER' },
  unchanged: { action: 'UNCHANGED' },
  ignored: { action: 'IGNORE' },
};

export const ROW_PAGE_SIZE = 25;

export async function getImportRows(id: string, params: SearchParams) {
  await requireAdmin();
  const db = getPrisma();
  const filter = param(params, 'rows');
  const search = param(params, 'search').trim();
  const where: Prisma.SupplierImportRowWhereInput = {
    importId: id,
    ...(ROW_FILTERS[filter] ?? {}),
    ...(search
      ? {
          OR: [
            { values: { path: ['name'], string_contains: search } },
            { values: { path: ['supplierSku'], string_contains: search } },
            { values: { path: ['ean'], string_contains: search } },
          ],
        }
      : {}),
  };
  const page = pageNumber(params);
  const [rows, total] = await Promise.all([
    db.supplierImportRow.findMany({
      where,
      orderBy: { rowNumber: 'asc' },
      skip: (page - 1) * ROW_PAGE_SIZE,
      take: ROW_PAGE_SIZE,
      include: {
        variant: {
          select: {
            sku: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.supplierImportRow.count({ where }),
  ]);
  const candidateIds = [
    ...new Set(
      rows.flatMap((row) =>
        ((row.candidates as Candidate[] | null) ?? []).map(
          (candidate) => candidate.variantId,
        ),
      ),
    ),
  ];
  const variants = candidateIds.length
    ? await db.productVariant.findMany({
        where: { id: { in: candidateIds } },
        select: {
          id: true,
          sku: true,
          language: true,
          product: { select: { id: true, name: true } },
        },
      })
    : [];
  return {
    rows,
    total,
    page,
    variants: new Map(variants.map((variant) => [variant.id, variant])),
  };
}

/** Offers linked to one product, for its admin page. */
export async function getProductSupplierOffers(productId: string) {
  await requireAdmin();
  return getPrisma().supplierOffer.findMany({
    where: { variant: { productId } },
    orderBy: [{ status: 'asc' }, { purchasePrice: 'asc' }],
    include: {
      supplier: { select: { id: true, name: true } },
      variant: { select: { sku: true } },
    },
  });
}
