import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { ProductType } from '../src/generated/prisma/enums';
import {
  getAllContent,
  getContentEntry,
  getContentForScope,
  getGlossaryTermForProductType,
  getRelatedContent,
  renderMarkdown,
  type ContentEntry,
} from '../src/lib/content';
import {
  GLOSSARY_SLUG_BY_PRODUCT_TYPE,
  buildContentLibrary,
  selectForScope,
} from '../src/lib/content/library';
import { linkTarget, renderDocument } from '../src/lib/content/markdown';
import { REMOVED_CONTENT } from '../src/lib/content/removed';
import { parseContentFile, type ContentSource } from '../src/lib/content/parse';
import { DESCRIPTION_MAX } from '../src/lib/seo/metadata';

const markdownFiles = (section: string) => {
  const dir = path.join(process.cwd(), 'content', section);
  // A section without any entry yet (actualites) has no folder.
  return existsSync(dir)
    ? readdirSync(dir).filter((file) => file.endsWith('.md'))
    : [];
};

const frontMatter = (lines: string[]) => `---\n${lines.join('\n')}\n---\n`;
const guideSource = (
  body = 'Un paragraphe d’introduction.\n',
  extra: string[] = [],
) =>
  frontMatter([
    "title: 'Un guide'",
    "description: 'Une description concrète.'",
    'kind: guide',
    'updated: 2026-09-26',
    ...extra,
  ]) + body;
const source = (
  overrides: Partial<ContentSource> & { source: string },
): ContentSource => ({ section: 'guides', slug: 'un-guide', ...overrides });

const entry = (
  slug: string,
  facets: Partial<ContentEntry> = {},
): ContentEntry => ({
  slug,
  kind: 'guide',
  title: slug,
  description: slug,
  updated: new Date('2026-09-26'),
  published: new Date('2026-09-26'),
  games: [],
  categories: [],
  sets: [],
  related: [],
  faq: [],
  href: `/guides/${slug}`,
  wordCount: 100,
  ...facets,
});

test('contenu réel : chaque fichier est valide, trié par titre et bien relié', async () => {
  const entries = await getAllContent();
  const files = ['glossaire', 'guides', 'questions', 'actualites'].reduce(
    (total, section) => total + markdownFiles(section).length,
    0,
  );
  assert.equal(entries.length, files);
  assert.ok(
    ['glossaire', 'guides', 'questions'].every(
      (section) => markdownFiles(section).length > 0,
    ),
  );
  const sectionOf = (kind: ContentEntry['kind']) =>
    kind === 'glossaire'
      ? 'glossaire'
      : kind === 'question'
        ? 'questions'
        : kind === 'actualite'
          ? 'actualites'
          : 'guides';
  const titles = entries.map((e) => e.title);
  assert.deepEqual(
    titles,
    [...titles].sort(new Intl.Collator('fr', { sensitivity: 'base' }).compare),
  );
  const slugs = new Set(entries.map((e) => e.slug));
  assert.equal(slugs.size, entries.length);
  for (const e of entries) {
    // Terms and questions open on a direct definition or answer.
    const lead = e.kind === 'glossaire' || e.kind === 'question';
    assert.equal(e.href, `/${sectionOf(e.kind)}/${e.slug}`);
    assert.ok(e.title && !/caldera\s*$/i.test(e.title), e.slug);
    assert.ok(e.description.length <= DESCRIPTION_MAX, e.slug);
    assert.ok(e.updated instanceof Date && !Number.isNaN(e.updated.getTime()));
    assert.ok(e.published.getTime() <= e.updated.getTime(), e.slug);
    assert.ok(e.wordCount > 150, `${e.slug} : ${e.wordCount} mots`);
    for (const slug of e.related) assert.ok(slugs.has(slug), slug);
    for (const item of e.faq) assert.ok(item.question && item.answer);
    if (lead) {
      assert.ok(e.definition && e.definition.length > 40, e.slug);
      assert.doesNotMatch(e.definition, /[[\]<>*_]|\]\(/);
    } else assert.equal(e.definition, undefined);
    // Listings do not carry the rendered body.
    assert.equal('html' in e, false);
  }
  // Shared by every request: a caller cannot alter the cache.
  const first = entries[0];
  assert.ok(first && Object.isFrozen(first) && Object.isFrozen(first.games));
  entries.pop();
  assert.equal((await getAllContent()).length, files);
});

test('page de contenu : HTML, sommaire, liens relatifs et section vérifiée', async () => {
  const page = await getContentEntry('guides', 'etb-display-ou-booster');
  assert.ok(page);
  assert.equal(page.kind, 'comparatif');
  assert.equal(page.updated.toISOString(), '2026-09-26T00:00:00.000Z');
  assert.deepEqual(page.games, ['pokemon']);
  assert.deepEqual(page.categories, ['etb', 'displays', 'boosters']);
  assert.equal(page.faq.length, 4);
  assert.doesNotMatch(page.html, /<h1/);
  assert.match(
    page.html,
    /<h2 id="les-trois-formats-en-bref">Les trois formats en bref<\/h2>/,
  );
  assert.match(page.html, /<h3 id="l-etb">L’ETB<\/h3>/);
  assert.match(page.html, /<a href="\/glossaire\/booster">booster<\/a>/);
  assert.doesNotMatch(page.html, /href="https?:/);
  assert.deepEqual(page.headings.slice(0, 2), [
    {
      id: 'les-trois-formats-en-bref',
      text: 'Les trois formats en bref',
      level: 2,
    },
    { id: 'le-booster', text: 'Le booster', level: 3 },
  ]);
  const ids = page.headings.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(page.html, new RegExp(`id="${id}"`));

  const term = await getContentEntry('glossaire', 'etb');
  assert.ok(term);
  assert.ok(term.definition?.startsWith('L’ETB, pour Elite Trainer Box, est'));
  assert.match(term.html, /<p>L’ETB, pour Elite Trainer Box/);
  assert.equal(
    await getContentEntry('glossaire', 'etb-display-ou-booster'),
    null,
  );
  assert.equal(await getContentEntry('guides', 'etb'), null);
  assert.equal(await getContentEntry('guides', 'inconnu'), null);
  assert.equal(await getContentEntry('guides', '../glossaire/etb'), null);
});

test('contenu par périmètre : guides d’abord, facettes exactes, multi-jeux partout', async () => {
  const etb = (
    await getContentForScope({ game: 'pokemon', category: 'etb' }, 50)
  ).map((e) => e.slug);
  assert.ok(etb.indexOf('etb-display-ou-booster') < etb.indexOf('etb'));
  // Other families (display, accessories) stay out; untagged terms fit.
  assert.ok(!etb.includes('display') && !etb.includes('proteger-ses-cartes'));
  assert.ok(etb.indexOf('etb') < etb.indexOf('jcc'));
  const boosters = await getContentForScope(
    { game: 'pokemon', category: 'boosters' },
    20,
  );
  const firstTerm = boosters.findIndex((e) => e.kind === 'glossaire');
  assert.ok(firstTerm > 0);
  assert.ok(boosters.slice(firstTerm).every((e) => e.kind === 'glossaire'));
  for (const e of boosters)
    assert.ok(!e.categories.length || e.categories.includes('boosters'));

  // A game without its own content still gets the multi-game entries.
  const other = await getContentForScope({ game: 'digimon' }, 50);
  assert.ok(other.length > 0);
  assert.ok(other.every((e) => e.games.length === 0));
  assert.ok(other.some((e) => e.slug === 'proteger-ses-cartes'));
  // A game with its own content gets it, never another game's.
  const pokemon = await getContentForScope({ game: 'pokemon' }, 50);
  assert.ok(
    pokemon.some((e) => e.slug === 'debuter-collection-cartes-pokemon'),
  );
  assert.ok(
    pokemon.every((e) => !e.games.length || e.games.includes('pokemon')),
  );
  // A withdrawn page never shadows a live one.
  for (const removed of REMOVED_CONTENT)
    assert.ok(
      (await getAllContent()).every((e) => e.href !== removed),
      removed,
    );
  // Caldera sells Pokémon only: no entry is about another game.
  assert.ok(
    (await getAllContent()).every(
      (e) => !e.games.length || e.games.every((game) => game === 'pokemon'),
    ),
  );

  // Within a section, entries of the game come before multi-game ones.
  const guides = (await getContentForScope({ game: 'pokemon' }, 50)).filter(
    (e) => ['guide', 'comparatif', 'dossier'].includes(e.kind),
  );
  const firstGeneric = guides.findIndex((e) => !e.games.length);
  assert.ok(firstGeneric > 0);
  assert.ok(guides.slice(firstGeneric).every((e) => !e.games.length));
  assert.equal((await getContentForScope({ game: 'pokemon' }, 3)).length, 3);
  assert.deepEqual(await getContentForScope({ game: 'pokemon' }, 0), []);

  // Sets: an entry about another set never shows up.
  const fixtures = [
    entry('guide-general', { games: ['pokemon'] }),
    entry('guide-braise', { games: ['pokemon'], sets: ['terres-de-braise'] }),
    entry('guide-vallees', { games: ['pokemon'], sets: ['vallees'] }),
    entry('terme-braise', {
      kind: 'glossaire',
      href: '/glossaire/terme-braise',
      sets: ['terres-de-braise'],
    }),
    entry('guide-jeu-test', { games: ['jeu-test'] }),
  ];
  assert.deepEqual(
    selectForScope(
      fixtures,
      { game: 'pokemon', set: 'terres-de-braise' },
      10,
    ).map((e) => e.slug),
    ['guide-braise', 'guide-general', 'terme-braise'],
  );
});

test('type de produit → terme du glossaire', async () => {
  for (const type of Object.values(ProductType)) {
    const term = await getGlossaryTermForProductType(type);
    const slug = GLOSSARY_SLUG_BY_PRODUCT_TYPE[type];
    if (!slug) assert.equal(term, null, type);
    else {
      assert.ok(term, type);
      assert.equal(term.slug, slug);
      assert.equal(term.kind, 'glossaire');
      assert.equal(term.href, `/glossaire/${slug}`);
    }
  }
  assert.equal(
    (await getGlossaryTermForProductType('COLLECTION_BOX'))?.slug,
    'coffret',
  );
  assert.equal(await getGlossaryTermForProductType('ACCESSORY'), null);
});

test('contenus liés : related explicites puis même cluster, sans doublon', async () => {
  const etb = (await getAllContent()).find((e) => e.slug === 'etb');
  assert.ok(etb);
  const related = await getRelatedContent(etb, 10);
  assert.deepEqual(
    related.slice(0, etb.related.length).map((e) => e.slug),
    etb.related,
  );
  const slugs = related.map((e) => e.slug);
  assert.ok(slugs.includes('etb-display-ou-booster'));
  assert.ok(!slugs.includes('etb'));
  assert.equal(new Set(slugs).size, slugs.length);
  for (const e of related.slice(etb.related.length))
    assert.ok(e.categories.some((c) => etb.categories.includes(c)));
  assert.equal((await getRelatedContent(etb, 2)).length, 2);
});

test('renderMarkdown : HTML brut échappé, jamais de h1, liens sûrs', () => {
  const html = renderMarkdown(
    [
      '# Titre',
      '',
      '## Partie',
      '',
      '<script>alert(1)</script>',
      '',
      'Texte <img src=x onerror=alert(1)> et <b>gras</b> &amp; « guillemets ».',
      '',
      '[interne](/catalogue) [absolu](https://lesterresdecaldera.fr/guides/x?y=1#z) [externe](https://example.com/a?b=1&c=2 "Exemple") [mail](mailto:contact@example.com)',
      '',
      '[a](javascript:alert(1)) [b](JAVASCRIPT:alert(1)) [c](&#106;avascript:alert(1)) [d](java&#x09;script:alert(1)) <javascript:alert(1)> [e](data:text/html;base64,PHNjcmlwdD4=) [f](vbscript:x)',
      '',
      '![locale](/media/visuel.png) ![externe](https://example.com/x.png) ![data](data:image/png;base64,AAAA) ![js](javascript:alert(1))',
    ].join('\n'),
  );
  assert.doesNotMatch(html, /<h1/);
  assert.match(html, /<h2>Titre<\/h2>\n<h3>Partie<\/h3>/);
  assert.match(html, /<p>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/p>/);
  assert.doesNotMatch(html, /<script|<img src="x"|<b>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&amp; « guillemets »/);
  assert.match(html, /<a href="\/catalogue">interne<\/a>/);
  assert.match(html, /<a href="\/guides\/x\?y=1#z">absolu<\/a>/);
  assert.match(
    html,
    /<a href="https:\/\/example\.com\/a\?b=1&amp;c=2" title="Exemple" rel="noopener noreferrer">externe<\/a>/,
  );
  assert.match(html, /<a href="mailto:contact@example\.com">mail<\/a>/);
  // Neutralized links keep their text, never their target.
  assert.match(html, /<p>a b c d javascript:alert\(1\) e f<\/p>/);
  assert.doesNotMatch(html, /href="(?:javascript|vbscript|data):/i);
  assert.doesNotMatch(html, /src="(?:javascript|data):/i);
  assert.match(
    html,
    /<img src="\/media\/visuel\.png" alt="locale" loading="lazy" decoding="async">/,
  );
  // Only same-origin images: the others keep their alt text.
  assert.doesNotMatch(html, /src="https:/);
  assert.match(html, /externe data js<\/p>/);

  // The highest heading takes the requested level, the others follow.
  assert.equal(renderMarkdown('### A\n\n#### B'), '<h2>A</h2>\n<h3>B</h3>\n');
  assert.equal(
    renderMarkdown('# A\n\n## B', { headingLevel: 3 }),
    '<h3>A</h3>\n<h4>B</h4>\n',
  );
  assert.equal(
    renderMarkdown('# A\n\n#### B\n\n###### C').includes('<h6>C'),
    true,
  );
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown('   \n'), '');
  assert.equal(renderMarkdown(null), '');
});

test('cibles de liens : protocoles et hôtes', () => {
  assert.equal(linkTarget('javascript:alert(1)'), null);
  assert.equal(linkTarget(' \tjava\nscript:alert(1)'), null);
  assert.equal(linkTarget('&#x6A;avascript:alert(1)'), null);
  assert.equal(linkTarget('data:text/html,x'), null);
  assert.deepEqual(linkTarget('/glossaire/etb#contenu'), {
    href: '/glossaire/etb#contenu',
    external: false,
  });
  assert.deepEqual(linkTarget('https://www.lesterresdecaldera.fr/cgv'), {
    href: '/cgv',
    external: false,
  });
  assert.deepEqual(linkTarget('//example.com/x'), {
    href: 'https://example.com/x',
    external: true,
  });
  // Backslashes count as slashes in URLs: this is another host.
  assert.equal(linkTarget('/\\example.com')?.external, true);
  // A site path never turns into a protocol-relative link.
  assert.equal(
    linkTarget('https://lesterresdecaldera.fr//example.com')?.href,
    '/example.com',
  );
  assert.equal(linkTarget('https:.//example.com')?.href, '/example.com');
});

test('validation du front-matter : erreur explicite par fichier', () => {
  const valid = parseContentFile(
    source({ source: guideSource('## Partie\n\nTexte.\n') }),
  );
  assert.equal(valid.page.href, '/guides/un-guide');
  assert.deepEqual(valid.page.games, []);
  assert.deepEqual(valid.page.faq, []);

  const rejects = (input: ContentSource, message: RegExp) =>
    assert.throws(
      () => parseContentFile(input),
      (error: unknown) =>
        error instanceof Error &&
        error.name === 'ContentError' &&
        error.message.startsWith(
          `content/${input.section}/${input.slug}.md : `,
        ) &&
        message.test(error.message),
    );
  rejects(source({ source: 'Pas de front-matter.' }), /front-matter manquant/);
  rejects(source({ source: '---\ntitle: [x\n---\nx' }), /YAML invalide/);
  // A ---js front-matter would be evaluated by gray-matter.
  (globalThis as { contentEval?: boolean }).contentEval = false;
  rejects(
    source({
      source: '---js\n{ title: (globalThis.contentEval = true) }\n---\nx',
    }),
    /seul le front-matter YAML/,
  );
  assert.equal((globalThis as { contentEval?: boolean }).contentEval, false);
  rejects(
    source({ source: guideSource(undefined, ['categorie: [etb]']) }),
    /champs inconnus : categorie/,
  );
  rejects(
    source({ source: guideSource().replace("title: 'Un guide'", "title: ''") }),
    /« title » manquant/,
  );
  rejects(
    source({
      source: guideSource().replace("'Un guide'", "'Un guide | Caldera'"),
    }),
    /marque/,
  );
  rejects(
    source({
      source: guideSource().replace(
        'Une description concrète.',
        'x'.repeat(DESCRIPTION_MAX + 1),
      ),
    }),
    /trop longue/,
  );
  rejects(
    source({ section: 'glossaire', source: guideSource() }),
    /« kind » doit valoir glossaire/,
  );
  rejects(
    source({
      source: guideSource().replace('updated: 2026-09-26', 'updated: hier'),
    }),
    /« updated »/,
  );
  rejects(
    source({ source: guideSource(undefined, ['games: pokemon']) }),
    /« games » doit être une liste/,
  );
  rejects(
    source({ source: guideSource(undefined, ['related: [un-guide]']) }),
    /lui-même/,
  );
  rejects(
    source({
      source: guideSource(undefined, ['faq:', "  - question: 'Q ?'"]),
    }),
    /« faq » n°1/,
  );
  rejects(source({ source: guideSource('# Titre\n\nTexte.') }), /niveau 1/);
  rejects(
    source({ source: guideSource('Texte <span>brut</span>.') }),
    /HTML brut/,
  );
  rejects(
    source({ source: guideSource('[x](javascript:alert(1))') }),
    /refusés : javascript:alert\(1\)/,
  );
  rejects(source({ source: guideSource('   ') }), /contenu vide/);
  rejects(
    source({
      section: 'glossaire',
      slug: 'terme',
      source: guideSource('## Partie\n\nTexte.').replace(
        'kind: guide',
        'kind: glossaire',
      ),
    }),
    /commence par un paragraphe/,
  );
  rejects(
    source({ slug: 'Mauvais_Nom', source: guideSource() }),
    /nom de fichier/,
  );
});

test('bibliothèque : related, liens internes et slugs vérifiés entre fichiers', () => {
  const parse = (slug: string, body: string, extra: string[] = []) =>
    parseContentFile(
      source({
        slug,
        source: guideSource(body, extra).replace('Un guide', slug),
      }),
    );
  const library = buildContentLibrary([
    parse('b-guide', 'Voir [a](/guides/a-guide#partie).', [
      'related: [a-guide]',
    ]),
    parse('a-guide', 'Texte.'),
  ]);
  assert.deepEqual(
    library.entries.map((e) => e.slug),
    ['a-guide', 'b-guide'],
  );
  assert.equal(library.pages.get('/guides/b-guide')?.related[0], 'a-guide');

  assert.throws(
    () =>
      buildContentLibrary([parse('a-guide', 'Texte.', ['related: [absent]'])]),
    /content\/guides\/a-guide\.md : « related » : absent n’existe pas/,
  );
  assert.throws(
    () =>
      buildContentLibrary([
        parse('a-guide', 'Voir [b](/glossaire/b-guide).'),
        parse('b-guide', 'Texte.'),
      ]),
    /lien cassé : \/glossaire\/b-guide/,
  );
  const term = parseContentFile({
    section: 'glossaire',
    slug: 'a-guide',
    source: guideSource('Définition.').replace(
      'kind: guide',
      'kind: glossaire',
    ),
  });
  assert.throws(
    () => buildContentLibrary([parse('a-guide', 'Texte.'), term]),
    /Slug « a-guide » utilisé deux fois/,
  );
});

test('document : mots, première phrase et identifiants de titres uniques', () => {
  const document = renderDocument(
    'Premier **paragraphe** avec [un lien](/x) et `code`.\n\n## Même titre\n\n## Même titre\n\n### Détail : « ETB »\n\n- un\n- deux\n',
  );
  assert.equal(document.lead, 'Premier paragraphe avec un lien et code.');
  assert.deepEqual(
    document.headings.map((h) => h.id),
    ['meme-titre', 'meme-titre-2', 'detail-etb'],
  );
  assert.equal(document.wordCount, 15);
  assert.deepEqual(document.links, ['/x']);
});
