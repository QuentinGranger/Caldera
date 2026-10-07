import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { renderPageAsImage } from 'unpdf';
import { getPrisma } from '../src/lib/db/prisma';
import { changePublication } from '../src/lib/admin/products';
import { applyImport, revertImport } from '../src/lib/supplier-import/apply';
import type { Change } from '../src/lib/supplier-import/analysis';
import { IMPORT_CATEGORY_SLUG } from '../src/lib/supplier-import/records';
import type { Mapping } from '../src/lib/supplier-import/normalize';
import {
  bulkDecide,
  cancelImport,
  changePage,
  correctRow,
  decideRow,
  finishUpload,
  ocrStep,
  purgeSupplierImports,
  saveMapping,
  saveSupplier,
  startImport,
  uploadChunk,
  type ImportOptions,
} from '../src/lib/supplier-import/service';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();

/** A valid EAN-13 no other test uses. */
function ean() {
  const digits = Array.from({ length: 12 }, (_, index) =>
    index === 0 ? 3 : Math.floor(Math.random() * 10),
  );
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (index % 2 ? 3 : 1),
    0,
  );
  return [...digits, (10 - (sum % 10)) % 10].join('');
}

async function upload(
  adminId: string,
  supplierId: string,
  fileName: string,
  bytes: Uint8Array,
  scope: 'FULL' | 'PARTIAL' = 'FULL',
) {
  const { id } = await startImport(adminId, {
    supplierId,
    fileName,
    fileSize: bytes.byteLength,
    fileHash: createHash('sha256').update(bytes).digest('hex'),
    scope,
  });
  await uploadChunk(id, 0, bytes);
  await finishUpload(id);
  return db.supplierImport.findUniqueOrThrow({ where: { id } });
}

const csv = (lines: string[]) =>
  new TextEncoder().encode(
    ['Référence;Désignation;EAN;PA HT;PVC;Stock;Date de sortie', ...lines].join(
      '\r\n',
    ),
  );

const OPTIONS: ImportOptions = {
  decimal: ',',
  dateOrder: 'DMY',
  defaultLanguage: 'FR',
  defaultVatRate: '20.00',
};

test('import fournisseur de bout en bout, PostgreSQL', async (t) => {
  const key = randomUUID().slice(0, 8);
  const code = `T${key.slice(0, 6).toUpperCase()}`;
  const [eanA, eanB, eanNew] = [ean(), ean(), ean()];
  const admin = await db.adminUser.create({
    data: { name: 'Admin imports', email: `imports-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'Catégorie imports', slug: `imports-${key}` },
  });
  const product = (
    name: string,
    type: 'ETB' | 'DISPLAY' | 'TRIPACK',
    sku: string,
    barcode: string | null,
  ) =>
    db.product.create({
      data: {
        name,
        slug: `${sku.toLowerCase()}`,
        productType: type,
        categoryId: category.id,
        status: 'ACTIVE',
        variants: {
          create: {
            sku,
            barcode,
            price: 50,
            stockQuantity: 3,
            isDefault: true,
          },
        },
      },
      include: { variants: true },
    });
  const etb = await product(
    `Coffret Dresseur Elite Flammes ${key}`,
    'ETB',
    `CAL-ETB-${key}`,
    eanA,
  );
  const display = await product(
    `Display 36 boosters Flammes ${key}`,
    'DISPLAY',
    `CAL-DIS-${key}`,
    eanB,
  );
  // The OCR fixture must not depend on recognition of a random hexadecimal
  // suffix (0/O and 1/l change fuzzy confidence across operating systems).
  const tripackName = 'Tripack Validation Pyrovolcan';
  const tripack = await product(tripackName, 'TRIPACK', `CAL-TRI-${key}`, null);
  const supplier = await saveSupplier(admin.id, undefined, {
    name: `Grossiste ${key}`,
    code,
    email: null,
    website: null,
    notes: null,
    isActive: true,
  });

  try {
    let firstId = '';
    let profileId = '';
    await t.test('envoi contrôlé : empreinte, taille, contenu', async () => {
      await assert.rejects(
        saveSupplier(admin.id, undefined, {
          name: `Grossiste ${key}`,
          code: `U${key.slice(0, 6).toUpperCase()}`,
          email: null,
          website: null,
          notes: null,
          isActive: true,
        }),
        /existe déjà/,
      );
      await assert.rejects(
        startImport(admin.id, {
          supplierId: supplier.id,
          fileName: 'tarif.exe',
          fileSize: 10,
          fileHash: '0'.repeat(64),
          scope: 'FULL',
        }),
        /Format non pris en charge/,
      );
      const bytes = csv(['A;Produit;;1,00;;;']);
      const { id } = await startImport(admin.id, {
        supplierId: supplier.id,
        fileName: 'tarif.csv',
        fileSize: bytes.byteLength,
        fileHash: '0'.repeat(64),
        scope: 'FULL',
      });
      await assert.rejects(uploadChunk(id, 0, bytes.slice(1)), /incomplet/);
      await uploadChunk(id, 0, bytes);
      await finishUpload(id);
      const failed = await db.supplierImport.findUniqueOrThrow({
        where: { id },
        include: { chunks: true },
      });
      assert.equal(failed.status, 'FAILED');
      assert.match(failed.error!, /altéré/);
      assert.equal(failed.chunks.length, 0);
      // A PDF renamed .csv is refused on its content.
      const pdf = await upload(
        admin.id,
        supplier.id,
        'tarif.xlsx',
        new TextEncoder().encode('Ref;Nom\nA;B'),
      );
      assert.equal(pdf.status, 'FAILED');
      assert.match(pdf.error!, /ne correspond pas/);
    });

    await t.test(
      'analyse : correspondances, erreurs, doublons, nouveautés',
      async () => {
        const record = await upload(
          admin.id,
          supplier.id,
          'tarif-septembre.csv',
          csv([
            `ETB-1;Coffret Dresseur Elite Flammes ${key};${eanA};39,90;54,90;24;15/11/2026`,
            `DIS-1;Display 36 boosters Flammes ${key};${eanB};129,00;;0;`,
            `TRI-1;${tripackName} VF;;14,50;;8;`,
            `NEW-1;Classeur Portfolio Zzyzx ${key};${eanNew};26,40;32,90;5;`,
            `BAD-1;;;12,00;;;`,
            `DUP-1;Carte promo Qwv ${key};;1,00;;;`,
            `DUP-1;Carte promo Qwv bis ${key};;1,00;;;`,
          ]),
        );
        firstId = record.id;
        assert.equal(record.status, 'MAPPING');
        assert.equal(record.profileId, null);
        const mapping = record.mapping as Mapping;
        assert.deepEqual(mapping, {
          supplierSku: 'Référence',
          name: 'Désignation',
          ean: 'EAN',
          purchasePrice: 'PA HT',
          msrp: 'PVC',
          stock: 'Stock',
          releaseDate: 'Date de sortie',
        });
        await assert.rejects(
          saveMapping(admin.id, firstId, {
            mapping: { ...mapping, name: undefined },
            options: OPTIONS,
            scope: 'FULL',
            profileName: null,
          }),
          /nom du produit/,
        );
        await assert.rejects(
          saveMapping(admin.id, firstId, {
            mapping: { ...mapping, msrp: 'PA HT' },
            options: OPTIONS,
            scope: 'FULL',
            profileName: null,
          }),
          /deux champs/,
        );
        await saveMapping(admin.id, firstId, {
          mapping,
          options: OPTIONS,
          scope: 'FULL',
          profileName: 'Tarif mensuel',
        });
        const analysed = await db.supplierImport.findUniqueOrThrow({
          where: { id: firstId },
          include: { rows: { orderBy: { rowNumber: 'asc' } } },
        });
        profileId = analysed.profileId!;
        assert.ok(profileId);
        assert.equal(analysed.status, 'REVIEW');
        const bySku = (sku: string) =>
          analysed.rows.filter(
            (row) =>
              (row.values as { supplierSku: string }).supplierSku === sku,
          );
        assert.deepEqual(
          analysed.rows.map((row) => [row.rowNumber, row.match, row.action]),
          [
            [2, 'CERTAIN', 'CREATE_OFFER'],
            [3, 'CERTAIN', 'CREATE_OFFER'],
            [4, 'PROBABLE', 'REVIEW'],
            [5, 'NEW', 'CREATE_PRODUCT'],
            [6, 'INVALID', 'REJECT'],
            [7, 'NEW', 'REVIEW'],
            [8, 'NEW', 'REVIEW'],
          ],
        );
        assert.equal(bySku('ETB-1')[0]!.variantId, etb.variants[0]!.id);
        assert.equal(bySku('TRI-1')[0]!.variantId, tripack.variants[0]!.id);
        assert.deepEqual(
          (bySku('ETB-1')[0]!.values as Record<string, unknown>).releaseDate,
          '2026-11-15',
        );
        const summary = analysed.summary as Record<string, number>;
        assert.equal(summary.rows, 7);
        assert.equal(summary.newProducts, 1);
        assert.equal(summary.toReview, 3);
        assert.equal(summary.rejected, 1);
        assert.equal(summary.duplicates, 2);

        // Decisions: probable confirmed in bulk, duplicate kept as offer only.
        assert.equal(
          await bulkDecide(admin.id, firstId, 'confirm-probable'),
          1,
        );
        const [dupA, dupB] = bySku('DUP-1');
        await decideRow(admin.id, firstId, dupA!.id, { kind: 'offer' });
        await decideRow(admin.id, firstId, dupB!.id, { kind: 'ignore' });
        const bad = analysed.rows.find((row) => row.rowNumber === 6)!;
        await assert.rejects(
          decideRow(admin.id, firstId, bad.id, { kind: 'create' }),
          /erreurs/,
        );
        const corrected = await correctRow(admin.id, firstId, bad.id, {
          name: `Protège-cartes Xylo ${key}`,
        });
        assert.equal(corrected.action, 'CREATE_PRODUCT');
        await decideRow(admin.id, firstId, bad.id, {
          kind: 'link-sku',
          sku: display.variants[0]!.sku.toLowerCase(),
        });
        const after = await db.supplierImport.findUniqueOrThrow({
          where: { id: firstId },
        });
        const counts = after.summary as Record<string, number>;
        assert.equal(counts.toReview, 0);
        assert.equal(counts.rejected, 0);
        assert.equal(counts.ignored, 1);
        assert.equal(counts.newProducts, 1);
      },
    );

    await t.test(
      'import appliqué : offres, brouillon, historique',
      async () => {
        const report = await applyImport(admin.id, firstId, {
          ignoreReview: false,
        });
        assert.equal(report.productsCreated, 1);
        assert.equal(report.offersCreated, 6);
        assert.equal(report.ignored, 1);
        const offers = await db.supplierOffer.findMany({
          where: { supplierId: supplier.id },
          orderBy: { supplierSku: 'asc' },
        });
        assert.deepEqual(
          offers.map((offer) => [offer.supplierSku, offer.status]),
          [
            ['BAD-1', 'ACTIVE'],
            ['DIS-1', 'ACTIVE'],
            ['DUP-1', 'ACTIVE'],
            ['ETB-1', 'ACTIVE'],
            ['NEW-1', 'ACTIVE'],
            ['TRI-1', 'ACTIVE'],
          ],
        );
        const etbOffer = offers.find((offer) => offer.supplierSku === 'ETB-1')!;
        assert.equal(etbOffer.variantId, etb.variants[0]!.id);
        assert.equal(etbOffer.purchasePrice?.toFixed(2), '39.90');
        assert.equal(etbOffer.msrp?.toFixed(2), '54.90');
        assert.equal(etbOffer.availability, 'IN_STOCK');
        assert.equal(
          offers.find((offer) => offer.supplierSku === 'BAD-1')!.variantId,
          display.variants[0]!.id,
        );
        assert.equal(
          offers.find((offer) => offer.supplierSku === 'DUP-1')!.name,
          `Carte promo Qwv ${key}`,
        );
        // The draft: hidden, unpublished, shop stock untouched.
        const drafts = await db.product.findMany({
          where: { sourceImportId: firstId },
          include: { variants: true, category: true },
        });
        assert.equal(drafts.length, 1);
        const draft = drafts[0]!;
        assert.equal(draft.status, 'DRAFT');
        assert.equal(draft.productType, 'ACCESSORY');
        assert.equal(draft.category.slug, IMPORT_CATEGORY_SLUG);
        assert.equal(draft.category.isActive, false);
        assert.equal(draft.variants[0]!.sku, `SUP-${code}-NEW-1`);
        assert.equal(draft.variants[0]!.barcode, eanNew);
        assert.equal(draft.variants[0]!.price.toFixed(2), '32.90');
        assert.equal(draft.variants[0]!.costPrice?.toFixed(2), '26.40');
        assert.equal(draft.variants[0]!.stockQuantity, 0);
        assert.equal(
          offers.find((offer) => offer.supplierSku === 'NEW-1')!.variantId,
          draft.variants[0]!.id,
        );
        // Existing products are never modified by an import.
        const untouched = await db.productVariant.findUniqueOrThrow({
          where: { id: etb.variants[0]!.id },
        });
        assert.equal(untouched.price.toFixed(2), '50.00');
        assert.equal(untouched.stockQuantity, 3);
        const form = new FormData();
        form.set('id', draft.id);
        form.set('status', 'ACTIVE');
        await assert.rejects(
          changePublication(admin.id, form),
          /catalogue fournisseur : ajoutez sa vraie catégorie, une image, une description/,
        );
        const changes = await db.supplierOfferChange.groupBy({
          by: ['kind'],
          where: { importId: firstId },
          _count: { _all: true },
        });
        assert.deepEqual(
          changes.map((row) => [row.kind, row._count._all]),
          [['NEW_OFFER', 6]],
        );
        const applied = await db.supplierImport.findUniqueOrThrow({
          where: { id: firstId },
          include: { chunks: true },
        });
        assert.equal(applied.status, 'APPLIED');
        assert.equal(applied.appliedById, admin.id);
        assert.ok(applied.durationMs! >= 0);
        assert.equal(applied.chunks.length, 0);
        assert.equal(
          (
            await db.supplierProfile.findUniqueOrThrow({
              where: { id: profileId },
            })
          ).useCount,
          1,
        );
        await assert.rejects(
          applyImport(admin.id, firstId, { ignoreReview: false }),
          /changé d’étape/,
        );
      },
    );

    let secondId = '';
    await t.test(
      'catalogue suivant : profil reconnu, veille des changements',
      async () => {
        const lines = [
          `ETB-1;Coffret Dresseur Elite Flammes ${key};${eanA};37,90;54,90;0;15/11/2026`,
          `DIS-1;Display 36 boosters Flammes ${key};${eanB};129,00;;12;`,
          `NEW-1;Classeur Portfolio Zzyzx ${key};${eanNew};26,40;32,90;5;`,
        ];
        const second = await upload(
          admin.id,
          supplier.id,
          'tarif-octobre.csv',
          csv(lines),
        );
        secondId = second.id;
        assert.equal(second.profileId, profileId);
        // A third file analysed now goes stale once the second is applied.
        const third = await upload(
          admin.id,
          supplier.id,
          'tarif-octobre-bis.csv',
          csv(lines.slice(0, 1)),
          'PARTIAL',
        );
        for (const record of [second, third])
          await saveMapping(admin.id, record.id, {
            mapping: record.mapping as Mapping,
            options: record.options as unknown as ImportOptions,
            scope: record.scope,
            profileName: null,
          });
        const analysed = await db.supplierImport.findUniqueOrThrow({
          where: { id: secondId },
          include: { rows: { orderBy: { rowNumber: 'asc' } } },
        });
        assert.deepEqual(
          analysed.rows.map((row) => [
            row.action,
            ((row.changes as Change[] | null) ?? []).map(
              (change) => change.kind,
            ),
          ]),
          [
            ['UPDATE_OFFER', ['PRICE_DOWN', 'OUT_OF_STOCK']],
            ['UPDATE_OFFER', ['BACK_IN_STOCK']],
            ['UNCHANGED', []],
          ],
        );
        const summary = analysed.summary as Record<string, number>;
        assert.equal(summary.disappeared, 3);
        assert.equal(summary.priceDown, 1);
        assert.equal(summary.backInStock, 1);
        await applyImport(admin.id, secondId, { ignoreReview: false });
        await assert.rejects(
          applyImport(admin.id, third.id, { ignoreReview: false }),
          /relancez l’analyse/,
        );
        await cancelImport(admin.id, third.id);
        const offers = new Map(
          (
            await db.supplierOffer.findMany({
              where: { supplierId: supplier.id },
            })
          ).map((offer) => [offer.supplierSku, offer]),
        );
        assert.equal(offers.get('ETB-1')!.purchasePrice?.toFixed(2), '37.90');
        // Stock 0 with a release date to come: a preorder.
        assert.equal(offers.get('ETB-1')!.availability, 'PREORDER');
        assert.equal(offers.get('DIS-1')!.stock, 12);
        for (const sku of ['TRI-1', 'DUP-1', 'BAD-1']) {
          assert.equal(offers.get(sku)!.status, 'MISSING');
          assert.ok(offers.get(sku)!.missingSince);
        }
        const kinds = await db.supplierOfferChange.findMany({
          where: { importId: secondId },
          select: { kind: true },
        });
        assert.deepEqual(kinds.map((change) => change.kind).sort(), [
          'BACK_IN_STOCK',
          'DISAPPEARED',
          'DISAPPEARED',
          'DISAPPEARED',
          'OUT_OF_STOCK',
          'PRICE_DOWN',
        ]);
      },
    );

    await t.test(
      'annulation : dernier import d’abord, brouillons travaillés conservés',
      async () => {
        await assert.rejects(revertImport(admin.id, firstId), /plus récent/);
        const second = await revertImport(admin.id, secondId);
        assert.deepEqual(second, {
          offersRestored: 3,
          offersDeleted: 0,
          offersBackFromMissing: 3,
          productsDeleted: 0,
          productsKept: 0,
        });
        const restored = new Map(
          (
            await db.supplierOffer.findMany({
              where: { supplierId: supplier.id },
            })
          ).map((offer) => [offer.supplierSku, offer]),
        );
        assert.equal(restored.get('ETB-1')!.purchasePrice?.toFixed(2), '39.90');
        assert.equal(restored.get('ETB-1')!.stock, 24);
        assert.equal(restored.get('ETB-1')!.availability, 'IN_STOCK');
        assert.equal(restored.get('ETB-1')!.lastImportId, firstId);
        assert.equal(restored.get('TRI-1')!.status, 'ACTIVE');
        assert.equal(
          await db.supplierOfferChange.count({ where: { importId: secondId } }),
          0,
        );
        // Someone added an image to the draft: it is no longer the import's alone.
        const draft = await db.product.findFirstOrThrow({
          where: { sourceImportId: firstId },
        });
        await db.productImage.create({
          data: { productId: draft.id, url: '/assets/test.webp', alt: 'test' },
        });
        const first = await revertImport(admin.id, firstId);
        assert.deepEqual(first, {
          offersRestored: 0,
          offersDeleted: 6,
          offersBackFromMissing: 0,
          productsDeleted: 0,
          productsKept: 1,
        });
        assert.equal(
          await db.supplierOffer.count({ where: { supplierId: supplier.id } }),
          0,
        );
        assert.equal(
          (
            await db.supplierImport.findUniqueOrThrow({
              where: { id: firstId },
            })
          ).status,
          'REVERTED',
        );
        await db.productImage.deleteMany({ where: { productId: draft.id } });
      },
    );

    await t.test(
      'PDF : texte, page scannée lue par OCR, page ignorée',
      async () => {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const rows = [
          ['Référence', 'Désignation', 'EAN', 'PA HT', 'Stock'],
          [
            'PDF-1',
            `Coffret Dresseur Elite Flammes ${key}`,
            eanA,
            '39,90',
            '24',
          ],
          ['PDF-2', `Display 36 boosters Flammes ${key}`, eanB, '129,00', '0'],
        ];
        const draw = (target: typeof doc, lines: string[][]) => {
          const page = target.addPage([595, 842]);
          lines.forEach((line, index) =>
            line.forEach((cell, column) =>
              page.drawText(cell, {
                x: [40, 100, 330, 440, 510][column]!,
                y: 760 - index * 24,
                size: 10,
                font: target === doc ? font : fontB,
              }),
            ),
          );
        };
        const scanSource = await PDFDocument.create();
        const fontB = await scanSource.embedFont(StandardFonts.Helvetica);
        draw(doc, rows);
        draw(scanSource, [rows[0]!, ['PDF-3', tripackName, '', '14,50', '8']]);
        const png = await renderPageAsImage(
          new Uint8Array(await scanSource.save()),
          1,
          { canvasImport: () => import('@napi-rs/canvas'), scale: 2.5 },
        );
        const image = await doc.embedPng(new Uint8Array(png));
        doc
          .addPage([595, 842])
          .drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
        const record = await upload(
          admin.id,
          supplier.id,
          'catalogue.pdf',
          new Uint8Array(await doc.save()),
          'PARTIAL',
        );
        assert.equal(record.status, 'EXTRACTING');
        assert.deepEqual(
          (
            await db.supplierImportPage.findMany({
              where: { importId: record.id },
              orderBy: { page: 'asc' },
            })
          ).map((page) => [page.method, page.status]),
          [
            ['TEXT', 'DONE'],
            ['OCR', 'PENDING'],
          ],
        );
        assert.deepEqual(await ocrStep(record.id), { remaining: 0 });
        const read = await db.supplierImport.findUniqueOrThrow({
          where: { id: record.id },
          include: {
            rows: { orderBy: { rowNumber: 'asc' } },
            pages: { orderBy: { page: 'asc' } },
          },
        });
        assert.equal(read.status, 'MAPPING');
        assert.deepEqual(
          read.rows.map((row) => [
            row.source,
            (row.raw as { cells: string[] }).cells[0],
          ]),
          [
            ['page 1', 'PDF-1'],
            ['page 1', 'PDF-2'],
            ['page 2 · OCR', 'PDF-3'],
          ],
        );
        assert.ok(read.pages.every((page) => page.status === 'DONE'));
        await changePage(record.id, 2, 'ignore');
        assert.equal(
          await db.supplierImportRow.count({ where: { importId: record.id } }),
          2,
        );
        await changePage(record.id, 2, 'restore');
        assert.equal(
          await db.supplierImportRow.count({ where: { importId: record.id } }),
          3,
        );
        await saveMapping(admin.id, record.id, {
          mapping: read.mapping as Mapping,
          options: OPTIONS,
          scope: 'PARTIAL',
          profileName: null,
        });
        const rows2 = await db.supplierImportRow.findMany({
          where: { importId: record.id },
          orderBy: { rowNumber: 'asc' },
        });
        assert.deepEqual(
          rows2.map((row) => row.match),
          ['CERTAIN', 'CERTAIN', 'PROBABLE'],
        );
        assert.ok(
          (rows2[2]!.issues as { problem: string }[]).some((issue) =>
            issue.problem.startsWith('Ligne lue par OCR'),
          ),
        );
        await cancelImport(admin.id, record.id);
        assert.equal(
          await db.supplierImportRow.count({ where: { importId: record.id } }),
          0,
        );
      },
    );

    await t.test('purge des imports abandonnés', async () => {
      const bytes = csv(['Z-1;Produit abandonné;;1,00;;;']);
      const record = await upload(admin.id, supplier.id, 'vieux.csv', bytes);
      await db.$executeRaw`UPDATE "SupplierImport" SET "updatedAt" = now() - interval '15 days' WHERE id = ${record.id}::uuid`;
      const purged = await purgeSupplierImports(new Date(), 100);
      assert.ok(purged.expired >= 1);
      const expired = await db.supplierImport.findUniqueOrThrow({
        where: { id: record.id },
      });
      assert.equal(expired.status, 'CANCELED');
    });
  } finally {
    const drafts = await db.product.findMany({
      where: { sourceImport: { supplierId: supplier.id } },
      select: { id: true },
    });
    await db.supplierOffer.deleteMany({ where: { supplierId: supplier.id } });
    await db.productImage.deleteMany({
      where: { productId: { in: drafts.map((p) => p.id) } },
    });
    await db.productVariant.deleteMany({
      where: {
        productId: {
          in: [...drafts.map((p) => p.id), etb.id, display.id, tripack.id],
        },
      },
    });
    await db.product.deleteMany({
      where: {
        id: {
          in: [...drafts.map((p) => p.id), etb.id, display.id, tripack.id],
        },
      },
    });
    await db.supplierImport.deleteMany({ where: { supplierId: supplier.id } });
    await db.supplier.delete({ where: { id: supplier.id } });
    await db.category.deleteMany({
      where: {
        OR: [
          { id: category.id },
          { slug: IMPORT_CATEGORY_SLUG, products: { none: {} } },
        ],
      },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
  }
});
