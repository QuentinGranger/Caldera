import 'dotenv/config';
import { deriveCarnet, parseCarnetContent } from '../src/lib/carnets/content';
import {
  serializeNewsletterDocument,
  parseNewsletterDocument,
} from '../src/lib/newsletter/document';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { hashPassword } from 'better-auth/crypto';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import sharp from 'sharp';
import { imageStorage } from '../src/lib/storage/images';
import { getPrisma } from '../src/lib/db/prisma';
import { getAdminAuth } from '../src/lib/admin/auth';
import { orderAccessUrl } from '../src/lib/orders/access';
import { enqueueOrderEmail } from '../src/lib/email/outbox';
import { cartTokenHash } from '../src/lib/cart/identity';
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
test('administration : authentification et Server Actions HTTP', async (t) => {
  const key = randomUUID();
  const email = `http-admin-${key}@example.com`;
  const password = `test-${randomUUID()}`;
  const adminId = randomUUID();
  const admin = await db.adminUser.create({
    data: {
      id: adminId,
      name: 'Admin HTTP',
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
  const category = await db.category.create({
    data: { name: 'Catégorie HTTP', slug: `admin-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit HTTP ${key}`,
      slug: `admin-http-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: {
          sku: `HTTP-${key}`,
          price: '59.90',
          stockQuantity: 5,
          isDefault: true,
        },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;
  const cart = await db.cart.create({
    data: {
      tokenHash: cartTokenHash(randomUUID().replaceAll('-', '').repeat(2))!,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
  });
  const order = await db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber: `ADM-HTTP-${key}`,
      status: 'PAID',
      email: `customer-${key}@example.com`,
      currency: 'EUR',
      subtotalAmount: '59.90',
      shippingAmount: '0',
      totalAmount: '59.90',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(),
      internalNote: 'Note confidentielle HTTP',
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          productName: 'Nom snapshot HTTP',
          productSlug: product.slug,
          sku: variant.sku,
          language: 'FR',
          unitPrice: '59.90',
          quantity: 1,
          lineTotal: '59.90',
          imageUrl: '/assets/products/placeholder-sealed.png',
        },
      },
      payment: {
        create: {
          status: 'SUCCEEDED',
          amount: '59.90',
          currency: 'EUR',
          paidAt: new Date(),
        },
      },
      addresses: {
        create: {
          role: 'SHIPPING',
          firstName: 'Test',
          lastName: 'Snapshot',
          addressLine1: '1 rue du Test',
          postalCode: '75001',
          city: 'Paris',
          countryCode: 'FR',
        },
      },
      reservations: {
        create: {
          variantId: variant.id,
          quantity: 1,
          status: 'CONSUMED',
          expiresAt: new Date(),
        },
      },
    },
  });
  let cookie = '';
  let backupCode = '';
  let replacementCode = '';
  let encryptedBackupCodes = '';
  const uploadedUrls: string[] = [];
  async function action(
    name: string,
    values: Record<string, string | File> = {},
    selectedCookie = cookie,
    requestOrigin = origin,
    noArgs = false,
    formOnly = false,
  ) {
    const actionId = Object.entries(manifest.node).find(
      ([, value]) => value.exportedName === name,
    )?.[0];
    assert.ok(actionId, `Action absente : ${name}`);
    const data = new FormData();
    for (const [name, value] of Object.entries(values))
      data.set(`_1_${name}`, value);
    data.set(
      '0',
      JSON.stringify(
        noArgs
          ? []
          : formOnly
            ? ['$K1']
            : [{ success: false, message: '' }, '$K1'],
      ),
    );
    const route =
      name === 'verifyMfaEnrollmentAction' ||
      name === 'replaceAuthenticatorAction'
        ? '/admin/securite'
        : name === 'verifyAdminBackupCodeAction'
          ? '/admin/second-facteur'
          : '/admin/login';
    const response = await fetch(`${base}${route}`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        Accept: 'text/x-component',
        Origin: requestOrigin,
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
  async function page(path: string, selectedCookie = cookie) {
    const response = await fetch(`${base}${path}`, {
      headers: { Cookie: selectedCookie },
      redirect: 'manual',
    });
    return { response, html: await response.text() };
  }
  function sessionCookie(cookies: string[]) {
    const value = cookies.find((header) =>
      /caldera_admin\.session_token=/.test(header),
    );
    assert.ok(value, 'Cookie de session absent');
    return value;
  }
  try {
    await t.test(
      'routes protégées, guest cookie inutilisable, aucune inscription publique',
      async () => {
        for (const path of [
          '/admin',
          '/admin/produits',
          '/admin/produits/nouveau',
          `/admin/produits/${product.id}`,
          '/admin/stocks',
          '/admin/mesures',
          '/admin/commandes',
          `/admin/commandes/${order.id}`,
          '/admin/categories',
          '/admin/extensions',
          '/admin/jeux',
          '/admin/carnets',
          '/admin/carnets/nouveau',
          '/admin/carnets/calendrier?mois=2026-11',
          '/admin/newsletter',
          '/admin/newsletter/nouvelle',
          '/admin/newsletter/campagnes/nouvelle',
          `/admin/commandes/${order.id}/bon-preparation`,
        ]) {
          const result = await page(path, 'caldera_cart=invalid');
          assert.ok(
            result.response.status === 307 ||
              result.html.includes('NEXT_REDIRECT'),
          );
          assert.ok(
            (result.response.headers.get('location') ?? result.html).includes(
              '/admin/login',
            ),
          );
          assert.ok(
            !result.html.includes(order.email),
            'Données client exposées sans session',
          );
        }
        const signup = await fetch(`${base}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `intruder-${key}@example.com`,
            password,
            name: 'Intruder',
          }),
        });
        assert.equal(signup.status, 404);
      },
    );
    await t.test(
      'actions non authentifiées et origine étrangère refusées',
      async () => {
        const result = await action(
          'adjustStockAction',
          {
            variantId: variant.id,
            mode: 'delta',
            quantity: '10',
            type: 'RESTOCK',
            reason: 'Forgery',
          },
          '',
        );
        assert.ok(
          (
            result.response.headers.get('x-action-redirect') ?? result.body
          ).includes('/admin/login'),
        );
        const csrf = await action(
          'loginAction',
          { email, password },
          '',
          'https://attacker.example',
        );
        assert.ok(csrf.response.status >= 400);
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variant.id },
            })
          ).stockQuantity,
          5,
        );
      },
    );
    await t.test('mauvais mot de passe et admin inactif refusés', async () => {
      const wrong = await action(
        'loginAction',
        { email, password: 'incorrect-password' },
        '',
      );
      assert.ok(wrong.body.includes('Identifiants incorrects'));
      await db.adminUser.update({
        where: { id: admin.id },
        data: { isActive: false },
      });
      const inactive = await action('loginAction', { email, password }, '');
      assert.ok(
        !inactive.cookies.some((value) =>
          /caldera_admin\.session_token=/.test(value),
        ),
      );
      assert.equal(
        await db.adminSession.count({ where: { userId: admin.id } }),
        0,
      );
      await db.adminUser.update({
        where: { id: admin.id },
        data: { isActive: true },
      });
    });
    await t.test(
      'connexion, enrôlement MFA, révocation des sessions antérieures et cookies',
      async () => {
        const result = await action('loginAction', { email, password }, '');
        assert.ok(
          (result.response.headers.get('x-action-redirect') ?? '').startsWith(
            '/admin/securite',
          ),
          `Connexion sans redirection, statut ${result.response.status}`,
        );
        const header = sessionCookie(result.cookies);
        assert.ok(/HttpOnly/i.test(header));
        assert.ok(/SameSite=Lax/i.test(header));
        assert.ok(/Secure/i.test(header));
        cookie = header.split(';')[0]!;
        const passwordOnlyCookie = cookie;
        const restricted = await page('/admin');
        assert.ok(
          (
            restricted.response.headers.get('location') ?? restricted.html
          ).includes('/admin/securite'),
        );
        const editionWithoutMfa = await page('/admin/newsletter/nouvelle');
        assert.ok(
          (
            editionWithoutMfa.response.headers.get('location') ??
            editionWithoutMfa.html
          ).includes('/admin/securite'),
        );
        const enrollment = await getAdminAuth().api.enableTwoFactor({
          body: { password, method: 'totp' },
          headers: new Headers({ Cookie: cookie, Origin: origin }),
        });
        assert.equal(enrollment.method, 'totp');
        backupCode = enrollment.backupCodes[0]!;
        replacementCode = enrollment.backupCodes[1]!;
        encryptedBackupCodes = (
          await db.adminTwoFactor.findFirstOrThrow({
            where: { userId: admin.id },
          })
        ).backupCodes;
        assert.ok(!encryptedBackupCodes.includes(backupCode));
        const secret = new URL(enrollment.totpURI).searchParams.get('secret');
        assert.ok(secret);
        const code = await createOTP(
          new TextDecoder().decode(base32.decode(secret)),
          { period: 30, digits: 6 },
        ).totp();
        const verified = await action('verifyMfaEnrollmentAction', {
          code,
          backupSaved: 'on',
        });
        assert.ok(
          (verified.response.headers.get('x-action-redirect') ?? '').startsWith(
            '/admin',
          ),
          verified.body.slice(0, 300),
        );
        cookie = sessionCookie(verified.cookies).split(';')[0]!;
        const revoked = await page('/admin', passwordOnlyCookie);
        assert.ok(
          (revoked.response.headers.get('location') ?? revoked.html).includes(
            '/admin/login',
          ),
        );
        assert.equal(
          (await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } }))
            .twoFactorEnabled,
          true,
        );
        const session = await db.adminSession.findFirstOrThrow({
          where: { userId: admin.id },
        });
        assert.equal(
          await db.adminSession.count({ where: { userId: admin.id } }),
          1,
        );
        assert.ok(
          Math.abs(
            session.expiresAt.getTime() -
              session.createdAt.getTime() -
              8 * 3600000,
          ) < 10000,
        );
        assert.ok(
          (await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } }))
            .lastLoginAt,
        );
      },
    );
    await t.test(
      'dashboard, listes et formulaires : données privées sans cache public',
      async () => {
        for (const path of [
          '/admin',
          '/admin/produits',
          '/admin/produits/nouveau',
          `/admin/produits/${product.id}`,
          '/admin/stocks',
          '/admin/mesures',
          '/admin/categories',
          '/admin/extensions',
          '/admin/jeux',
          '/admin/commandes',
          '/admin/clients',
          '/admin/messages',
          '/admin/retours',
          `/admin/retours/nouveau?commande=${order.id}`,
          '/admin/livraison',
          '/admin/fournisseurs',
          '/admin/fournisseurs/imports',
          '/admin/fournisseurs/imports/nouveau',
          '/admin/fournisseurs/veille',
          '/admin/discord',
          '/admin/carnets/calendrier?mois=2026-11',
          '/admin/newsletter',
          '/admin/newsletter/nouvelle',
          '/admin/newsletter/campagnes/nouvelle',
          '/admin/promotions',
          '/admin/promotions/nouvelle',
          '/admin/factures',
          '/admin/factures/reglages',
          '/admin/fiscalite',
          '/admin/pilotage',
          '/admin/securite',
        ]) {
          const result = await page(path);
          assert.equal(result.response.status, 200);
          assert.ok(
            !result.html.includes('Administration indisponible'),
            `Erreur serveur sur ${path}`,
          );
          assert.ok(
            /private|no-store/.test(
              result.response.headers.get('cache-control') ?? '',
            ),
          );
          assert.ok(result.html.includes('noindex'));
        }
        for (const sort of ['name', 'created', 'updated', 'price', 'stock']) {
          const result = await page(
            `/admin/produits?search=${key}&sort=${sort}&status=ACTIVE&language=FR&categoryId=${category.id}&availability=in`,
          );
          assert.ok(
            result.html.includes(product.name),
            `Produit absent avec tri ${sort}`,
          );
        }
        const search = await page(`/admin/produits?search=${variant.sku}`);
        assert.ok(search.html.includes(product.name));
      },
    );
    await t.test(
      'studio newsletter : sauvegarde HTTP et sérialisation intacte après CRLF multipart',
      async () => {
        const pixels = await sharp({
          create: { width: 32, height: 32, channels: 3, background: '#173e32' },
        })
          .png()
          .toBuffer();
        const image = new File([new Uint8Array(pixels)], 'studio.png', {
          type: 'image/png',
        });
        const refusedUpload = await action(
          'uploadNewsletterImageAction',
          { file: image },
          '',
          origin,
          false,
          true,
        );
        assert.ok(
          (
            refusedUpload.response.headers.get('x-action-redirect') ??
            refusedUpload.body
          ).includes('/admin/login'),
        );
        const uploaded = await action(
          'uploadNewsletterImageAction',
          { file: image },
          cookie,
          origin,
          false,
          true,
        );
        const imageUrl = uploaded.body.match(/\/media\/[a-f0-9-]+\.webp/)?.[0];
        assert.ok(imageUrl, uploaded.body.slice(0, 400));
        uploadedUrls.push(imageUrl);
        const imageResponse = await fetch(`${base}${imageUrl}`);
        assert.equal(imageResponse.status, 200);
        assert.match(
          imageResponse.headers.get('content-type') ?? '',
          /image\/webp/,
        );
        const internalName = `Newsletter HTTP ${key}`;
        const bodyMarkdown = serializeNewsletterDocument({
          version: 1,
          theme: 'journal',
          blocks: [
            {
              id: 'message',
              type: 'text',
              text: 'Bonjour **vous**.\n\nUne actualité utile.',
            },
          ],
        });
        const values = {
          internalName,
          subject: 'Objet HTTP',
          heading: 'Journal HTTP',
          bodyMarkdown,
        };
        const unauthorized = await action(
          'saveNewsletterCampaignAction',
          values,
          '',
        );
        assert.ok(
          (
            unauthorized.response.headers.get('x-action-redirect') ??
            unauthorized.body
          ).includes('/admin/login'),
        );
        try {
          const saved = await action('saveNewsletterCampaignAction', values);
          assert.ok(
            saved.body.includes('Brouillon enregistré'),
            saved.body.slice(0, 400),
          );
          const campaign = await db.newsletterCampaign.findFirstOrThrow({
            where: { internalName },
          });
          assert.deepEqual(
            parseNewsletterDocument(campaign.bodyMarkdown),
            parseNewsletterDocument(bodyMarkdown),
          );
          const refusedSchedule = await action(
            'queueNewsletterCampaignAction',
            {
              id: campaign.id,
              sendMode: 'later',
              scheduledAt: '',
              scheduledLocal: '2026-10-13T10:30',
              timeZone: 'Europe/Paris',
            },
          );
          assert.ok(
            refusedSchedule.body.includes(
              'Choisissez une date et une heure valides',
            ),
          );
          assert.equal(
            (
              await db.newsletterCampaign.findUniqueOrThrow({
                where: { id: campaign.id },
              })
            ).status,
            'DRAFT',
          );
          const campaignPage = await page(
            `/admin/newsletter/campagnes/${campaign.id}`,
          );
          assert.equal(campaignPage.response.status, 200);
          assert.ok(campaignPage.html.includes('Composez'));
        } finally {
          const campaigns = await db.newsletterCampaign.findMany({
            where: { internalName },
            select: { id: true },
          });
          await db.adminAuditLog.deleteMany({
            where: { entityId: { in: campaigns.map((c) => c.id) } },
          });
          await db.newsletterCampaign.deleteMany({ where: { internalName } });
        }
      },
    );
    await t.test(
      'Nouvelle édition : deux parcours protégés, retours et visites sans création',
      async () => {
        const before = {
          chapters: await db.carnetChapter.count(),
          campaigns: await db.newsletterCampaign.count(),
        };
        const newsletter = await page('/admin/newsletter');
        assert.match(newsletter.html, /href="\/admin\/newsletter\/nouvelle"/);
        assert.match(newsletter.html, /Nouvelle édition/);
        const sections = [
          'prochaine-edition',
          'avance-editoriale',
          'campagnes-newsletter',
          'audience-newsletter',
          'technique-newsletter',
        ];
        const positions = sections.map((id) =>
          newsletter.html.indexOf(`id="${id}"`),
        );
        assert.ok(
          positions.every(
            (position, i) =>
              position >= 0 && (i === 0 || position > positions[i - 1]!),
          ),
          'Production, campagnes, audience, technique dans cet ordre',
        );
        assert.match(newsletter.html, /2 Carnets par mois/);
        assert.match(
          newsletter.html,
          /Inscriptions à la newsletter|Aucune inscription trouvée/,
        );
        assert.match(newsletter.html, /Automatisations et état du service d/);
        assert.doesNotMatch(
          newsletter.html,
          /href="\/admin\/newsletter\/campagnes\/nouvelle"/,
        );
        const choice = await page('/admin/newsletter/nouvelle');
        assert.equal(choice.response.status, 200);
        assert.match(choice.html, /<h1>Nouvelle édition<\/h1>/);
        assert.equal(
          [
            ...choice.html.matchAll(
              /aria-labelledby="(?:carnet|commercial)-edition-title"/g,
            ),
          ].length,
          2,
        );
        assert.match(choice.html, /href="\/admin\/carnets\/nouveau"/);
        assert.match(
          choice.html,
          /href="\/admin\/newsletter\/campagnes\/nouvelle"/,
        );
        assert.match(choice.html, /Créer un Carnet/);
        assert.match(choice.html, /Créer une campagne commerciale/);
        assert.match(choice.html, /Le Comptoir/);
        const carnet = await page('/admin/carnets/nouveau');
        assert.equal(carnet.response.status, 200);
        assert.ok(
          carnet.html.includes('Le récit complet'),
          'Le parcours ouvre l’éditeur narratif',
        );
        assert.doesNotMatch(carnet.html, /CAMPAIGN STUDIO/);
        const commercial = await page('/admin/newsletter/campagnes/nouvelle');
        assert.equal(commercial.response.status, 200);
        assert.match(commercial.html, /CAMPAIGN STUDIO/);
        for (const result of [choice, carnet, commercial])
          assert.match(result.html, /href="\/admin\/newsletter"/);
        assert.deepEqual(
          {
            chapters: await db.carnetChapter.count(),
            campaigns: await db.newsletterCampaign.count(),
          },
          before,
        );
      },
    );
    await t.test(
      'Arcs narratifs : vue par défaut, liste conservée et préremplissage sans création',
      async () => {
        const before = await db.carnetChapter.count();
        const arcs = await page('/admin/carnets');
        assert.equal(arcs.response.status, 200);
        assert.match(arcs.html, /Vos arcs narratifs/);
        assert.match(arcs.html, /Pagination des arcs/);
        assert.match(arcs.html, /vue=liste/);
        const list = await page('/admin/carnets?vue=liste');
        assert.equal(list.response.status, 200);
        assert.match(list.html, /name="vue" value="liste"/);
        const draft = await page(
          '/admin/carnets/nouveau?arcTitle=La%20for%C3%AAt&arcPosition=4&arcTotal=6',
        );
        assert.equal(draft.response.status, 200);
        assert.match(draft.html, /name="arcTitle"[^>]*value="La forêt"/);
        assert.match(draft.html, /name="arcPosition"[^>]*value="4"/);
        assert.match(draft.html, /name="arcTotal"[^>]*value="6"/);
        assert.match(draft.html, /<datalist/);
        assert.equal(await db.carnetChapter.count(), before);
      },
    );
    await t.test(
      'Calendrier éditorial : mois, navigation et visite sans modification',
      async () => {
        const before = {
          chapters: await db.carnetChapter.count(),
          campaigns: await db.newsletterCampaign.count(),
        };
        const result = await page('/admin/carnets/calendrier?mois=2026-11');
        assert.equal(result.response.status, 200);
        assert.match(result.html, /Calendrier des Carnets/);
        assert.match(result.html, /novembre 2026/);
        assert.match(result.html, /href="\?mois=2026-10"/);
        assert.match(result.html, /href="\?mois=2026-12"/);
        assert.match(result.html, /carnets-a-planifier/);
        assert.match(result.html, /Repère : 6 à 10 épisodes/);
        assert.match(result.html, /Prêt à envoyer/);
        assert.match(result.html, /href="\/admin\/carnets\/nouveau"/);
        assert.ok(
          result.response.headers.get('cache-control')?.includes('no-store'),
        );
        const january = await page('/admin/carnets/calendrier?mois=2027-01');
        assert.match(january.html, /href="\?mois=2026-12"/);
        const invalid = await page('/admin/carnets/calendrier?mois=invalid');
        assert.equal(invalid.response.status, 200);
        assert.deepEqual(
          {
            chapters: await db.carnetChapter.count(),
            campaigns: await db.newsletterCampaign.count(),
          },
          before,
        );
      },
    );
    await t.test(
      'Recherche Comptoir protégée et stock actualisé pour les produits sélectionnés',
      async () => {
        const data = {
          search: 'Produit HTTP',
          selectedIds: JSON.stringify([product.id]),
        };
        const denied = await action(
          'searchCarnetProductsAction',
          data,
          '',
          origin,
          false,
          true,
        );
        assert.ok(
          (
            denied.response.headers.get('x-action-redirect') ?? denied.body
          ).includes('/admin/login'),
        );
        const found = await action(
          'searchCarnetProductsAction',
          data,
          cookie,
          origin,
          false,
          true,
        );
        assert.ok(found.body.includes(product.id));
        assert.ok(found.body.includes(product.name));
        assert.doesNotMatch(found.body, /costPrice|procurementFees/);
        await db.product.update({
          where: { id: product.id },
          data: { status: 'DRAFT' },
        });
        try {
          const retained = await action(
            'searchCarnetProductsAction',
            {
              search: 'aucun résultat',
              selectedIds: JSON.stringify([product.id]),
            },
            cookie,
            origin,
            false,
            true,
          );
          assert.ok(retained.body.includes(product.id));
          assert.match(retained.body, /produit non publié/);
        } finally {
          await db.product.update({
            where: { id: product.id },
            data: { status: 'ACTIVE' },
          });
        }
      },
    );
    await t.test(
      'Carnets HTTP : source unique, MFA requis, validation, conflit et archivage réversible',
      async () => {
        const content = JSON.stringify({
          version: 1,
          document: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Le lac avait reculé.' }],
              },
              { type: 'newsletterCut' },
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Le lendemain matin, la route reparut.',
                  },
                ],
              },
            ],
          },
        });
        const campaignsBeforeCarnet = await db.newsletterCampaign.count();
        const values = {
          revision: '0',
          number: '543209',
          title: `Carnet HTTP ${key}`,
          slug: `carnet-http-${key}`,
          content,
          status: 'DRAFT',
          location: 'Cœurlac',
          earlyAccessAt: '2026-10-20T09:00',
          publicAt: '2026-11-03T09:00',
        };
        const refused = await action('saveCarnetChapterAction', values, '');
        assert.ok(
          (
            refused.response.headers.get('x-action-redirect') ?? refused.body
          ).includes('/admin/login'),
        );
        const forged = await action(
          'saveCarnetChapterAction',
          values,
          cookie,
          'https://foreign.example',
        );
        assert.equal(forged.response.status, 500);
        const saved = await action('saveCarnetChapterAction', values);
        assert.ok(
          saved.body.includes('Édition enregistrée'),
          saved.body.slice(0, 400),
        );
        const chapter = await db.carnetChapter.findUniqueOrThrow({
          where: { slug: values.slug },
        });
        assert.deepEqual(
          parseCarnetContent(chapter.content),
          parseCarnetContent(content),
        );
        assert.equal(
          deriveCarnet(parseCarnetContent(chapter.content)).excerpt?.text,
          'Le lac avait reculé.',
        );
        const detail = await page(`/admin/carnets/${chapter.id}`);
        assert.equal(detail.response.status, 200);
        assert.ok(detail.html.includes('Le récit complet'));
        assert.equal(chapter.location, 'Cœurlac');
        assert.equal(
          await db.newsletterCampaign.count(),
          campaignsBeforeCarnet,
          'Créer un Carnet ne crée pas une campagne vide',
        );
        assert.equal(
          chapter.earlyAccessAt?.toISOString(),
          '2026-10-20T07:00:00.000Z',
        );
        const newCampaign = await page(
          `/admin/newsletter/campagnes/nouvelle?chapterId=${chapter.id}`,
        );
        assert.equal(newCampaign.response.status, 200);
        assert.ok(newCampaign.html.includes(chapter.id));
        assert.ok(newCampaign.html.includes('Le lac avait reculé.'));
        assert.ok(
          !newCampaign.html.includes('Le lendemain matin, la route reparut.'),
        );
        assert.ok(newCampaign.html.includes('Continuer l’expédition'));
        const campaignFields = {
          internalName: `Carnet relation HTTP ${key}`,
          subject: 'Expédition',
          heading: 'Expédition',
          bodyMarkdown: 'Contenu marketing indépendant.',
          chapterId: chapter.id,
        };
        try {
          const linked = await action(
            'saveNewsletterCampaignAction',
            campaignFields,
          );
          assert.ok(linked.body.includes('"success":true'));
          const campaign = await db.newsletterCampaign.findFirstOrThrow({
            where: { internalName: campaignFields.internalName },
          });
          assert.equal(campaign.chapterId, chapter.id);
          const { chapterId: _chapterId, ...legacyFields } = campaignFields;
          void _chapterId;
          await action('saveNewsletterCampaignAction', {
            ...legacyFields,
            id: campaign.id,
            subject: 'Objet corrigé',
          });
          assert.equal(
            (
              await db.newsletterCampaign.findUniqueOrThrow({
                where: { id: campaign.id },
              })
            ).chapterId,
            chapter.id,
          );
          const bad = await action('saveNewsletterCampaignAction', {
            ...campaignFields,
            id: campaign.id,
            chapterId: 'invalid',
          });
          assert.ok(bad.body.includes('Identifiant invalide'));
        } finally {
          await db.newsletterCampaign.deleteMany({
            where: { internalName: campaignFields.internalName },
          });
        }
        assert.deepEqual(
          (
            await db.carnetChapter.findUniqueOrThrow({
              where: { id: chapter.id },
            })
          ).content,
          parseCarnetContent(content),
        );
        const publicPage = await page(`/univers/carnets/${chapter.slug}`, '');
        assert.ok(!publicPage.html.includes('Le lac avait reculé.'));
        const invalid = await action('saveCarnetChapterAction', {
          ...values,
          id: chapter.id,
          newsletterExcerpt: 'copie interdite',
        });
        assert.ok(invalid.body.includes('Champ non autorisé'));
        const ready = await action('saveCarnetChapterAction', {
          ...values,
          id: chapter.id,
          status: 'READY',
        });
        assert.ok(ready.body.includes('Édition enregistrée'));
        const stale = await action('saveCarnetChapterAction', {
          ...values,
          id: chapter.id,
        });
        assert.ok(stale.body.includes('autre onglet'));
        const archived = await action('archiveCarnetChapterAction', {
          id: chapter.id,
          revision: '1',
        });
        assert.ok(archived.body.includes('Carnet archivé'));
        const restored = await action('restoreCarnetChapterAction', {
          id: chapter.id,
          revision: '2',
        });
        assert.ok(restored.body.includes('"success":true'));
        assert.equal(
          (
            await db.carnetChapter.findUniqueOrThrow({
              where: { id: chapter.id },
            })
          ).status,
          'DRAFT',
        );
        assert.equal(
          (
            await db.carnetChapter.findUniqueOrThrow({
              where: { id: chapter.id },
            })
          ).revision,
          3,
        );
      },
    );
    await t.test(
      'Édition Carnet HTTP : cinq sections, sauvegarde complète, Mode avancé et accès protégés',
      async () => {
        const fields = {
          revision: '0',
          number: '543208',
          title: 'Édition workflow HTTP',
          slug: `edition-http-${key}`,
          status: 'READY',
          content: JSON.stringify({
            version: 1,
            document: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Extrait HTTP sauvegardé.' }],
                },
                { type: 'newsletterCut' },
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Suite réservée du récit HTTP.' },
                  ],
                },
              ],
            },
          }),
          illustrationUrl: '/assets/brand/logo-header-no-bg.png',
          illustrationAlt: 'Caldera',
          emailSubject: 'Objet de l’édition HTTP',
          emailPreheader: 'Preheader HTTP',
          productIds: JSON.stringify([product.id]),
        };
        let chapterId = '',
          campaignId = '';
        try {
          const saved = await action('saveCarnetChapterAction', fields);
          assert.ok(
            saved.body.includes('"success":true'),
            saved.body.slice(0, 500),
          );
          const chapter = await db.carnetChapter.findUniqueOrThrow({
            where: { slug: fields.slug },
          });
          chapterId = chapter.id;
          campaignId = chapter.editionCampaignId!;
          const campaign = await db.newsletterCampaign.findUniqueOrThrow({
            where: { id: campaignId },
          });
          const detail = await page(`/admin/carnets/${chapterId}`);
          for (const section of [
            'carnet-recit',
            'carnet-comptoir',
            'carnet-email',
            'carnet-diffusion',
            'carnet-verification',
          ])
            assert.ok(detail.html.includes(`id="${section}"`));
          assert.doesNotMatch(
            detail.html,
            /CAMPAIGN STUDIO|Bibliothèque de blocs/,
          );
          assert.match(detail.html, /Objet de l’édition HTTP/);
          for (const label of [
            'Extrait entre 250 et 400 mots',
            'Publication publique prévue à J+14',
            'Test email envoyé',
            'LE DÉPART ATTEND VOS CORRECTIONS',
          ])
            assert.ok(detail.html.includes(label), label);
          assert.doesNotMatch(detail.html, /PRÊT POUR LE DÉPART/);
          assert.match(detail.html, /Continuer l’expédition/);
          assert.match(detail.html, /Aperçu e-mail ordinateur/);
          const refs = {
            id: chapter.id,
            revision: String(chapter.revision),
            campaignUpdatedAt: campaign.updatedAt.toISOString(),
          };
          const anonymous = await action(
            'advancedCarnetEditionAction',
            refs,
            '',
          );
          assert.ok(
            (
              anonymous.response.headers.get('x-action-redirect') ??
              anonymous.body
            ).includes('/admin/login'),
          );
          const test = await action('testCarnetEditionAction', refs);
          assert.match(test.body, /désactivés/);
          const invalidQueue = await action('queueCarnetEditionAction', refs);
          assert.match(invalidQueue.body, /date d’envoi/);
          const advanced = await action('advancedCarnetEditionAction', refs);
          assert.ok(
            (
              advanced.response.headers.get('x-action-redirect') ??
              advanced.body
            ).includes(`/admin/newsletter/campagnes/${campaignId}`),
          );
          const studio = await page(
            `/admin/newsletter/campagnes/${campaignId}`,
          );
          assert.match(studio.html, /CAMPAIGN STUDIO/);
          assert.match(studio.html, /Composition/);
          assert.match(studio.html, /personnalisé/);
          assert.deepEqual(
            (
              await db.carnetChapter.findUniqueOrThrow({
                where: { id: chapterId },
              })
            ).content,
            chapter.content,
          );
        } finally {
          if (chapterId)
            await db.carnetChapter.delete({ where: { id: chapterId } });
          if (campaignId)
            await db.newsletterCampaign.delete({ where: { id: campaignId } });
        }
      },
    );
    await t.test(
      'recherche commandes numéro / email / SKU et snapshots détaillés',
      async () => {
        for (const search of [
          order.orderNumber,
          order.email,
          variant.sku,
          order.publicId,
        ]) {
          const result = await page(
            `/admin/commandes?search=${encodeURIComponent(search)}&status=PAID&payment=SUCCEEDED`,
          );
          assert.ok(result.html.includes(order.orderNumber));
        }
        const detail = await page(`/admin/commandes/${order.id}`);
        for (const text of [
          'Nom snapshot HTTP',
          '1 rue du Test',
          'Paris',
          'Réussi',
          'Consommée',
          '59,90',
          'Note confidentielle HTTP',
        ])
          assert.ok(
            detail.html.includes(text),
            `Information manquante : ${text}`,
          );
        assert.ok(!detail.html.includes('Annuler la commande impayée'));
        const publicProduct = await page(`/produit/${product.slug}`, '');
        assert.ok(!publicProduct.html.includes('Note confidentielle HTTP'));
        assert.ok(!publicProduct.html.includes('costPrice'));
      },
    );
    await t.test(
      'fulfillment HTTP : auth, transitions, aperçu, suivi signé et impression',
      async () => {
        const confirmation = await db.$transaction((tx) =>
          enqueueOrderEmail(tx, order.id, 'ORDER_CONFIRMATION'),
        );
        const access = new URL(orderAccessUrl(order.publicId)).searchParams.get(
          'access',
        )!;
        const customerPath = `/commande/${order.publicId}?access=${encodeURIComponent(access)}`;
        const unowned = await page(`/commande/${order.publicId}`, '');
        assert.ok(!unowned.html.includes(order.email));
        for (const path of [
          `/checkout/paiement/${order.publicId}?access=${access}`,
          `/api/commande/${order.publicId}?access=${access}`,
        ]) {
          const denied = await page(path, '');
          assert.equal(denied.response.status, 404);
        }
        const first = await page(customerPath, '');
        assert.ok(first.html.includes('Commande reçue'));
        assert.ok(first.html.includes('noindex'));
        assert.ok(!first.html.includes(order.internalNote!));
        assert.equal(
          first.response.headers.get('referrer-policy'),
          'no-referrer',
        );
        for (const name of [
          'fulfillmentAction',
          'shipmentAction',
          'correctTrackingAction',
          'retryEmailAction',
        ]) {
          const denied = await action(
            name,
            { orderId: order.id, next: 'PREPARING', emailId: confirmation.id },
            '',
          );
          assert.ok(
            (
              denied.response.headers.get('x-action-redirect') ?? denied.body
            ).includes('/admin/login'),
          );
        }
        const deniedPreview = await page(
          `/admin/emails/${confirmation.id}/preview`,
          '',
        );
        assert.equal(deniedPreview.response.status, 307);
        const invalid = await action('fulfillmentAction', {
          orderId: order.id,
          next: 'DELIVERED',
        });
        assert.ok(invalid.body.includes('non autorisée'));
        for (const next of ['PREPARING', 'READY_TO_SHIP']) {
          const result = await action('fulfillmentAction', {
            orderId: order.id,
            next,
          });
          assert.ok(result.body.includes('"success":true'));
        }
        const ready = await page(customerPath, '');
        assert.ok(ready.html.includes('Prête à être expédiée'));
        const shipment = await action('shipmentAction', {
          orderId: order.id,
          carrierCode: 'COLISSIMO',
          trackingNumber: `001${key}`,
          trackingUrl: 'https://example.com/colis',
        });
        assert.ok(shipment.body.includes('"success":true'));
        assert.equal(
          await db.emailDelivery.count({
            where: { orderId: order.id, type: 'ORDER_SHIPPED' },
          }),
          0,
        );
        const shipped = await action('fulfillmentAction', {
          orderId: order.id,
          next: 'SHIPPED',
        });
        assert.ok(shipped.body.includes('"success":true'));
        await action('fulfillmentAction', {
          orderId: order.id,
          next: 'SHIPPED',
        });
        assert.equal(
          await db.emailDelivery.count({
            where: { orderId: order.id, type: 'ORDER_SHIPPED' },
          }),
          1,
        );
        const tracking = await page(customerPath, '');
        assert.ok(tracking.html.includes(`001${key}`));
        assert.ok(tracking.html.includes('Suivre mon colis'));
        for (const sort of ['paid', 'shipped']) {
          const list = await page(
            `/admin/commandes?search=001${key}&fulfillment=SHIPPED&sort=${sort}`,
          );
          assert.ok(list.html.includes(order.orderNumber));
        }
        const incompatible = await page(
          `/admin/commandes?search=${key}&fulfillment=SHIPPED&status=PAYMENT_FAILED`,
        );
        assert.ok(!incompatible.html.includes(order.orderNumber));
        const preview = await page(`/admin/emails/${confirmation.id}/preview`);
        assert.equal(preview.response.status, 200);
        assert.ok(preview.html.includes('Merci pour votre commande'));
        assert.ok(preview.html.includes('Nom snapshot HTTP'));
        assert.ok(!preview.html.includes(order.internalNote!));
        assert.ok(
          (preview.response.headers.get('cache-control') ?? '').includes(
            'no-store',
          ),
        );
        const slip = await page(`/admin/commandes/${order.id}/bon-preparation`);
        assert.ok(slip.html.includes('Bon de préparation'));
        assert.ok(slip.html.includes(variant.sku));
        assert.ok(!slip.html.includes(order.internalNote!));
        await db.emailDelivery.update({
          where: { id: confirmation.id },
          data: {
            status: 'FAILED',
            attemptCount: 1,
            firstAttemptAt: new Date(),
          },
        });
        const retry = await action('retryEmailAction', {
          emailId: confirmation.id,
        });
        assert.ok(retry.body.includes('"success":true'));
        assert.equal(
          (
            await db.emailDelivery.findUniqueOrThrow({
              where: { id: confirmation.id },
            })
          ).status,
          'PENDING',
        );
        const delivered = await action('fulfillmentAction', {
          orderId: order.id,
          next: 'DELIVERED',
        });
        assert.ok(delivered.body.includes('"success":true'));
        const final = await page(customerPath, '');
        assert.ok(final.html.includes('Livrée (confirmation manuelle)'));
      },
    );
    await t.test(
      'stock forgé refusé puis ajustement authentifié appliqué et audité',
      async () => {
        const forged = await action('adjustStockAction', {
          variantId: variant.id,
          mode: 'delta',
          quantity: '10',
          type: 'RESTOCK',
          reason: 'Test',
          reservedQuantity: '0',
        });
        assert.ok(forged.body.includes('non autorisé'));
        const result = await action('adjustStockAction', {
          variantId: variant.id,
          mode: 'delta',
          quantity: '10',
          type: 'RESTOCK',
          reason: 'Réception HTTP',
        });
        assert.ok(result.body.includes('"success":true'));
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variant.id },
            })
          ).stockQuantity,
          15,
        );
        assert.equal(
          await db.inventoryAdjustment.count({
            where: { variantId: variant.id, quantityDelta: 10 },
          }),
          1,
        );
        const noteForgery = await action('orderNoteAction', {
          id: order.id,
          status: 'PENDING_PAYMENT',
          totalAmount: '1',
          internalNote: 'forged',
        });
        assert.ok(noteForgery.body.includes('non autorisé'));
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
            .status,
          'PAID',
        );
      },
    );
    await t.test(
      'jeux HTTP : création authentifiée, slug réservé et champ forgé refusés',
      async () => {
        const denied = await action(
          'saveGameAction',
          { name: 'Jeu HTTP', slug: `http-jeu-${key}`, sortOrder: '0' },
          '',
        );
        assert.ok(
          (
            denied.response.headers.get('x-action-redirect') ?? denied.body
          ).includes('/admin/login'),
        );
        const reserved = await action('saveGameAction', {
          name: 'Jeu HTTP',
          slug: 'catalogue',
          sortOrder: '0',
          isActive: 'on',
        });
        assert.ok(reserved.body.includes('réservé à une page du site'));
        const forged = await action('saveGameAction', {
          name: 'Jeu HTTP',
          slug: `http-jeu-${key}`,
          sortOrder: '0',
          isActive: 'on',
          createdAt: '2000-01-01',
        });
        assert.ok(forged.body.includes('non autorisé'));
        const created = await action('saveGameAction', {
          name: 'Jeu HTTP',
          slug: `http-jeu-${key}`,
          sortOrder: '0',
          isActive: 'on',
          faq: 'Question HTTP ? :: Réponse HTTP.',
        });
        assert.ok(created.body.includes('"success":true'));
        const game = await db.game.findUniqueOrThrow({
          where: { slug: `http-jeu-${key}` },
        });
        assert.deepEqual(game.faq, [
          { question: 'Question HTTP ?', answer: 'Réponse HTTP.' },
        ]);
        const list = await page('/admin/jeux?search=Jeu%20HTTP');
        assert.ok(list.html.includes(`/http-jeu-${key}`));
        const edit = await page(`/admin/jeux?edit=${game.id}`);
        assert.ok(edit.html.includes('Question HTTP ? :: Réponse HTTP.'));
      },
    );
    await t.test(
      'catégories et extensions : création puis édition sans doublon',
      async () => {
        for (const [name, path, slug] of [
          ['saveCategoryAction', 'categories', `http-category-${key}`],
          ['saveSetAction', 'extensions', `http-set-${key}`],
        ] as const) {
          const fields = {
            name: 'Taxonomie HTTP',
            slug,
            ...(path === 'categories' ? { sortOrder: '0' } : {}),
            isActive: 'on',
          };
          const created = await action(name, fields);
          assert.ok(created.body.includes('"success":true'), created.body);
          const row =
            path === 'categories'
              ? await db.category.findUniqueOrThrow({ where: { slug } })
              : await db.tcgSet.findUniqueOrThrow({ where: { slug } });
          assert.ok(
            created.body.includes(`/admin/${path}?edit=${row.id}#edition`),
          );
          const updated = await action(name, {
            ...fields,
            id: row.id,
            name: 'Taxonomie HTTP modifiée',
          });
          assert.ok(updated.body.includes('"success":true'), updated.body);
          assert.ok(!updated.body.includes('"redirectTo"'));
          assert.equal(
            path === 'categories'
              ? await db.category.count({ where: { slug } })
              : await db.tcgSet.count({ where: { slug } }),
            1,
          );
          const edit = await page(`/admin/${path}?edit=${row.id}`);
          assert.ok(edit.html.includes('Taxonomie HTTP modifiée'));
        }
      },
    );
    await t.test(
      'upload HTTP, image publique réencodée, optimisation Next et suppression de galerie',
      async () => {
        const png = await sharp({
          create: { width: 32, height: 32, channels: 3, background: '#e8c261' },
        })
          .png()
          .toBuffer();
        const uploaded = await action('uploadImageAction', {
          productId: product.id,
          alt: 'Visuel HTTP',
          file: new File([new Uint8Array(png)], 'http.png', {
            type: 'image/png',
          }),
        });
        assert.ok(
          uploaded.body.includes('"success":true'),
          'Upload HTTP refusé',
        );
        const image = await db.productImage.findFirstOrThrow({
          where: { productId: product.id },
        });
        uploadedUrls.push(image.url);
        const publicImage = await fetch(`${base}${image.url}`);
        assert.equal(publicImage.status, 200);
        assert.equal(publicImage.headers.get('content-type'), 'image/webp');
        assert.equal(
          publicImage.headers.get('x-content-type-options'),
          'nosniff',
        );
        const optimized = await fetch(
          `${base}/_next/image?url=${encodeURIComponent(image.url)}&w=256&q=75`,
        );
        assert.equal(optimized.status, 200);
        const removed = await action('deleteImageAction', {
          id: image.id,
          productId: product.id,
        });
        assert.ok(removed.body.includes('"success":true'));
        assert.equal(
          (await fetch(`${base}${image.url}`)).status,
          200,
          'Le fichier historique doit être conservé',
        );
      },
    );
    await t.test(
      'révocation admin immédiate et expiration serveur',
      async () => {
        await db.adminUser.update({
          where: { id: admin.id },
          data: { isActive: false },
        });
        let result = await page('/admin');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
        );
        await db.adminUser.update({
          where: { id: admin.id },
          data: { isActive: true },
        });
        await db.adminSession.updateMany({
          where: { userId: admin.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        result = await page('/admin');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
        );
      },
    );
    await t.test(
      'déconnexion révoque la session en base et le cookie',
      async () => {
        const login = await action('loginAction', { email, password }, '');
        assert.ok(
          (login.response.headers.get('x-action-redirect') ?? '').startsWith(
            '/admin/second-facteur',
          ),
        );
        assert.ok(
          login.cookies
            .filter((value) => value.startsWith('caldera_admin.session_token='))
            .every((value) =>
              /^caldera_admin\.session_token=;.*max-age=0/i.test(value),
            ),
          'Le mot de passe seul ne doit pas laisser de cookie de session utilisable',
        );
        assert.equal(
          await db.adminSession.count({
            where: { userId: admin.id, expiresAt: { gt: new Date() } },
          }),
          0,
        );
        const challengeCookie = login.cookies
          .filter((value) => /caldera_admin\.two_factor=/.test(value))
          .map((value) => value.split(';')[0])
          .join('; ');
        assert.ok(challengeCookie);
        const verified = await action(
          'verifyAdminBackupCodeAction',
          { code: backupCode },
          challengeCookie,
        );
        cookie = sessionCookie(verified.cookies).split(';')[0]!;
        assert.notEqual(
          (
            await db.adminTwoFactor.findFirstOrThrow({
              where: { userId: admin.id },
            })
          ).backupCodes,
          encryptedBackupCodes,
        );
        const logout = await action('logoutAction', {}, cookie, origin, true);
        assert.ok(
          logout.cookies.some((value) =>
            /caldera_admin\.session_token=;/.test(value),
          ),
        );
        assert.equal(
          await db.adminSession.count({
            where: { userId: admin.id, expiresAt: { gt: new Date() } },
          }),
          0,
        );
        const result = await page('/admin');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
        );
      },
    );
    await t.test(
      'récupération avec un code de secours et remplacement du facteur',
      async () => {
        const login = await action('loginAction', { email, password }, '');
        const challengeCookie = login.cookies
          .filter((value) => /caldera_admin\.two_factor=/.test(value))
          .map((value) => value.split(';')[0])
          .join('; ');
        assert.ok(challengeCookie);
        const verified = await action(
          'verifyAdminBackupCodeAction',
          { code: replacementCode },
          challengeCookie,
        );
        const recoverySession = sessionCookie(verified.cookies).split(';')[0]!;
        const replaced = await action(
          'replaceAuthenticatorAction',
          { password },
          recoverySession,
        );
        assert.ok(
          (replaced.response.headers.get('x-action-redirect') ?? '').startsWith(
            '/admin/login',
          ),
        );
        assert.equal(
          (await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } }))
            .twoFactorEnabled,
          false,
        );
        assert.equal(
          await db.adminTwoFactor.count({ where: { userId: admin.id } }),
          0,
        );
        assert.equal(
          await db.adminSession.count({ where: { userId: admin.id } }),
          0,
        );
        const oldSession = await page('/admin', recoverySession);
        assert.ok(
          (
            oldSession.response.headers.get('location') ?? oldSession.html
          ).includes('/admin/login'),
        );
      },
    );
  } finally {
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.shipment.deleteMany({ where: { orderId: order.id } });
    await db.stockReservation.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.orderAddress.deleteMany({ where: { orderId: order.id } });
    await db.payment.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.checkoutSession.delete({ where: { id: checkout.id } });
    await db.cart.delete({ where: { id: cart.id } });
    await db.inventoryAdjustment.deleteMany({
      where: { adminUserId: admin.id },
    });
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.game.deleteMany({ where: { slug: `http-jeu-${key}` } });
    await db.category.deleteMany({ where: { slug: `http-category-${key}` } });
    await db.tcgSet.deleteMany({ where: { slug: `http-set-${key}` } });
    await db.adminUser.delete({ where: { id: admin.id } });
    for (const url of uploadedUrls) await imageStorage.delete(url);
    await db.$disconnect();
  }
});
