import { escapeHtml } from '@/lib/content/markdown';
import { createSlug } from '@/lib/catalog/createSlug';

export const CARNET_CONTENT_LIMIT = 100000;
export const CARNET_BLOCK_LIMIT = 500;
export const CARNET_CTA_LABEL = 'Continuer l’expédition';
export const CARNET_STATUSES = [
  'DRAFT',
  'READY',
  'EARLY_ACCESS',
  'PUBLIC',
  'ARCHIVED',
] as const;
export const CARNET_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  READY: 'Prêt éditorialement',
  EARLY_ACCESS: 'Accès anticipé',
  PUBLIC: 'Public',
  ARCHIVED: 'Archivé',
} as const;
export type CarnetMark = { type: 'bold' | 'italic' };
export type CarnetInline =
  { type: 'text'; text: string; marks?: CarnetMark[] } | { type: 'hardBreak' };
export type CarnetParagraph = { type: 'paragraph'; content?: CarnetInline[] };
export type CarnetNarrativeBlock =
  | CarnetParagraph
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: CarnetInline[] }
  | { type: 'blockquote'; content: CarnetParagraph[] };
export type CarnetBlock = CarnetNarrativeBlock | { type: 'newsletterCut' };
export type CarnetContent = {
  version: 1;
  document: { type: 'doc'; content: CarnetBlock[] };
};
export class CarnetContentError extends Error {}
export function emptyCarnetContent(): CarnetContent {
  return {
    version: 1,
    document: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CarnetContentError('Contenu du Carnet invalide.');
  return value as Record<string, unknown>;
}
/** Only the narrative schema is accepted. No HTML, images, CSS, embeds or recursive containers. */
export function parseCarnetContent(input: unknown): CarnetContent {
  let raw: unknown = input;
  if (typeof input === 'string') {
    if (input.length > CARNET_CONTENT_LIMIT)
      throw new CarnetContentError(
        'Le chapitre dépasse 100 000 caractères de contenu structuré.',
      );
    try {
      raw = JSON.parse(input);
    } catch {
      throw new CarnetContentError('Le contenu du Carnet est illisible.');
    }
  }
  if (JSON.stringify(raw)?.length > CARNET_CONTENT_LIMIT)
    throw new CarnetContentError(
      'Le chapitre dépasse 100 000 caractères de contenu structuré.',
    );
  const root = object(raw),
    doc = object(root.document);
  if (
    root.version !== 1 ||
    doc.type !== 'doc' ||
    !Array.isArray(doc.content) ||
    doc.content.length > CARNET_BLOCK_LIMIT
  )
    throw new CarnetContentError(
      'Format de chapitre invalide (500 blocs maximum).',
    );
  let inlineCount = 0,
    cuts = 0;
  function inlines(value: unknown): CarnetInline[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value))
      throw new CarnetContentError('Paragraphe invalide.');
    return value.map((v) => {
      if (++inlineCount > 10000)
        throw new CarnetContentError(
          'Le chapitre contient trop de fragments de texte.',
        );
      const n = object(v);
      if (n.type === 'hardBreak') return { type: 'hardBreak' };
      if (n.type !== 'text' || typeof n.text !== 'string' || !n.text.length)
        throw new CarnetContentError('Fragment de texte invalide.');
      const result: Extract<CarnetInline, { type: 'text' }> = {
        type: 'text',
        text: n.text,
      };
      if (n.marks !== undefined) {
        if (!Array.isArray(n.marks) || n.marks.length > 2)
          throw new CarnetContentError('Mise en forme invalide.');
        const seen = new Set<string>();
        result.marks = n.marks.map((v) => {
          const mark = object(v);
          if (
            !['bold', 'italic'].includes(String(mark.type)) ||
            seen.has(String(mark.type))
          )
            throw new CarnetContentError(
              'Seuls le gras et l’italique sont autorisés dans le récit.',
            );
          seen.add(String(mark.type));
          return { type: mark.type as 'bold' | 'italic' };
        });
      }
      return result;
    });
  }
  function paragraph(n: Record<string, unknown>): CarnetParagraph {
    if (n.type !== 'paragraph')
      throw new CarnetContentError(
        'Une citation ne peut contenir que des paragraphes.',
      );
    const content = inlines(n.content);
    return { type: 'paragraph', ...(content?.length ? { content } : {}) };
  }
  const content = doc.content.map((v): CarnetBlock => {
    const n = object(v);
    if (n.type === 'newsletterCut') {
      if (++cuts > 1)
        throw new CarnetContentError(
          'Une seule coupure newsletter est autorisée.',
        );
      return { type: 'newsletterCut' };
    }
    if (n.type === 'paragraph') return paragraph(n);
    if (n.type === 'heading') {
      const attrs = object(n.attrs);
      if (attrs.level !== 2 && attrs.level !== 3)
        throw new CarnetContentError(
          'Les titres doivent être de niveau 2 ou 3.',
        );
      const content = inlines(n.content);
      return {
        type: 'heading',
        attrs: { level: attrs.level },
        ...(content?.length ? { content } : {}),
      };
    }
    if (n.type === 'blockquote') {
      if (
        !Array.isArray(n.content) ||
        !n.content.length ||
        n.content.length > CARNET_BLOCK_LIMIT
      )
        throw new CarnetContentError('Citation invalide.');
      return {
        type: 'blockquote',
        content: n.content.map((v) => paragraph(object(v))),
      };
    }
    throw new CarnetContentError('Bloc non autorisé dans un Carnet.');
  });
  return { version: 1, document: { type: 'doc', content } };
}
function inlineText(nodes: CarnetInline[] = []) {
  return nodes.map((n) => (n.type === 'hardBreak' ? '\n' : n.text)).join('');
}
export function carnetBlockText(block: CarnetNarrativeBlock): string {
  return block.type === 'blockquote'
    ? block.content.map((p) => inlineText(p.content)).join('\n\n')
    : inlineText(block.content);
}
function inlineHtml(nodes: CarnetInline[] = []) {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '<br>';
      let html = escapeHtml(n.text);
      for (const mark of n.marks ?? [])
        html =
          mark.type === 'bold'
            ? `<strong>${html}</strong>`
            : `<em>${html}</em>`;
      return html;
    })
    .join('');
}
export function renderCarnetBlocks(
  blocks: readonly CarnetNarrativeBlock[],
): string {
  return blocks
    .map((b) => {
      if (b.type === 'blockquote')
        return `<blockquote>${renderCarnetBlocks(b.content)}</blockquote>`;
      if (b.type === 'heading')
        return `<h${b.attrs.level}>${inlineHtml(b.content)}</h${b.attrs.level}>`;
      return `<p>${inlineHtml(b.content)}</p>`;
    })
    .join('\n');
}
/** Matches the existing editorial counter: punctuation-only tokens are excluded. */
export function carnetWordCount(text: string) {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
export function deriveCarnet(content: CarnetContent) {
  const cutIndex = content.document.content.findIndex(
    (b) => b.type === 'newsletterCut',
  );
  const narrative = (blocks: readonly CarnetBlock[]) =>
    blocks.filter((b): b is CarnetNarrativeBlock => b.type !== 'newsletterCut');
  const render = (blocks: CarnetNarrativeBlock[]) => {
    const text = blocks.map(carnetBlockText).join('\n\n');
    return {
      text,
      html: renderCarnetBlocks(blocks),
      words: carnetWordCount(text),
    };
  };
  const full = render(narrative(content.document.content));
  const excerpt =
    cutIndex < 0
      ? null
      : render(narrative(content.document.content.slice(0, cutIndex)));
  return { full, excerpt, cutIndex };
}
/** Moves a structural node among whole blocks; no character offset is stored. */
export function moveCarnetCut(
  content: CarnetContent,
  after: number,
): CarnetContent {
  const blocks: CarnetBlock[] = content.document.content.filter(
    (b) => b.type !== 'newsletterCut',
  );
  if (!Number.isInteger(after) || after < 0 || after >= blocks.length)
    throw new CarnetContentError(
      'Choisissez un paragraphe pour placer la coupure.',
    );
  blocks.splice(after + 1, 0, { type: 'newsletterCut' });
  return parseCarnetContent({
    version: 1,
    document: { type: 'doc', content: blocks },
  });
}
export function removeCarnetCut(content: CarnetContent): CarnetContent {
  return {
    version: 1,
    document: {
      type: 'doc',
      content: content.document.content.filter(
        (b) => b.type !== 'newsletterCut',
      ),
    },
  };
}
export function suggestCarnetSlug(number: number, title: string) {
  return title.trim() && Number.isInteger(number) && number > 0
    ? `${String(number).padStart(3, '0')}-${createSlug(title)}`
    : '';
}
export function carnetUrl(slug: string) {
  return `/univers/carnets/${encodeURIComponent(slug)}`;
}
export function carnetCta(slug: string) {
  return { label: CARNET_CTA_LABEL, href: carnetUrl(slug) };
}
export function carnetEditorialWarnings(content: CarnetContent) {
  const { full, excerpt } = deriveCarnet(content);
  const warnings: string[] = [];
  if (!excerpt)
    warnings.push(
      'Ajoutez une coupure newsletter : aucun extrait ne sera dérivé tant qu’elle manque.',
    );
  else if (excerpt.words < 250 || excerpt.words > 400)
    warnings.push(
      `L’extrait contient ${excerpt.words} mots. Longueur recommandée : 250 à 400 mots.`,
    );
  if (full.words < 900 || full.words > 1100)
    warnings.push(
      `Le chapitre contient ${full.words} mots. Longueur recommandée : 900 à 1 100 mots.`,
    );
  if (excerpt && full.words <= excerpt.words)
    warnings.push('Ajoutez la suite du chapitre après la coupure.');
  return warnings;
}
