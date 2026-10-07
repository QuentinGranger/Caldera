import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseFaqDrafts,
  serializeFaqDrafts,
} from '../src/lib/admin/faq-editor';
import { parseFaq } from '../src/lib/admin/seo';

test('l’éditeur conserve les FAQ administrées et leur ordre au format du serveur', () => {
  const initial =
    'Quels produits Pokémon ? :: Des boosters et des coffrets.\nComment choisir ? :: Consultez les extensions.';
  const [first, second] = parseFaqDrafts(initial);
  assert.ok(first && second);
  const submitted = serializeFaqDrafts([
    {
      ...second,
      answer: 'Consultez les extensions.\nPuis comparez les produits.',
    },
    first,
  ]);

  assert.deepEqual(parseFaq(submitted), [
    {
      question: 'Comment choisir ?',
      answer: 'Consultez les extensions. Puis comparez les produits.',
    },
    {
      question: 'Quels produits Pokémon ?',
      answer: 'Des boosters et des coffrets.',
    },
  ]);
});

test('le retrait de toutes les questions produit une FAQ vide pour l’admin', () => {
  assert.deepEqual(parseFaq(serializeFaqDrafts([])), []);
});
