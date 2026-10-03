import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const text = (path: string) => readFile(path, 'utf8');

test('états de chargement : les routes marchandes ont une boundary contextuelle', async () => {
  const streamedRoutes = [
    'src/app/extensions/page.tsx',
    'src/app/calendrier-des-sorties/page.tsx',
    'src/app/produit/[slug]/page.tsx',
    'src/app/favoris/page.tsx',
    'src/app/checkout/page.tsx',
  ];

  const contents = await Promise.all(streamedRoutes.map(text));
  for (const [index, content] of contents.entries()) {
    assert.match(content, /Suspense/, streamedRoutes[index]);
    assert.match(content, /Skeleton/, streamedRoutes[index]);
  }

  // Catalog pages keep their strict SSR order for SEO/HTTP invariants. Their
  // existing transition state swaps the live grid for matching card skeletons.
  const catalog = await text('src/components/catalog/CatalogPage.tsx');
  const catalogStyles = await text('src/components/catalog/Catalog.module.scss');
  assert.match(catalog, /CatalogGridSkeleton/);
  assert.match(catalogStyles, /pendingGridSkeleton/);
  assert.match(catalogStyles, /aria-busy/);
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
