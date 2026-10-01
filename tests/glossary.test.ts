import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { parseGlossaryDocument } from '../src/lib/content/glossaryDocument';

const source = readFileSync(
  path.join(process.cwd(), 'content', 'pages', 'glossaire-pokemon.md'),
  'utf8',
);
const fiches = new Set(
  readdirSync(path.join(process.cwd(), 'content', 'glossaire')).map(
    (file) => `/glossaire/${file.replace(/\.md$/, '')}`,
  ),
);

test('glossaire Pokémon : les 26 lettres, des ancres uniques, chaque terme défini', () => {
  const document = parseGlossaryDocument(source);
  assert.equal(document.title, 'Glossaire Pokémon TCG de A à Z');
  assert.deepEqual(
    document.letters.map((letter) => letter.text).join(''),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  );
  assert.ok(document.terms.length > 150, String(document.terms.length));
  const ids = document.terms.map((term) => term.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    document.terms.filter((term) => !term.definition).map((term) => term.text),
    [],
  );
  assert.ok(document.themes.length > 0);
  assert.ok(document.intro.length > 0);
  assert.ok(document.description.length <= 160);
});

test('glossaire Pokémon : liens vers des fiches existantes, aucun HTML brut', () => {
  const document = parseGlossaryDocument(source);
  const broken = document.links.filter(
    (href) => href.startsWith('/glossaire/') && !fiches.has(href),
  );
  assert.deepEqual(broken, []);
  assert.deepEqual(document.rejected, []);
});

test('glossaire : lettres, thèmes, introduction et signature lus du document', () => {
  const document = parseGlossaryDocument(`---
title: 'Glossaire'
description: 'Court.'
updated: 2026-10-01
signature: 'Caldera'
closing: 'Fin.'
---

Premier paragraphe.

Second paragraphe.

## A

### Ability — Talent

Effet spécial.

### Attack — Attaque

Action.

- un point

## B

### Bench — Banc

Zone.

## Les raretés

Pour commencer :

### Rare — Rare

Une étoile.
`);
  assert.deepEqual(document.intro, [
    'Premier paragraphe.',
    'Second paragraphe.',
  ]);
  assert.deepEqual(
    document.letters.map((letter) => letter.text),
    ['A', 'B'],
  );
  assert.deepEqual(
    document.themes.map((theme) => theme.text),
    ['Les raretés'],
  );
  // The A to Z only: a term repeated in a theme is not counted twice.
  assert.deepEqual(
    document.terms.map((term) => [term.text, term.definition]),
    [
      ['Ability — Talent', 'Effet spécial.'],
      ['Attack — Attaque', 'Action.'],
      ['Bench — Banc', 'Zone.'],
    ],
  );
  assert.equal(document.signature, 'Caldera');
  assert.equal(document.closing, 'Fin.');
  assert.equal(document.updated?.toISOString().slice(0, 10), '2026-10-01');
});
