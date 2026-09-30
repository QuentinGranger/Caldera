// Supplier imports, from upload to the reviewed preview. Nothing here
// touches products or offers: only the import, its pages and its rows.
// Applying and undoing live in apply.ts. Server only.
import 'server-only';
import { createHash } from 'node:crypto';
import {
  Prisma,
  type SupplierImportScope,
  type SupplierRowAction,
} from '@/generated/prisma/client';
import { audit } from '@/lib/admin/common';
import { AdminError } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import {
  analyzeRows,
  diffOffer,
  disappearedOffers,
  summarize,
  type AnalysedRow,
  type Change,
  type ImportSummary,
} from './analysis';
import { parseCsv } from './csv';
import { FIELDS, type FieldKey } from './fields';
import {
  PAGE_CONFIDENCE_THRESHOLD,
  tableFromPages,
  type PageInput,
  type Word,
} from './layout';
import {
  inferOptions,
  signatureSource,
  suggestMapping,
  type InferredOptions,
} from './mapping';
import { createMatcher, type CatalogVariant } from './matching';
import {
  normalizeRow,
  type Issue,
  type Mapping,
  type NormalizedValues,
  type NormalizeOptions,
} from './normalize';
import { aiExtractPage, AiExtractionError } from './parsers/ai';
import { parseExcel } from './parsers/excel';
import { parseJson } from './parsers/json';
import { ocrPages } from './parsers/ocr';
import { readPdfText } from './parsers/pdf';
import {
  CHUNK_SIZE,
  contentMatches,
  fileKindFrom,
  MAX_FILE_SIZE,
  MAX_PDF_PAGES,
  MAX_ROWS,
  offerSnapshot,
  rowCells,
  type RawRow,
  type StoredOffer,
} from './records';
import { ImportFileError, type ExtractedTable } from './table';

export type ImportOptions = NormalizeOptions & {
  /** Excel: the sheet read. */
  sheet?: string | null;
  /** False while no date of the file told day and month apart. */
  dateOrderCertain?: boolean;
};

export type Extraction = {
  ms: number;
  rows: number;
  skipped: number;
  encoding?: string;
  delimiter?: string;
  sheet?: string;
  sheets?: { name: string; rows: number }[];
  jsonPath?: string | null;
  pageCount?: number;
};

export type StoredSummary = ImportSummary & {
  analysisMs?: number;
};

const OPEN = ['MAPPING', 'REVIEW'] as const;

const db = () => getPrisma();

async function assertAdmin(tx: Prisma.TransactionClient, adminId: string) {
  const admin = await tx.adminUser.findFirst({
    where: { id: adminId, isActive: true, role: 'ADMIN' },
    select: { id: true },
  });
  if (!admin) throw new AdminError('Session administrateur invalide.');
}

/** Long work on thousands of rows: explicit row locks, generous timeout. */
export function longTransaction<T>(
  adminId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return db().$transaction(
    async (tx) => {
      await assertAdmin(tx, adminId);
      return run(tx);
    },
    { isolationLevel: 'ReadCommitted', timeout: 55_000, maxWait: 10_000 },
  );
}

/** The import row, locked for the transaction, in one of the given states. */
export async function lockImport(
  tx: Prisma.TransactionClient,
  importId: string,
  statuses: readonly string[],
) {
  const [row] = await tx.$queryRaw<{ status: string }[]>`
    SELECT status FROM "SupplierImport" WHERE id = ${importId}::uuid FOR UPDATE`;
  if (!row) throw new AdminError('Import introuvable.');
  if (!statuses.includes(row.status))
    throw new AdminError(
      'Cet import a changé d’étape entre-temps : rechargez la page.',
    );
  return tx.supplierImport.findUniqueOrThrow({
    where: { id: importId },
    include: { supplier: { select: { id: true, code: true, name: true } } },
  });
}

// ------------------------------------------------------------ suppliers

export type SupplierInput = {
  name: string;
  code: string;
  email: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
};

export async function saveSupplier(
  adminId: string,
  supplierId: string | undefined,
  input: SupplierInput,
) {
  if (!/^[A-Z0-9]{2,12}$/.test(input.code))
    throw new AdminError(
      'Code fournisseur : 2 à 12 lettres majuscules ou chiffres.',
    );
  try {
    return await db().$transaction(async (tx) => {
      await assertAdmin(tx, adminId);
      const supplier = supplierId
        ? await tx.supplier.update({ where: { id: supplierId }, data: input })
        : await tx.supplier.create({ data: input });
      await audit(tx, adminId, 'SUPPLIER_SAVED', 'Supplier', supplier.id, {
        created: !supplierId,
      });
      return supplier;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AdminError('Ce nom ou ce code fournisseur existe déjà.');
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    )
      throw new AdminError('Fournisseur introuvable.');
    throw error;
  }
}

export async function deleteProfile(adminId: string, profileId: string) {
  return db().$transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    const profile = await tx.supplierProfile.delete({
      where: { id: profileId },
      select: { supplierId: true },
    });
    await audit(
      tx,
      adminId,
      'SUPPLIER_PROFILE_DELETED',
      'Supplier',
      profile.supplierId,
      { profileId },
    );
    return profile;
  });
}

// --------------------------------------------------------------- upload

export async function startImport(
  adminId: string,
  input: {
    supplierId: string;
    fileName: string;
    fileSize: number;
    fileHash: string;
    scope: SupplierImportScope;
  },
) {
  const fileKind = fileKindFrom(input.fileName);
  if (!fileKind)
    throw new AdminError(
      'Format non pris en charge : CSV, Excel (.xlsx, .xls), PDF ou JSON.',
    );
  if (
    !Number.isSafeInteger(input.fileSize) ||
    input.fileSize <= 0 ||
    input.fileSize > MAX_FILE_SIZE
  )
    throw new AdminError(
      `Fichier vide ou trop lourd (maximum ${MAX_FILE_SIZE / 1024 / 1024} Mo).`,
    );
  if (!/^[0-9a-f]{64}$/.test(input.fileHash))
    throw new AdminError('Empreinte du fichier invalide.');
  return db().$transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    const supplier = await tx.supplier.findUnique({
      where: { id: input.supplierId },
      select: { isActive: true },
    });
    if (!supplier?.isActive)
      throw new AdminError('Fournisseur introuvable ou désactivé.');
    return tx.supplierImport.create({
      data: {
        supplierId: input.supplierId,
        fileName: input.fileName.slice(0, 200),
        fileKind,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
        scope: input.scope,
        createdById: adminId,
      },
      select: { id: true },
    });
  });
}

const chunkCount = (size: number) => Math.ceil(size / CHUNK_SIZE);

export async function uploadChunk(
  importId: string,
  index: number,
  data: Uint8Array,
) {
  const record = await db().supplierImport.findUnique({
    where: { id: importId },
    select: { status: true, fileSize: true },
  });
  if (!record || record.status !== 'UPLOADING')
    throw new AdminError('Envoi terminé ou import introuvable.');
  const count = chunkCount(record.fileSize);
  const expected =
    index === count - 1
      ? record.fileSize - CHUNK_SIZE * (count - 1)
      : CHUNK_SIZE;
  if (!Number.isInteger(index) || index < 0 || index >= count)
    throw new AdminError('Morceau de fichier inattendu.');
  if (data.byteLength !== expected)
    throw new AdminError('Morceau de fichier incomplet : relancez l’envoi.');
  const bytes = new Uint8Array(data);
  await db().supplierImportChunk.upsert({
    where: { importId_index: { importId, index } },
    create: { importId, index, data: bytes },
    update: { data: bytes },
  });
}

async function loadFile(importId: string) {
  const chunks = await db().supplierImportChunk.findMany({
    where: { importId },
    orderBy: { index: 'asc' },
  });
  const size = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk.data, offset);
    offset += chunk.data.byteLength;
  }
  return { bytes, count: chunks.length };
}

async function fail(importId: string, message: string) {
  await db().$transaction([
    db().supplierImportChunk.deleteMany({ where: { importId } }),
    db().supplierImport.update({
      where: { id: importId },
      data: { status: 'FAILED', error: message.slice(0, 500) },
    }),
  ]);
}

/** Last chunk received: the file is checked, then read. */
export async function finishUpload(importId: string) {
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
  });
  if (record.status !== 'UPLOADING')
    throw new AdminError('Cet import a déjà été envoyé.');
  const { bytes, count } = await loadFile(importId);
  if (count !== chunkCount(record.fileSize)) {
    throw new AdminError('Envoi incomplet : relancez-le.');
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== record.fileSize || hash !== record.fileHash) {
    await fail(importId, 'Fichier altéré pendant l’envoi : recommencez.');
    return;
  }
  if (!contentMatches(record.fileKind, bytes)) {
    await fail(
      importId,
      'Le contenu du fichier ne correspond pas à son extension.',
    );
    return;
  }
  await extractImport(importId, bytes);
}

// ------------------------------------------------------------ extraction

function describeError(error: unknown) {
  if (error instanceof ImportFileError) return error.message;
  return 'Fichier illisible : vérifiez qu’il s’ouvre bien, ou enregistrez-le dans un autre format.';
}

/** Reads the file into the intermediate table (PDF: its pages first). */
export async function extractImport(
  importId: string,
  known?: Uint8Array,
  sheet?: string | null,
) {
  const started = Date.now();
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
  });
  const bytes = known ?? (await loadFile(importId)).bytes;
  try {
    if (record.fileKind === 'PDF') {
      const read = await readPdfText(bytes, MAX_PDF_PAGES);
      if (read.pageCount > MAX_PDF_PAGES)
        throw new ImportFileError(
          `PDF de ${read.pageCount} pages : découpez-le (maximum ${MAX_PDF_PAGES}).`,
        );
      const round = (value: number) => Math.round(value * 10) / 10;
      await db().$transaction([
        db().supplierImportPage.deleteMany({ where: { importId } }),
        db().supplierImportPage.createMany({
          data: read.pages.map((page) => ({
            importId,
            page: page.page,
            method: page.scanned ? 'OCR' : 'TEXT',
            status: page.scanned ? 'PENDING' : 'DONE',
            words: page.scanned
              ? Prisma.DbNull
              : page.words.map((word) => ({
                  text: word.text,
                  left: round(word.left),
                  top: round(word.top),
                  width: round(word.width),
                  height: round(word.height),
                })),
          })),
        }),
        db().supplierImport.update({
          where: { id: importId },
          data: {
            status: read.pages.some((page) => page.scanned)
              ? 'EXTRACTING'
              : 'MAPPING',
            extraction: {
              ms: Date.now() - started,
              rows: 0,
              skipped: 0,
              pageCount: read.pageCount,
            },
          },
        }),
      ]);
      if (!read.pages.some((page) => page.scanned)) await assemblePdf(importId);
      return;
    }
    const maxRows = MAX_ROWS + 1;
    let table: ExtractedTable;
    let extraction: Omit<Extraction, 'ms' | 'rows' | 'skipped'> = {};
    switch (record.fileKind) {
      case 'CSV': {
        const parsed = parseCsv(bytes);
        table = parsed;
        extraction = {
          encoding: parsed.encoding,
          delimiter: parsed.delimiter,
        };
        break;
      }
      case 'XLSX':
      case 'XLS': {
        const options = record.options as ImportOptions | null;
        const parsed = parseExcel(bytes, {
          sheet: sheet ?? options?.sheet ?? null,
          maxRows,
        });
        table = parsed;
        extraction = { sheet: parsed.sheet, sheets: parsed.sheets };
        break;
      }
      case 'JSON': {
        const parsed = parseJson(bytes, maxRows);
        table = parsed;
        extraction = { jsonPath: parsed.path };
        break;
      }
    }
    await storeTable(importId, table, extraction, started, false);
  } catch (error) {
    await fail(importId, describeError(error));
  }
}

/** One PDF table from its pages, whatever read each one. */
export async function assemblePdf(importId: string) {
  const started = Date.now();
  const pages = await db().supplierImportPage.findMany({
    where: { importId },
    orderBy: { page: 'asc' },
  });
  const inputs: PageInput[] = [];
  for (const page of pages) {
    if (['IGNORED', 'FAILED', 'PENDING'].includes(page.status)) continue;
    const table = page.rows as { headers: string[]; rows: string[][] } | null;
    if (page.method === 'AI' && table)
      inputs.push({
        page: page.page,
        ...table,
        label: `page ${page.page} · IA`,
      });
    else if (page.words)
      inputs.push({
        page: page.page,
        words: page.words as Word[],
        label: page.method === 'OCR' ? `page ${page.page} · OCR` : undefined,
      });
  }
  const { table, pages: results } = tableFromPages(inputs);
  await db().$transaction(
    results.map((result) =>
      db().supplierImportPage.update({
        where: { importId_page: { importId, page: result.page } },
        data: {
          confidence: result.confidence,
          status:
            result.confidence >= PAGE_CONFIDENCE_THRESHOLD
              ? 'DONE'
              : 'NEEDS_REVIEW',
          note: result.note,
        },
      }),
    ),
  );
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: { extraction: true },
  });
  const previous = (record.extraction ?? {}) as Partial<Extraction>;
  await storeTable(
    importId,
    table,
    { pageCount: previous.pageCount },
    started - (previous.ms ?? 0),
    true,
  );
}

const signatureOf = (headers: readonly string[]) =>
  createHash('sha256').update(signatureSource(headers)).digest('hex');

/**
 * The table becomes the import's rows (raw cells only), with a suggested
 * mapping: the supplier's saved profile for this format, else a guess.
 * Previous analysis is dropped: it described another table.
 */
async function storeTable(
  importId: string,
  table: ExtractedTable,
  extraction: Omit<Extraction, 'ms' | 'rows' | 'skipped'>,
  started: number,
  allowEmpty: boolean,
) {
  if (table.rows.length > MAX_ROWS)
    throw new ImportFileError(
      `Plus de ${MAX_ROWS.toLocaleString('fr-FR')} lignes : découpez le fichier.`,
    );
  if (!allowEmpty && (!table.headers.length || !table.rows.length))
    throw new ImportFileError(
      'Aucun tableau de produits reconnu : vérifiez que le fichier a une ligne de titres de colonnes.',
    );
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: {
      supplierId: true,
      fileKind: true,
      mapping: true,
      options: true,
    },
  });
  const signature = signatureOf(table.headers);
  const profile = table.headers.length
    ? await db().supplierProfile.findUnique({
        where: {
          supplierId_signature: { supplierId: record.supplierId, signature },
        },
      })
    : null;
  const previousMapping = record.mapping as Mapping | null;
  const keepPrevious =
    previousMapping &&
    Object.keys(previousMapping).length &&
    Object.values(previousMapping).every((column) =>
      table.headers.includes(column!),
    );
  const sample = table.rows.slice(0, 500).map((row) => row.cells);
  let mapping: Mapping;
  let options: ImportOptions;
  const previousOptions = record.options as ImportOptions | null;
  if (keepPrevious && previousOptions) {
    mapping = previousMapping;
    options = { ...previousOptions, sheet: extraction.sheet ?? null };
  } else if (profile) {
    mapping = profile.mapping as Mapping;
    options = {
      ...(profile.options as unknown as ImportOptions),
      sheet: extraction.sheet ?? null,
    };
  } else {
    mapping = suggestMapping(table.headers, sample.slice(0, 200)).mapping;
    const inferred: InferredOptions = inferOptions(
      table.headers,
      sample,
      mapping,
    );
    options = {
      decimal: inferred.decimal,
      dateOrder: inferred.dateOrder,
      dateOrderCertain: inferred.dateOrderCertain,
      defaultLanguage: null,
      defaultVatRate: null,
      sheet: extraction.sheet ?? null,
    };
  }
  await db().$transaction(
    async (tx) => {
      await lockImport(tx, importId, [
        'UPLOADING',
        'EXTRACTING',
        'MAPPING',
        'REVIEW',
      ]);
      await tx.supplierImportRow.deleteMany({ where: { importId } });
      for (let start = 0; start < table.rows.length; start += 2000)
        await tx.supplierImportRow.createMany({
          data: table.rows.slice(start, start + 2000).map((row) => ({
            importId,
            rowNumber: row.number,
            source: row.source,
            raw: { cells: row.cells } satisfies RawRow,
          })),
        });
      await tx.supplierImport.update({
        where: { id: importId },
        data: {
          status: 'MAPPING',
          headers: table.headers,
          extraction: {
            ...extraction,
            ms: Date.now() - started,
            rows: table.rows.length,
            skipped: table.skipped,
          } satisfies Extraction,
          mapping,
          options,
          profileId: keepPrevious ? undefined : (profile?.id ?? null),
          extractedAt: new Date(),
          analyzedAt: null,
          summary: Prisma.DbNull,
          error: null,
        },
      });
    },
    { timeout: 55_000, maxWait: 10_000 },
  );
}

/** Scanned pages, a few per request (each takes one to three seconds). */
export async function ocrStep(importId: string) {
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: { status: true },
  });
  if (record.status !== 'EXTRACTING') return { remaining: 0 };
  const pending = await db().supplierImportPage.findMany({
    where: { importId, method: 'OCR', status: 'PENDING' },
    orderBy: { page: 'asc' },
    select: { page: true },
  });
  if (pending.length) {
    const { bytes } = await loadFile(importId);
    const results = await ocrPages(
      bytes,
      pending.map((page) => page.page),
      Date.now() + 30_000,
    );
    await db().$transaction(
      results.map((result) =>
        db().supplierImportPage.update({
          where: { importId_page: { importId, page: result.page } },
          data:
            'words' in result
              ? {
                  status: 'DONE',
                  words: result.words.map((word) => ({
                    ...word,
                    left: Math.round(word.left * 10) / 10,
                    top: Math.round(word.top * 10) / 10,
                    width: Math.round(word.width * 10) / 10,
                    height: Math.round(word.height * 10) / 10,
                    confidence: Math.round(word.confidence ?? 0),
                  })),
                  note: null,
                }
              : { status: 'FAILED', note: result.error },
        }),
      ),
    );
    const remaining = pending.length - results.length;
    if (remaining) return { remaining };
  }
  try {
    await assemblePdf(importId);
  } catch (error) {
    await fail(importId, describeError(error));
  }
  return { remaining: 0 };
}

/** Sends this page only to the AI, at the administrator's request. */
export async function aiReadPage(
  adminId: string,
  importId: string,
  page: number,
) {
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: { status: true, fileKind: true, headers: true },
  });
  if (record.fileKind !== 'PDF' || !OPEN.some((s) => s === record.status))
    throw new AdminError('Cette page ne peut plus être relue.');
  const exists = await db().supplierImportPage.findUnique({
    where: { importId_page: { importId, page } },
    select: { page: true },
  });
  if (!exists) throw new AdminError('Page introuvable.');
  const { bytes } = await loadFile(importId);
  let table;
  try {
    table = await aiExtractPage({
      bytes,
      page,
      expectedHeaders: (record.headers as string[] | null) ?? [],
    });
  } catch (error) {
    if (error instanceof AiExtractionError) throw new AdminError(error.message);
    throw error;
  }
  await db().$transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    await tx.supplierImportPage.update({
      where: { importId_page: { importId, page } },
      data: { method: 'AI', status: 'DONE', rows: table, note: null },
    });
    // The only step that sends data outside: always traced.
    await audit(tx, adminId, 'SUPPLIER_PAGE_AI', 'SupplierImport', importId, {
      page,
      rows: table.rows.length,
    });
  });
  await assemblePdf(importId);
}

export async function changePage(
  importId: string,
  page: number,
  change: 'ignore' | 'restore' | 'local',
) {
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: { status: true, fileKind: true },
  });
  if (record.fileKind !== 'PDF' || !OPEN.some((s) => s === record.status))
    throw new AdminError('Les pages ne peuvent plus être modifiées.');
  const current = await db().supplierImportPage.findUnique({
    where: { importId_page: { importId, page } },
  });
  if (!current) throw new AdminError('Page introuvable.');
  const words = current.words as Word[] | null;
  // Back to local reading: the words kept from the text layer or the OCR.
  const local =
    current.method !== 'AI'
      ? current.method
      : words?.some((word) => word.confidence !== undefined)
        ? 'OCR'
        : 'TEXT';
  const method = change === 'local' ? local : current.method;
  const readable = method === 'AI' ? Boolean(current.rows) : Boolean(words);
  const status =
    change === 'ignore' ? 'IGNORED' : readable ? 'DONE' : 'PENDING';
  await db().supplierImportPage.update({
    where: { importId_page: { importId, page } },
    data: { method, status },
  });
  if (status === 'PENDING') {
    // Never read (OCR failed or not run yet): back to the OCR step.
    await db().supplierImport.update({
      where: { id: importId },
      data: { status: 'EXTRACTING' },
    });
    return;
  }
  await assemblePdf(importId);
}

export async function changeSheet(importId: string, sheet: string) {
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: { status: true, fileKind: true, extraction: true },
  });
  const sheets = (record.extraction as Extraction | null)?.sheets ?? [];
  if (
    !['XLSX', 'XLS'].includes(record.fileKind) ||
    !OPEN.some((s) => s === record.status) ||
    !sheets.some((item) => item.name === sheet)
  )
    throw new AdminError('Feuille introuvable.');
  await extractImport(importId, undefined, sheet);
  const after = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: { status: true, error: true },
  });
  if (after.status === 'FAILED')
    throw new AdminError(after.error ?? 'Feuille illisible.');
}

// --------------------------------------------------------------- mapping

const FIELD_KEYS = new Set<string>(FIELDS.map((field) => field.key));

export async function saveMapping(
  adminId: string,
  importId: string,
  input: {
    mapping: Mapping;
    options: ImportOptions;
    scope: SupplierImportScope;
    profileName: string | null;
  },
) {
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
    select: {
      status: true,
      headers: true,
      supplierId: true,
      fileKind: true,
      options: true,
    },
  });
  if (!OPEN.some((s) => s === record.status))
    throw new AdminError('Cet import n’est plus modifiable.');
  const headers = (record.headers as string[] | null) ?? [];
  // A field left on « not in the file » is simply not mapped.
  const mapping: Mapping = Object.fromEntries(
    Object.entries(input.mapping).filter(([, column]) => column),
  );
  const used = new Set<string>();
  for (const [field, column] of Object.entries(mapping)) {
    if (!FIELD_KEYS.has(field) || !column || !headers.includes(column))
      throw new AdminError('Colonne inconnue dans la correspondance.');
    if (used.has(column))
      throw new AdminError(
        `La colonne « ${column} » est choisie pour deux champs.`,
      );
    used.add(column);
  }
  if (!mapping.name)
    throw new AdminError('Indiquez la colonne du nom du produit.');
  if (!mapping.supplierSku && !mapping.ean)
    throw new AdminError(
      'Indiquez la colonne de la référence fournisseur ou de l’EAN.',
    );
  const previous = (record.options ?? {}) as ImportOptions;
  const options: ImportOptions = {
    ...input.options,
    sheet: previous.sheet ?? null,
    dateOrderCertain: true,
  };
  await db().$transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    let profileId: string | undefined;
    if (input.profileName) {
      const signature = signatureOf(headers);
      const profile = await tx.supplierProfile.upsert({
        where: {
          supplierId_signature: { supplierId: record.supplierId, signature },
        },
        create: {
          supplierId: record.supplierId,
          name: input.profileName,
          fileKind: record.fileKind,
          signature,
          mapping,
          options: { ...options, sheet: null },
        },
        update: {
          name: input.profileName,
          mapping,
          options: { ...options, sheet: null },
        },
      });
      profileId = profile.id;
    }
    await tx.supplierImport.update({
      where: { id: importId },
      data: {
        mapping,
        options,
        scope: input.scope,
        ...(profileId ? { profileId } : {}),
      },
    });
  });
  await analyzeImport(adminId, importId);
}

// --------------------------------------------------------------- analysis

async function catalogVariants(
  tx: Prisma.TransactionClient | ReturnType<typeof db>,
): Promise<CatalogVariant[]> {
  const variants = await tx.productVariant.findMany({
    select: {
      id: true,
      productId: true,
      sku: true,
      barcode: true,
      language: true,
      product: {
        select: {
          name: true,
          productType: true,
          game: { select: { name: true } },
          tcgSet: { select: { name: true } },
        },
      },
    },
  });
  return variants.map((variant) => ({
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    barcode: variant.barcode,
    language: variant.language,
    productName: variant.product.name,
    productType: variant.product.productType,
    gameName: variant.product.game?.name ?? null,
    setName: variant.product.tcgSet?.name ?? null,
  }));
}

export const OFFER_SELECT = {
  id: true,
  supplierSku: true,
  variantId: true,
  ean: true,
  name: true,
  brand: true,
  game: true,
  series: true,
  category: true,
  language: true,
  condition: true,
  purchasePrice: true,
  purchasePriceInclTax: true,
  msrp: true,
  vatRate: true,
  stock: true,
  availability: true,
  releaseDate: true,
  restockDate: true,
  minOrderQty: true,
  packaging: true,
  packSize: true,
  description: true,
  imageUrl: true,
  productUrl: true,
  status: true,
  missingSince: true,
  lastImportId: true,
  lastSeenAt: true,
} as const satisfies Prisma.SupplierOfferSelect;

export async function supplierOffers(
  tx: Prisma.TransactionClient | ReturnType<typeof db>,
  supplierId: string,
): Promise<StoredOffer[]> {
  return tx.supplierOffer.findMany({
    where: { supplierId },
    select: OFFER_SELECT,
  });
}

const upper = (value: string | null | undefined) => value?.toUpperCase() ?? '';

async function pipeline(supplierId: string) {
  const [variants, offers] = await Promise.all([
    catalogVariants(db()),
    supplierOffers(db(), supplierId),
  ]);
  const snapshots = new Map(
    offers.map((offer) => [upper(offer.supplierSku), offerSnapshot(offer)]),
  );
  const match = createMatcher(
    variants,
    new Map(
      offers.map((offer) => [
        upper(offer.supplierSku),
        { id: offer.id, variantId: offer.variantId },
      ]),
    ),
  );
  return { snapshots, match };
}

/** Rows read by OCR or AI say so: the administrator compares with the PDF. */
function normalizeStored(
  headers: readonly string[],
  mapping: Mapping,
  options: ImportOptions,
  row: { rowNumber: number; source: string | null; raw: unknown },
) {
  const { cells, mapping: effective } = rowCells(
    headers,
    row.raw as RawRow,
    mapping,
  );
  const { values, issues } = normalizeRow(cells, effective, options);
  if (row.source && /· (OCR|IA)$/.test(row.source))
    issues.push({
      field: 'row',
      value: row.source,
      problem: `Ligne lue par ${row.source.endsWith('OCR') ? 'OCR' : 'IA'} : comparez avec le PDF`,
      level: 'info',
    });
  return { number: row.rowNumber, values, issues };
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

function rowData(row: AnalysedRow) {
  return {
    values: json(row.values),
    issues: json(row.issues),
    match: row.match,
    variantId: row.variantId,
    candidates: row.candidates.length ? json(row.candidates) : Prisma.DbNull,
    offerId: row.offerId,
    action: row.action,
    changes: row.changes.length ? json(row.changes) : Prisma.DbNull,
  };
}

/** Normalise, match and compare every row; nothing else is written. */
export async function analyzeImport(adminId: string, importId: string) {
  const started = Date.now();
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
  });
  const headers = (record.headers as string[] | null) ?? [];
  const mapping = (record.mapping ?? {}) as Mapping;
  const options = record.options as unknown as ImportOptions;
  const rows = await db().supplierImportRow.findMany({
    where: { importId },
    orderBy: { rowNumber: 'asc' },
    select: { rowNumber: true, source: true, raw: true },
  });
  const { snapshots, match } = await pipeline(record.supplierId);
  const normalized = rows.map((row) =>
    normalizeStored(headers, mapping, options, row),
  );
  const analysed = analyzeRows(normalized, match, snapshots);
  const disappeared =
    record.scope === 'FULL'
      ? disappearedOffers(normalized, snapshots).length
      : 0;
  const summary: StoredSummary = {
    ...summarize(analysed, disappeared),
    analysisMs: Date.now() - started,
  };
  const byNumber = new Map(rows.map((row) => [row.rowNumber, row]));
  await longTransaction(adminId, async (tx) => {
    await lockImport(tx, importId, OPEN);
    await tx.supplierImportRow.deleteMany({ where: { importId } });
    for (let start = 0; start < analysed.length; start += 1000)
      await tx.supplierImportRow.createMany({
        data: analysed.slice(start, start + 1000).map((row) => {
          const source = byNumber.get(row.number)!;
          return {
            importId,
            rowNumber: row.number,
            source: source.source,
            raw: json(source.raw),
            ...rowData(row),
          };
        }),
      });
    await tx.supplierImport.update({
      where: { id: importId },
      data: {
        status: 'REVIEW',
        analyzedAt: new Date(),
        summary: json(summary),
      },
    });
  });
}

// ---------------------------------------------------------------- review

type SummaryRow = Pick<
  AnalysedRow,
  'action' | 'match' | 'changes' | 'issues' | 'values'
>;

function asSummaryRow(row: {
  action: SupplierRowAction | null;
  match: string | null;
  changes: unknown;
  issues: unknown;
  values: unknown;
}): SummaryRow {
  return {
    action: row.action ?? 'REVIEW',
    match: (row.match ?? 'NEW') as SummaryRow['match'],
    changes: (row.changes as Change[] | null) ?? [],
    issues: (row.issues as Issue[] | null) ?? [],
    values: row.values as NormalizedValues,
  };
}

/** Counts updated for one row: what it counted before is taken back. */
function adjustSummary(
  summary: StoredSummary,
  before: SummaryRow,
  after: SummaryRow,
): StoredSummary {
  const minus = summarize([before], 0);
  const plus = summarize([after], 0);
  const next = { ...summary };
  for (const key of Object.keys(minus) as (keyof ImportSummary)[])
    if (key !== 'disappeared' && key !== 'rows')
      next[key] = (summary[key] ?? 0) - minus[key] + plus[key];
  return next;
}

async function recomputeSummary(
  tx: Prisma.TransactionClient,
  importId: string,
) {
  const [record, rows] = await Promise.all([
    tx.supplierImport.findUniqueOrThrow({
      where: { id: importId },
      select: { summary: true },
    }),
    tx.supplierImportRow.findMany({
      where: { importId },
      select: {
        action: true,
        match: true,
        changes: true,
        issues: true,
        values: true,
      },
    }),
  ]);
  const previous = (record.summary ?? {}) as Partial<StoredSummary>;
  await tx.supplierImport.update({
    where: { id: importId },
    data: {
      summary: json({
        ...summarize(rows.map(asSummaryRow), previous.disappeared ?? 0),
        analysisMs: previous.analysisMs,
      }),
    },
  });
}

export type RowDecision =
  | { kind: 'link'; variantId: string }
  | { kind: 'link-sku'; sku: string }
  | { kind: 'create' }
  | { kind: 'offer' }
  | { kind: 'ignore' };

/** Blocking doubts: only a correction lifts them, not a decision. */
const blocking = (issues: Issue[]) =>
  issues.some(
    (issue) =>
      issue.level === 'error' &&
      ['name', 'supplierSku', 'ean', 'purchasePrice'].includes(issue.field),
  );

async function offerFor(
  tx: Prisma.TransactionClient,
  supplierId: string,
  sku: string | null,
) {
  if (!sku) return null;
  const offer = await tx.supplierOffer.findFirst({
    where: { supplierId, supplierSku: { equals: sku, mode: 'insensitive' } },
    select: OFFER_SELECT,
  });
  return offer;
}

function offerAction(
  offer: StoredOffer | null,
  values: NormalizedValues,
): { action: SupplierRowAction; changes: Change[] } {
  if (!offer)
    return {
      action: 'CREATE_OFFER',
      changes: [
        {
          kind: 'NEW_OFFER',
          field: null,
          before: null,
          after: values.supplierSku,
        },
      ],
    };
  const changes = diffOffer(offerSnapshot(offer), values);
  return { action: changes.length ? 'UPDATE_OFFER' : 'UNCHANGED', changes };
}

export async function decideRow(
  adminId: string,
  importId: string,
  rowId: string,
  decision: RowDecision,
) {
  return db().$transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    const record = await lockImport(tx, importId, ['REVIEW']);
    const row = await tx.supplierImportRow.findFirst({
      where: { id: rowId, importId },
    });
    if (!row?.values) throw new AdminError('Ligne introuvable.');
    const values = row.values as NormalizedValues;
    const issues = (row.issues as Issue[] | null) ?? [];
    if (
      decision.kind !== 'ignore' &&
      (row.action === 'REJECT' || blocking(issues))
    )
      throw new AdminError(
        'Cette ligne a des erreurs : corrigez-les avant de décider, ou ignorez-la.',
      );
    const offer = await offerFor(tx, record.supplierId, values.supplierSku);
    let next: {
      action: SupplierRowAction;
      variantId: string | null;
      changes: Change[];
    };
    switch (decision.kind) {
      case 'ignore':
        next = {
          action: 'IGNORE',
          variantId: row.variantId,
          changes: (row.changes as Change[] | null) ?? [],
        };
        break;
      case 'link':
      case 'link-sku': {
        const variant = await tx.productVariant.findFirst({
          where:
            decision.kind === 'link'
              ? { id: decision.variantId }
              : { sku: { equals: decision.sku, mode: 'insensitive' } },
          select: { id: true },
        });
        if (!variant) throw new AdminError('Produit Caldera introuvable.');
        next = { ...offerAction(offer, values), variantId: variant.id };
        break;
      }
      case 'offer':
        next = { ...offerAction(offer, values), variantId: null };
        break;
      case 'create': {
        if (!values.name || !values.supplierSku)
          throw new AdminError(
            'Nom et référence (ou EAN) nécessaires pour créer un brouillon.',
          );
        next = {
          action: 'CREATE_PRODUCT',
          variantId: null,
          changes: offer
            ? diffOffer(offerSnapshot(offer), values)
            : offerAction(null, values).changes,
        };
        break;
      }
    }
    await tx.supplierImportRow.update({
      where: { id: row.id },
      data: {
        action: next.action,
        variantId: next.variantId,
        offerId: offer?.id ?? null,
        changes: next.changes.length ? json(next.changes) : Prisma.DbNull,
        decidedAt: new Date(),
      },
    });
    const summary = adjustSummary(
      record.summary as StoredSummary,
      asSummaryRow(row),
      asSummaryRow({ ...row, ...next }),
    );
    await tx.supplierImport.update({
      where: { id: importId },
      data: { summary: json(summary) },
    });
  });
}

/** A value retyped by the administrator; the row is analysed again. */
export async function correctRow(
  adminId: string,
  importId: string,
  rowId: string,
  corrections: Partial<Record<FieldKey, string>>,
) {
  const record = await db().supplierImport.findUniqueOrThrow({
    where: { id: importId },
  });
  if (record.status !== 'REVIEW')
    throw new AdminError('Cet import n’est plus modifiable.');
  for (const [field, value] of Object.entries(corrections))
    if (!FIELD_KEYS.has(field) || (value ?? '').length > 500)
      throw new AdminError('Correction invalide.');
  const row = await db().supplierImportRow.findFirst({
    where: { id: rowId, importId },
  });
  if (!row) throw new AdminError('Ligne introuvable.');
  const raw = row.raw as RawRow;
  const nextRaw: RawRow = {
    ...raw,
    corrections: { ...raw.corrections, ...corrections },
  };
  const headers = (record.headers as string[] | null) ?? [];
  const mapping = (record.mapping ?? {}) as Mapping;
  const options = record.options as unknown as ImportOptions;
  const normalized = normalizeStored(headers, mapping, options, {
    ...row,
    raw: nextRaw,
  });
  // The same reference elsewhere in the file still makes it a duplicate.
  const twins = await db().supplierImportRow.findMany({
    where: {
      importId,
      id: { not: row.id },
      OR: [
        ...(normalized.values.supplierSku
          ? [
              {
                values: {
                  path: ['supplierSku'],
                  equals: normalized.values.supplierSku,
                },
              },
            ]
          : []),
        ...(normalized.values.ean
          ? [{ values: { path: ['ean'], equals: normalized.values.ean } }]
          : []),
      ],
    },
    select: { rowNumber: true, values: true, issues: true },
    take: 5,
  });
  const { snapshots, match } = await pipeline(record.supplierId);
  const [analysed] = analyzeRows(
    [
      normalized,
      ...twins
        .filter((twin) => twin.values)
        .map((twin) => ({
          number: twin.rowNumber,
          values: twin.values as NormalizedValues,
          issues: [],
        })),
    ],
    match,
    snapshots,
  );
  await db().$transaction(async (tx) => {
    await assertAdmin(tx, adminId);
    const locked = await lockImport(tx, importId, ['REVIEW']);
    await tx.supplierImportRow.update({
      where: { id: row.id },
      data: { raw: json(nextRaw), ...rowData(analysed!), decidedAt: null },
    });
    await tx.supplierImport.update({
      where: { id: importId },
      data: {
        summary: json(
          adjustSummary(
            locked.summary as StoredSummary,
            asSummaryRow(row),
            analysed!,
          ),
        ),
      },
    });
  });
  return analysed!;
}

const REVIEW_BLOCKERS = new Set([
  'supplierSku',
  'ean',
  'name',
  'language',
  'purchasePrice',
]);

/** Decisions on many rows at once, each one the same as by hand. */
export async function bulkDecide(
  adminId: string,
  importId: string,
  kind: 'confirm-probable' | 'offers-only' | 'ignore-review',
) {
  return longTransaction(adminId, async (tx) => {
    const record = await lockImport(tx, importId, ['REVIEW']);
    const now = new Date();
    let count = 0;
    if (kind === 'ignore-review') {
      count = (
        await tx.supplierImportRow.updateMany({
          where: { importId, action: 'REVIEW' },
          data: { action: 'IGNORE', decidedAt: now },
        })
      ).count;
    } else if (kind === 'offers-only') {
      const rows = await tx.supplierImportRow.findMany({
        where: { importId, action: 'CREATE_PRODUCT' },
        select: { id: true, offerId: true, changes: true },
      });
      for (const row of rows) {
        const changes = (row.changes as Change[] | null) ?? [];
        await tx.supplierImportRow.update({
          where: { id: row.id },
          data: {
            action: !row.offerId
              ? 'CREATE_OFFER'
              : changes.length
                ? 'UPDATE_OFFER'
                : 'UNCHANGED',
            variantId: null,
            decidedAt: now,
          },
        });
      }
      count = rows.length;
    } else {
      // Probable matches whose only doubt is the match itself.
      const rows = await tx.supplierImportRow.findMany({
        where: {
          importId,
          action: 'REVIEW',
          match: 'PROBABLE',
          variantId: { not: null },
        },
        select: { id: true, values: true, issues: true },
      });
      const offers = new Map(
        (await supplierOffers(tx, record.supplierId)).map((offer) => [
          upper(offer.supplierSku),
          offer,
        ]),
      );
      for (const row of rows) {
        const issues = (row.issues as Issue[] | null) ?? [];
        if (
          issues.some(
            (issue) =>
              issue.level === 'error' ||
              (issue.level === 'review' &&
                (REVIEW_BLOCKERS.has(issue.field) || issue.field === 'row')),
          )
        )
          continue;
        const values = row.values as NormalizedValues;
        const offer = offers.get(upper(values.supplierSku)) ?? null;
        const next = offerAction(offer, values);
        await tx.supplierImportRow.update({
          where: { id: row.id },
          data: {
            action: next.action,
            offerId: offer?.id ?? null,
            changes: next.changes.length ? json(next.changes) : Prisma.DbNull,
            decidedAt: now,
          },
        });
        count++;
      }
    }
    await recomputeSummary(tx, importId);
    return count;
  });
}

export async function cancelImport(adminId: string, importId: string) {
  await longTransaction(adminId, async (tx) => {
    await lockImport(tx, importId, [
      'UPLOADING',
      'EXTRACTING',
      'MAPPING',
      'REVIEW',
      'FAILED',
    ]);
    await tx.supplierImportChunk.deleteMany({ where: { importId } });
    await tx.supplierImportPage.deleteMany({ where: { importId } });
    await tx.supplierImportRow.deleteMany({ where: { importId } });
    await tx.supplierImport.update({
      where: { id: importId },
      data: { status: 'CANCELED' },
    });
    await audit(
      tx,
      adminId,
      'SUPPLIER_IMPORT_CANCELED',
      'SupplierImport',
      importId,
    );
  });
}

/** Unfinished imports left for two weeks, and uploads of closed ones. */
export async function purgeSupplierImports(now = new Date(), limit = 20) {
  const stale = await db().supplierImport.findMany({
    where: {
      status: { in: ['UPLOADING', 'EXTRACTING', 'MAPPING', 'REVIEW'] },
      updatedAt: { lt: new Date(now.getTime() - 14 * 24 * 3600 * 1000) },
    },
    select: { id: true },
    take: limit,
  });
  for (const { id } of stale)
    await db().$transaction([
      db().supplierImportChunk.deleteMany({ where: { importId: id } }),
      db().supplierImportPage.deleteMany({ where: { importId: id } }),
      db().supplierImportRow.deleteMany({ where: { importId: id } }),
      db().supplierImport.update({
        where: { id },
        data: { status: 'CANCELED', error: 'Expiré sans validation.' },
      }),
    ]);
  const closed = await db().supplierImportChunk.deleteMany({
    where: {
      supplierImport: {
        status: { in: ['APPLIED', 'REVERTED', 'CANCELED', 'FAILED'] },
      },
    },
  });
  return { expired: stale.length, chunksPurged: closed.count };
}
