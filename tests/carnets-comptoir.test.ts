import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseComptoirSelection,
  addComptoirProduct,
  replaceComptoirProduct,
  reorderComptoirProduct,
} from '../src/lib/carnets/comptoir-selection';
const ids = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
test('Comptoir : vide autorisé, trois références maximum et identifiants valides', () => {
  assert.deepEqual(parseComptoirSelection('[]'), []);
  assert.deepEqual(
    parseComptoirSelection(JSON.stringify(ids.slice(0, 3))),
    ids.slice(0, 3),
  );
  assert.throws(() => parseComptoirSelection(ids), /trois/);
  assert.throws(() => parseComptoirSelection(['invalid']), /Identifiant/);
  assert.throws(() => parseComptoirSelection('{}'), /trois/);
  assert.throws(() => parseComptoirSelection('bad'), /invalide/);
});
test('Comptoir : quatrième ajout et doublons refusés côté client et serveur', () => {
  assert.throws(() => addComptoirProduct(ids.slice(0, 3), ids[3]!), /trois/);
  assert.throws(
    () => addComptoirProduct(ids.slice(0, 1), ids[0]!),
    /qu’une fois/,
  );
  const id = 'abcd0000-0000-4000-8000-000000000001';
  assert.throws(
    () => parseComptoirSelection([id, id.toUpperCase()]),
    /qu’une fois/,
  );
});
test('Comptoir : remplacement à trois produits sans supprimer ni déplacer les deux autres', () => {
  const before = ids.slice(0, 3);
  assert.deepEqual(replaceComptoirProduct(before, ids[1]!, ids[3]!), [
    ids[0],
    ids[3],
    ids[2],
  ]);
  assert.deepEqual(before, ids.slice(0, 3));
  assert.throws(
    () => replaceComptoirProduct(before, ids[0]!, ids[2]!),
    /qu’une fois/,
  );
  assert.throws(
    () => replaceComptoirProduct(before, ids[3]!, ids[0]!),
    /plus sélectionné/,
  );
});
test('Comptoir : Monter, Descendre et dépôt utilisent un ordre stable sans mutation', () => {
  const before = ids.slice(0, 3);
  assert.deepEqual(reorderComptoirProduct(before, ids[2]!, ids[0]!), [
    ids[2],
    ids[0],
    ids[1],
  ]);
  assert.deepEqual(reorderComptoirProduct(before, ids[0]!, ids[2]!), [
    ids[1],
    ids[2],
    ids[0],
  ]);
  assert.deepEqual(reorderComptoirProduct(before, ids[0]!, ids[0]!), before);
  assert.throws(
    () => reorderComptoirProduct(before, ids[3]!, ids[0]!),
    /invalide/,
  );
  assert.deepEqual(before, ids.slice(0, 3));
});
