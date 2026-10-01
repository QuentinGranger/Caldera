import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  DELIVERY_ZONE,
  handlingLabel,
} from '../src/components/editorial/delivery';
import {
  buildShopFaq,
  plainAnswer,
  shippingAnswer,
} from '../src/components/editorial/shopFaq';
import {
  LEGAL_IDENTITY,
  ORGANIZATION,
  RETURN_POLICY,
} from '../src/lib/seo/policies';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const cgv = read('src/app/cgv/page.tsx').replace(/\s+/g, ' ');
const faq = buildShopFaq([]);
const answers = faq.flatMap((group) => group.items.map((item) => item.answer));
const all = answers.join('\n');

/** Every source file but the FAQ's own, for the labels it quotes. */
function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) return sources(file);
    return /\.(tsx?)$/.test(name) && !file.endsWith('shopFaq.ts')
      ? [readFileSync(file, 'utf8')]
      : [];
  });
}

test('FAQ : chaque article cité existe dans les CGV, chaque phrase reprise y figure', () => {
  const cited = [...all.matchAll(/\/cgv#(article-\d+)/g)].map(([, id]) => id);
  assert.ok(cited.length > 15);
  for (const id of new Set(cited))
    assert.ok(cgv.includes(`'${id}'`), `${id} absent des CGV`);
  // What the answers restate, as the CGV word it.
  for (const phrase of [
    'ne propose pas de précommandes au lancement du service',
    'L’ajout d’un produit au panier ne constitue pas une réservation',
    'Aucun montant minimum de commande n’est imposé',
    'euros TTC',
    'article 293 B du Code général des impôts',
    'Stripe et ses partenaires de paiement',
    'carte bancaire',
    'Apple Pay',
    'Google Pay',
    'PayPal',
    'Klarna',
    'ne stocke pas directement les numéros complets de cartes bancaires',
    'Le paiement est exigible lors de la commande',
    '1 à 2 jours ouvrés après confirmation du paiement',
    'Les frais directs de retour sont à la charge du client',
    'ne signifie pas automatiquement que le droit de rétractation disparaît',
    '14 jours à compter du moment où il devient dû',
    'le même moyen de paiement',
    'Se rétracter du contrat ici',
  ])
    assert.ok(cgv.includes(phrase), `« ${phrase} » absent des CGV`);
});

test('FAQ : les libellés cités entre guillemets existent sur le site', () => {
  const code = sources(path.join(root, 'src')).join('\n');
  const labels = [...all.matchAll(/« ([^»]+) »/g)].map(
    ([, label]) => label ?? '',
  );
  assert.ok(labels.length > 8);
  for (const label of new Set(labels))
    assert.ok(code.includes(label), `libellé « ${label} » introuvable`);
});

test('FAQ : les chiffres viennent des mêmes sources que les pages', () => {
  assert.ok(all.includes(DELIVERY_ZONE));
  assert.ok(all.includes(handlingLabel()));
  assert.ok(
    all.includes(`${RETURN_POLICY.days} jours à compter de la réception`),
  );
  assert.ok(all.includes(ORGANIZATION.email));
  const { street, postalCode, locality } = LEGAL_IDENTITY.address;
  assert.ok(all.includes(`${street}, ${postalCode} ${locality}`));
});

test('FAQ : liens vers des pages qui existent, ancres uniques', () => {
  const links = [...all.matchAll(/\]\(([^)]+)\)/g)].map(
    ([, href]) => href ?? '',
  );
  for (const href of new Set(links)) {
    const [pathname = ''] = href.split('#');
    if (pathname === '/' || pathname === '') continue;
    const guide = /^\/guides\/(.+)$/.exec(pathname);
    const exists = guide
      ? existsSync(path.join(root, 'content/guides', `${guide[1]}.md`))
      : existsSync(path.join(root, 'src/app', pathname, 'page.tsx'));
    assert.ok(exists, `${href} ne mène à aucune page`);
  }
  const ids = faq.flatMap((group) => [
    group.id,
    ...group.items.map((item) => item.id),
  ]);
  assert.equal(new Set(ids).size, ids.length);
});

test('FAQ : modes de livraison actifs, ou renvoi à la commande sans eux', () => {
  assert.match(shippingAnswer([]), /indiqués pendant la commande/);
  const text = shippingAnswer([
    {
      code: 'COLISSIMO',
      name: 'Colissimo domicile',
      description: null,
      type: 'HOME_DELIVERY',
      price: '5.90',
      freeFromAmount: '100.00',
      estimatedMinDays: 2,
      estimatedMaxDays: 3,
      minDays: 2,
      maxDays: 3,
      countries: ['FR'],
      destinations: [{ code: 'FR', name: 'France' }],
    },
  ]);
  assert.match(text, /\*\*Colissimo domicile\*\* : 5,90\s€/);
  assert.match(text, /offerte dès 100,00\s€ d’achat/);
  assert.match(text, /2 à 3 jours ouvrés/);
  assert.match(text, /\[Livraison\]\(\/livraison\)/);
});

test('FAQ : réponses en texte brut pour les données structurées', () => {
  assert.equal(
    plainAnswer(
      'Voir [l’article 4](/cgv#article-4) et **Colissimo**.\n\n- Un point',
    ),
    'Voir l’article 4 et Colissimo. Un point',
  );
});
