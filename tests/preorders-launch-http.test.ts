import assert from 'node:assert/strict';
import { test } from 'node:test';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3002';
const enabled = process.env.TEST_PREORDERS_LAUNCH === '1';
const text = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '');

test(
  'HTTP lancement fermé : liens, filtre, fiches et contenu cohérents',
  { skip: !enabled },
  async () => {
    for (const [path, target] of [
      ['/precommandes', '/catalogue'],
      ['/pokemon/precommandes', '/pokemon'],
      ['/pokemon/scelles/precommandes', '/pokemon'],
    ]) {
      const response = await fetch(`${base}${path}`, { redirect: 'manual' });
      const html = await response.text();
      assert.ok(
        (response.status === 307 &&
          response.headers.get('location') === target) ||
          (response.status === 200 &&
            html.includes(`NEXT_REDIRECT;replace;${target};307;`)),
        path,
      );
    }
    const oldFilter = await fetch(`${base}/catalogue?availability=preorder`, {
      redirect: 'manual',
    });
    assert.equal(oldFilter.status, 308);
    assert.equal(oldFilter.headers.get('location'), '/catalogue');
    for (const path of [
      '/produit/dev-coffret-aurores',
      '/guides/precommander-produit-scelle',
      '/glossaire/precommande',
    ]) {
      assert.equal((await fetch(`${base}${path}`)).status, 404, path);
    }
    for (const path of [
      '/',
      '/catalogue',
      '/pokemon',
      '/questions',
      '/contact',
      '/guides',
      '/glossaire',
    ]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.doesNotMatch(text(html), /précommand|precommand/i, path);
      assert.doesNotMatch(
        html,
        /href="[^"]*(?:precommandes|precommander-produit-scelle|glossaire\/precommande)/,
        path,
      );
    }
  },
);

test(
  'HTTP lancement fermé : motif contact forgé refusé avant tout envoi',
  { skip: !enabled },
  async () => {
    const response = await fetch(`${base}/api/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({
        name: 'Test Caldera',
        email: 'qa@example.invalid',
        topic: 'precommande',
        message: 'Test local du motif désactivé.',
      }),
    });
    assert.equal(response.status, 400);
  },
);
