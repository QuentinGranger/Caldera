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
  assert.deepEqual(menu(headerItems(empty)), ['Univers /univers']);
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
    { questions: true, news: false, extensions: true, calendar: true },
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

test('menus : les autres jeux du catalogue restent hors des menus', () => {
  const game = (slug: string, name: string) => ({
    slug,
    name,
    shortName: null,
    href: `/${slug}`,
    count: 10,
    families: [],
  });
  const site = buildSiteNavigation(
    {
      games: [game('pokemon', 'Pokémon'), game('jeu-test', 'Jeu Test')],
      categoryHubs: [],
    },
    new Set(),
  );
  assert.deepEqual(
    site.games.map((item) => item.href),
    ['/pokemon'],
  );
});

test('menus : une famille couverte par Pokémon passe par son menu, pas par la page multi-jeux', () => {
  const site = buildSiteNavigation(
    {
      games: [
        {
          slug: 'pokemon',
          name: 'Pokémon',
          shortName: null,
          href: '/pokemon',
          count: 20,
          families: [
            {
              ...family('scelles', 'Produits scellés'),
              href: '/pokemon/scelles',
              children: [
                {
                  ...family('boosters', 'Boosters'),
                  href: '/pokemon/boosters',
                },
              ],
            },
          ],
        },
      ],
      categoryHubs: [
        family('scelles', 'Produits scellés'),
        family('accessoires', 'Accessoires'),
      ],
    },
    new Set(),
  );
  assert.deepEqual(site.productTypes, [
    { href: '/categorie/accessoires', label: 'Accessoires' },
  ]);
  // The shop's root families: Pokémon's page first, the multi-game page
  // only for licence-free products.
  assert.deepEqual(site.families, [
    { href: '/pokemon/scelles', label: 'Produits scellés' },
    { href: '/categorie/accessoires', label: 'Accessoires' },
  ]);
  // Short names for the menus that already name the game.
  assert.deepEqual(
    site.games[0]!.children.map((link) => link.shortLabel ?? link.label),
    ['Tout Pokémon', 'Produits scellés', 'Boosters'],
  );
});
