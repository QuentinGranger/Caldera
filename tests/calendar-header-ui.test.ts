import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const text = (path: string) => readFile(path, 'utf8');

test('calendrier : le header utilise le PageHero et des KPI compacts', async () => {
  const [page, yearly, hero] = await Promise.all([
    text('src/app/calendrier-des-sorties/page.tsx'),
    text('src/app/calendrier-des-sorties/[annee]/page.tsx'),
    text('src/components/catalog/PageHero.tsx'),
  ]);

  for (const content of [page, yearly]) {
    assert.match(content, /PageHero/);
    assert.match(content, /HeroStats/);
    assert.match(content, /VIEWS\.road/);
    assert.doesNotMatch(content, /CatalogHeader/);
    assert.doesNotMatch(content, /LandingFacts/);
  }

  assert.match(page, /title="Calendrier des sorties"/);
  assert.match(page, /label: 'Sorties à venir'/);
  assert.match(page, /label: 'Ce mois-ci'/);
  assert.match(page, /label: 'Jeux suivis'/);
  assert.match(page, /getUTCFullYear/);
  assert.match(page, /getUTCMonth/);

  assert.match(yearly, /label: `Sorties \$\{calendar\.year\}`/);
  assert.match(yearly, /label: 'À venir'/);
  assert.match(yearly, /label: 'Déjà sorties'/);

  assert.match(hero, /export function HeroStats/);
  assert.match(hero, /className=\{styles\.stats\}/);
});

test('calendrier : le skeleton réserve le Hero et ses trois KPI', async () => {
  const [component, styles] = await Promise.all([
    text('src/components/loading/LoadingSkeleton.tsx'),
    text('src/components/loading/LoadingSkeleton.module.scss'),
  ]);

  assert.match(component, /<HeroSkeleton action=\{false\} stats \/>/);
  assert.match(component, /className=\{styles\.heroStats\}/);
  assert.match(component, /Array\.from\(\{ length: 3 \}/);
  assert.match(styles, /\.heroStats/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3/);
});
