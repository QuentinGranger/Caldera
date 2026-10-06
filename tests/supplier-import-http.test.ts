import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { hashPassword } from 'better-auth/crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { renderPageAsImage } from 'unpdf';
import { getPrisma } from '../src/lib/db/prisma';
import { IMPORT_CATEGORY_SLUG } from '../src/lib/supplier-import/records';
import {
  finishUpload,
  startImport,
  uploadChunk,
} from '../src/lib/supplier-import/service';
import { enrollAdminFixture } from './helpers/admin-mfa';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Fixtures réservées à PostgreSQL local de développement.');
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const origin = new URL(base).origin;
const manifest = JSON.parse(
  await readFile(
    process.env.TEST_ACTION_MANIFEST ??
      '.next/server/server-reference-manifest.json',
    'utf8',
  ),
) as { node: Record<string, { exportedName?: string }> };
const db = getPrisma();

test('imports fournisseurs en HTTP : accès, analyse, import, annulation', async (t) => {
  const key = randomUUID();
  const email = `http-imports-${key}@example.com`;
  const password = `test-${randomUUID()}`;
  const adminId = randomUUID();
  const supplierName = `Grossiste HTTP ${key.slice(0, 8)}`;
  await db.adminUser.create({
    data: {
      id: adminId,
      name: 'Admin imports HTTP',
      email,
      accounts: {
        create: {
          accountId: adminId,
          providerId: 'credential',
          password: await hashPassword(password),
        },
      },
    },
  });
  const supplier = await db.supplier.create({
    data: { name: supplierName, code: `H${key.slice(0, 6).toUpperCase()}` },
  });
  const fileName = `tarif-http-${key.slice(0, 8)}.csv`;
  const bytes = new TextEncoder().encode(
    [
      'Référence;Désignation;PA HT;Stock',
      `HTTP-1;Classeur secret ${key.slice(0, 8)};12,50;4`,
      `HTTP-2;Portfolio secret ${key.slice(0, 8)};8,90;0`,
    ].join('\n'),
  );
  const { id: importId } = await startImport(adminId, {
    supplierId: supplier.id,
    fileName,
    fileSize: bytes.byteLength,
    fileHash: createHash('sha256').update(bytes).digest('hex'),
    scope: 'PARTIAL',
  });
  await uploadChunk(importId, 0, bytes);
  await finishUpload(importId);
  let cookie = '';

  async function page(path: string, selectedCookie = cookie) {
    const response = await fetch(`${base}${path}`, {
      headers: { Cookie: selectedCookie },
      redirect: 'manual',
    });
    return { response, html: await response.text() };
  }
  async function action(
    name: string,
    values: Record<string, string>,
    path = '/admin/login',
    selectedCookie = cookie,
  ) {
    const actionId = Object.entries(manifest.node).find(
      ([, value]) => value.exportedName === name,
    )?.[0];
    assert.ok(actionId, `Action absente : ${name}`);
    const data = new FormData();
    for (const [field, value] of Object.entries(values))
      data.set(`_1_${field}`, value);
    data.set('0', JSON.stringify([{ success: false, message: '' }, '$K1']));
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        Accept: 'text/x-component',
        Origin: origin,
        Cookie: selectedCookie,
      },
      body: data,
      redirect: 'manual',
    });
    return {
      response,
      body: await response.text(),
      cookies: response.headers.getSetCookie(),
    };
  }
  const pages = [
    '/admin/fournisseurs',
    `/admin/fournisseurs/${supplier.id}`,
    '/admin/fournisseurs/imports',
    '/admin/fournisseurs/imports/nouveau',
    `/admin/fournisseurs/imports/${importId}`,
    '/admin/fournisseurs/veille',
  ];
  const importPath = `/admin/fournisseurs/imports/${importId}`;

  try {
    await t.test('sans session : rien n’est montré ni modifié', async () => {
      for (const path of pages) {
        const result = await page(path, '');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
          `Accès sans session : ${path}`,
        );
        assert.ok(!result.html.includes(supplierName), path);
        assert.ok(!result.html.includes('secret'), path);
      }
      const forged = await action(
        'applyAction',
        { id: importId, ignoreReview: 'on' },
        importPath,
        '',
      );
      assert.ok(
        (
          forged.response.headers.get('x-action-redirect') ?? forged.body
        ).includes('/admin/login'),
      );
      assert.equal(
        (await db.supplierImport.findUniqueOrThrow({ where: { id: importId } }))
          .status,
        'MAPPING',
      );
    });

    await t.test('connexion administrateur', async () => {
      const result = await action(
        'loginAction',
        { email, password },
        '/admin/login',
        '',
      );
      assert.ok(
        (result.response.headers.get('x-action-redirect') ?? '').startsWith(
          '/admin/securite',
        ),
        result.body.slice(0, 300),
      );
      const header = result.cookies.find((value) =>
        /caldera_admin\.session_token=/.test(value),
      );
      assert.ok(header, 'Cookie de session absent');
      cookie = await enrollAdminFixture(password, header.split(';')[0]!);
    });

    await t.test('pages privées, sans erreur', async () => {
      for (const path of pages) {
        const result = await page(path);
        assert.equal(result.response.status, 200, path);
        assert.ok(
          /private|no-store/.test(
            result.response.headers.get('cache-control') ?? '',
          ),
          path,
        );
        assert.ok(!result.html.includes('Administration indisponible'), path);
      }
      const wizard = await page(importPath);
      assert.ok(wizard.html.includes(fileName));
      assert.ok(wizard.html.includes('Analyser le fichier'));
    });

    await t.test(
      'colonnes validées, aperçu, import puis annulation',
      async () => {
        const mapped = await action(
          'mappingAction',
          {
            id: importId,
            'field:supplierSku': 'Référence',
            'field:name': 'Désignation',
            'field:purchasePrice': 'PA HT',
            'field:stock': 'Stock',
            decimal: ',',
            dateOrder: 'DMY',
            defaultLanguage: 'FR',
            defaultVatRate: '',
            scope: 'PARTIAL',
          },
          importPath,
        );
        assert.ok(
          mapped.body.includes('Fichier analysé'),
          mapped.body.slice(-300),
        );
        const review = await page(importPath);
        assert.ok(review.html.includes('Aperçu avant import'));
        const refused = await action(
          'applyAction',
          { id: importId, unexpected: 'x' },
          importPath,
        );
        assert.ok(refused.body.includes('Champ non autorisé'));
        const applied = await action(
          'applyAction',
          { id: importId },
          importPath,
        );
        assert.ok(
          applied.body.includes('Import appliqué'),
          applied.body.slice(-300),
        );
        assert.equal(
          await db.supplierOffer.count({ where: { supplierId: supplier.id } }),
          2,
        );
        assert.ok((await page(importPath)).html.includes('Rapport d’import'));
        const reverted = await action(
          'revertAction',
          { id: importId },
          importPath,
        );
        assert.ok(
          reverted.body.includes('Import défait'),
          reverted.body.slice(-300),
        );
        assert.equal(
          await db.supplierOffer.count({ where: { supplierId: supplier.id } }),
          0,
        );
      },
    );

    // OCR only breaks inside a built server (bundler, traced model files):
    // the scanned page is read through the Server Action, as in the browser.
    await t.test(
      'PDF scanné lu par OCR dans le serveur construit',
      async () => {
        const source = await PDFDocument.create();
        const font = await source.embedFont(StandardFonts.Helvetica);
        const drawn = source.addPage([595, 842]);
        [
          ['Référence', 'Désignation', 'PA HT', 'Stock'],
          ['OCR-1', 'Classeur scanné', '12,50', '4'],
          ['OCR-2', 'Portfolio scanné', '8,90', '0'],
        ].forEach((row, line) =>
          row.forEach((cell, column) =>
            drawn.drawText(cell, {
              x: [40, 130, 360, 470][column]!,
              y: 760 - line * 24,
              size: 11,
              font,
            }),
          ),
        );
        const png = await renderPageAsImage(
          new Uint8Array(await source.save()),
          1,
          { canvasImport: () => import('@napi-rs/canvas'), scale: 2.5 },
        );
        const scan = await PDFDocument.create();
        const image = await scan.embedPng(new Uint8Array(png));
        scan
          .addPage([595, 842])
          .drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
        const pdf = new Uint8Array(await scan.save());
        const { id: pdfImportId } = await startImport(adminId, {
          supplierId: supplier.id,
          fileName: 'scan.pdf',
          fileSize: pdf.byteLength,
          fileHash: createHash('sha256').update(pdf).digest('hex'),
          scope: 'PARTIAL',
        });
        await uploadChunk(pdfImportId, 0, pdf);
        await finishUpload(pdfImportId);
        assert.equal(
          (
            await db.supplierImport.findUniqueOrThrow({
              where: { id: pdfImportId },
            })
          ).status,
          'EXTRACTING',
        );
        const actionId = Object.entries(manifest.node).find(
          ([, value]) => value.exportedName === 'ocrStepAction',
        )?.[0];
        assert.ok(actionId, 'Action absente : ocrStepAction');
        const response = await fetch(
          `${base}/admin/fournisseurs/imports/${pdfImportId}`,
          {
            method: 'POST',
            headers: {
              'Next-Action': actionId,
              'Content-Type': 'text/plain;charset=UTF-8',
              Accept: 'text/x-component',
              Origin: origin,
              Cookie: cookie,
            },
            body: JSON.stringify([pdfImportId]),
          },
        );
        const body = await response.text();
        assert.ok(body.includes('"remaining":0'), body.slice(-300));
        const read = await db.supplierImport.findUniqueOrThrow({
          where: { id: pdfImportId },
          include: {
            pages: true,
            rows: { orderBy: { rowNumber: 'asc' } },
          },
        });
        assert.equal(read.status, 'MAPPING');
        assert.deepEqual(
          read.pages.map((page) => [page.method, page.status]),
          [['OCR', 'DONE']],
        );
        assert.deepEqual(
          read.rows.map((row) => [
            row.source,
            (row.raw as { cells: string[] }).cells[0],
          ]),
          [
            ['page 1 · OCR', 'OCR-1'],
            ['page 1 · OCR', 'OCR-2'],
          ],
        );
      },
    );
  } finally {
    const drafts = await db.product.findMany({
      where: { sourceImportId: importId },
      select: { id: true },
    });
    await db.supplierOffer.deleteMany({ where: { supplierId: supplier.id } });
    await db.productVariant.deleteMany({
      where: { productId: { in: drafts.map((product) => product.id) } },
    });
    await db.product.deleteMany({
      where: { id: { in: drafts.map((product) => product.id) } },
    });
    await db.supplierImport.deleteMany({ where: { supplierId: supplier.id } });
    await db.supplier.delete({ where: { id: supplier.id } });
    await db.category.deleteMany({
      where: { slug: IMPORT_CATEGORY_SLUG, products: { none: {} } },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: adminId } });
    await db.adminUser.delete({ where: { id: adminId } });
    await db.$disconnect();
  }
});
