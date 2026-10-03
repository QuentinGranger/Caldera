import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const text = (path: string) => readFile(path, 'utf8');

test('états de chargement : les routes marchandes ont un fallback dédié', async () => {
  const routes = [
    'src/app/catalogue/loading.tsx',
    'src/app/en-stock/loading.tsx',
    'src/app/nouveautes/loading.tsx',
    'src/app/precommandes/loading.tsx',
    'src/app/[game]/loading.tsx',
    'src/app/categorie/[slug]/loading.tsx',
    'src/app/extensions/loading.tsx',
    'src/app/calendrier-des-sorties/loading.tsx',
    'src/app/produit/[slug]/loading.tsx',
    'src/app/favoris/loading.tsx',
    'src/app/checkout/loading.tsx',
  ];

  const contents = await Promise.all(routes.map(text));
  for (const [index, content] of contents.entries()) {
    assert.match(content, /Skeleton/, routes[index]);
  }
});

test('skeletons : état occupé, réduction de mouvement et géométrie produit', async () => {
  const [component, styles] = await Promise.all([
    text('src/components/loading/LoadingSkeleton.tsx'),
    text('src/components/loading/LoadingSkeleton.module.scss'),
  ]);

  assert.match(component, /aria-busy="true"/);
  assert.match(component, /ProductCardSkeleton/);
  assert.match(component, /CheckoutPageSkeleton/);
  assert.match(component, /CalendarPageSkeleton/);
  assert.match(styles, /aspect-ratio:\s*0\.95/);
  assert.match(styles, /aspect-ratio:\s*1;/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test('erreurs globales : reset Next.js et chemins de sortie utiles', async () => {
  const [routeError, globalError, checkoutError, adminError] =
    await Promise.all([
      text('src/app/error.tsx'),
      text('src/app/global-error.tsx'),
      text('src/app/checkout/error.tsx'),
      text('src/app/admin/error.tsx'),
    ]);

  for (const content of [routeError, globalError]) {
    assert.match(content, /reset:\s*\(\) => void/);
    assert.match(content, /Voir tous les produits/);
    assert.match(content, /\/catalogue/);
    assert.match(content, /Retour à l’accueil/);
    assert.doesNotMatch(content, /stack|digest\}/i);
  }

  assert.match(checkoutError, /onClick=\{reset\}/);
  assert.match(adminError, /onClick=\{reset\}/);
});
