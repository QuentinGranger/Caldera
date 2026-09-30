import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSiteNavigation, headerItems } from '../src/data/navigation';
import type { NavigationFamily } from '../src/lib/seo/links';

const family = (slug: string, name: string): NavigationFamily => ({
  slug,
  name,
  label: `${name} pour tous les jeux`,
  href: `/categorie/${slug}`,
  count: 12,
  children: [],
});

const menu = (items: ReturnType<typeof headerItems>) =>
  items.map((item) => `${item.label} ${item.href}`);

test('menu principal : aucun lien vers une page absente quand le catalogue est vide', () => {
  // Production before opening, or the database unreachable.
  const empty = buildSiteNavigation({ games: [], categoryHubs: [] }, new Set());
  assert.deepEqual(menu(headerItems(empty)), [
    'Catalogue /catalogue',
    'Collections /extensions',
    'Univers /univers',
  ]);
});

test('menu principal : jeux, familles et listes indexables seulement', () => {
  const site = buildSiteNavigation(
    {
      games: [
        {
          slug: 'pokemon',
          name: 'Pokémon',
          shortName: null,
          href: '/pokemon',
          count: 40,
          families: [
            {
              ...family('boosters', 'Boosters'),
              href: '/pokemon/boosters',
            },
          ],
        },
      ],
      // « Cartes » has too few products to be indexed: it stays out.
      categoryHubs: [
        family('scelles', 'Produits scellés'),
        family('accessoires', 'Accessoires'),
      ],
    },
    new Set(['nouveautes', 'en-stock'] as const),
  );
  const items = headerItems(site);
  assert.deepEqual(menu(items), [
    'Pokémon /pokemon',
    'Nouveautés /nouveautes',
    'Scellés /categorie/scelles',
    'Accessoires /categorie/accessoires',
    'Collections /extensions',
    'Univers /univers',
  ]);
  // The game keeps its families as a submenu.
  assert.deepEqual(
    items[0]!.children.map((link) => link.href),
    ['/pokemon', '/pokemon/boosters'],
  );
});
