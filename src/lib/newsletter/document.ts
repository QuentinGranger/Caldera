import { escapeHtml, linkTarget, renderDocument } from '@/lib/content/markdown';

/** Versioned document in the existing text column; legacy Markdown stays readable.
 * No schema migration, executable HTML or provider-specific template format. */
export const DOCUMENT_PREFIX = 'CALDERA_NEWSLETTER_V1:';
export const MAX_BLOCKS = 40;
export const MAX_DOCUMENT_LENGTH = 60000;
export type NewsletterBlock =
  | { id: string; type: 'text'; text: string }
  | {
      id: string;
      type: 'image';
      src: string;
      alt: string;
      caption: string;
      href: string;
    }
  | { id: string; type: 'button'; label: string; href: string }
  | {
      id: string;
      type: 'product';
      productId: string;
      name: string;
      image: string;
      price: string;
      href: string;
      description: string;
    }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height: 16 | 32 | 48 };
export type NewsletterDocument = {
  version: 1;
  theme: 'journal' | 'minimal' | 'selection';
  blocks: NewsletterBlock[];
};
export const BLOCK_LABELS: Record<NewsletterBlock['type'], string> = {
  text: 'Texte',
  image: 'Image',
  button: 'Bouton',
  product: 'Produit',
  divider: 'Séparateur',
  spacer: 'Espacement',
};
export const THEMES = {
  journal: { label: 'Journal', background: '#fffcf5', accent: '#003c2d' },
  minimal: { label: 'Essentiel', background: '#ffffff', accent: '#173e32' },
  selection: { label: 'Collection', background: '#f5f1e7', accent: '#74551e' },
} as const;
export class NewsletterDocumentError extends Error {}
export function safeNewsletterLink(value: string): string | null {
  if (!value.trim() || value.includes('\\') || /[\u0000-\u001f]/.test(value))
    return null;
  const target = linkTarget(value);
  if (!target || !/^(?:\/(?![/\\])|https:\/\/)/.test(target.href)) return null;
  try {
    const url = new URL(target.href, 'https://lesterresdecaldera.fr');
    return url.username || url.password ? null : target.href;
  } catch {
    return null;
  }
}
export function safeNewsletterImage(value: string): string | null {
  return /^\/(?:assets\/[a-zA-Z0-9_./-]+|media\/[a-f0-9-]+\.webp)$/.test(
    value,
  ) && !value.includes('..')
    ? value
    : null;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new NewsletterDocumentError('Document de campagne invalide.');
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max)
    throw new NewsletterDocumentError(
      'Un bloc contient un texte invalide ou trop long.',
    );
  return value;
}
export function parseNewsletterDocument(
  source: string,
  forPreview = false,
): NewsletterDocument | null {
  const prefix = source.match(/^CALDERA_NEWSLETTER_V1(?::|\r?\n)/)?.[0];
  if (!prefix) return null;
  if (source.length > MAX_DOCUMENT_LENGTH)
    throw new NewsletterDocumentError('La campagne dépasse 60 000 caractères.');
  let input: unknown;
  try {
    input = JSON.parse(source.slice(prefix.length));
  } catch {
    throw new NewsletterDocumentError('Document de campagne illisible.');
  }
  const doc = object(input);
  if (
    doc.version !== 1 ||
    !['journal', 'minimal', 'selection'].includes(String(doc.theme)) ||
    !Array.isArray(doc.blocks) ||
    doc.blocks.length > MAX_BLOCKS
  )
    throw new NewsletterDocumentError(
      'Format ou nombre de blocs invalide (40 maximum).',
    );
  const ids = new Set<string>();
  const blocks = doc.blocks.map((value): NewsletterBlock => {
    const b = object(value);
    const id = string(b.id, 80);
    if (!/^[\w-]{1,80}$/.test(id) || ids.has(id))
      throw new NewsletterDocumentError(
        'Identifiant de bloc invalide ou dupliqué.',
      );
    ids.add(id);
    const link = (raw: unknown) => {
      const value = string(raw, 500);
      if (value && !safeNewsletterLink(value)) {
        if (forPreview) return '';
        throw new NewsletterDocumentError(
          'Utilisez un lien HTTPS ou une page du site.',
        );
      }
      return value;
    };
    const image = (raw: unknown) => {
      const value = string(raw, 500);
      if (value && !safeNewsletterImage(value)) {
        if (forPreview) return '';
        throw new NewsletterDocumentError(
          'Utilisez une image téléversée ou un chemin /assets/.',
        );
      }
      return value;
    };
    switch (b.type) {
      case 'text':
        return { id, type: 'text', text: string(b.text, 20000) };
      case 'image':
        return {
          id,
          type: 'image',
          src: image(b.src),
          alt: string(b.alt, 300),
          caption: string(b.caption, 500),
          href: link(b.href),
        };
      case 'button':
        return {
          id,
          type: 'button',
          label: string(b.label, 80),
          href: link(b.href),
        };
      case 'product':
        if (
          b.productId &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            String(b.productId),
          )
        )
          throw new NewsletterDocumentError('Identifiant produit invalide.');
        return {
          id,
          type: 'product',
          productId: string(b.productId, 36),
          name: string(b.name, 200),
          image: image(b.image),
          price: string(b.price, 60),
          href: link(b.href),
          description: string(b.description, 500),
        };
      case 'divider':
        return { id, type: 'divider' };
      case 'spacer':
        if ([16, 32, 48].includes(Number(b.height)))
          return {
            id,
            type: 'spacer',
            height: Number(b.height) as 16 | 32 | 48,
          };
    }
    throw new NewsletterDocumentError('Type de bloc non pris en charge.');
  });
  return {
    version: 1,
    theme: doc.theme as NewsletterDocument['theme'],
    blocks,
  };
}
export function serializeNewsletterDocument(doc: NewsletterDocument) {
  return DOCUMENT_PREFIX + JSON.stringify(doc);
}
export function documentFromLegacy(source: string): NewsletterDocument {
  return (
    parseNewsletterDocument(source) ?? {
      version: 1,
      theme: 'journal',
      blocks: source ? [{ id: 'legacy-text', type: 'text', text: source }] : [],
    }
  );
}
export function newsletterIssues(doc: NewsletterDocument): string[] {
  const issues: string[] = [];
  if (
    !doc.blocks.some(
      (b) =>
        (b.type === 'text' && b.text.trim()) ||
        (b.type === 'product' && b.name.trim()),
    )
  )
    issues.push(
      'Ajoutez un texte ou un produit pour donner du contenu à votre campagne.',
    );
  for (const [index, b] of doc.blocks.entries()) {
    const label = `Bloc ${index + 1} (${BLOCK_LABELS[b.type]})`;
    if (b.type === 'text') {
      if (!b.text.trim())
        issues.push(`${label} : renseignez le message ou supprimez ce bloc.`);
      const analysis = renderDocument(b.text);
      if (analysis.rejectedTargets.length)
        issues.push(`${label} : un lien ou une image n’est pas valide.`);
      if (analysis.rawHtml.length)
        issues.push(`${label} : le HTML brut est affiché comme du texte.`);
    }
    if (b.type === 'image' && (!safeNewsletterImage(b.src) || !b.alt.trim()))
      issues.push(`${label} : une image et un texte alternatif sont requis.`);
    if (b.type === 'button' && (!b.label.trim() || !safeNewsletterLink(b.href)))
      issues.push(`${label} : renseignez le texte et le lien du bouton.`);
    if (
      b.type === 'product' &&
      (!b.productId || !b.name.trim() || !safeNewsletterLink(b.href))
    )
      issues.push(`${label} : choisissez un produit du catalogue.`);
  }
  return issues;
}
export function renderNewsletterBlocks(
  doc: NewsletterDocument,
  markdown: (source: string) => string,
  url: (source: string) => string,
  origin: string,
) {
  const accent = THEMES[doc.theme].accent;
  const button = (label: string, href: string) =>
    safeNewsletterLink(href) && label
      ? `<p style="margin:24px 0"><a target="_blank" rel="noopener noreferrer" href="${escapeHtml(url(href))}" style="display:inline-block;padding:14px 22px;background:${accent};color:#fff;text-decoration:none;border-radius:4px;font-weight:700">${escapeHtml(label)}</a></p>`
      : '';
  const img = (src: string, alt: string) =>
    safeNewsletterImage(src)
      ? `<img src="${escapeHtml(origin + src)}" alt="${escapeHtml(alt)}" width="568" style="display:block;max-width:100%;width:100%;height:auto;border-radius:8px;margin:0 auto">`
      : '';
  return doc.blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
          return markdown(b.text);
        case 'divider':
          return '<hr style="border:0;border-top:1px solid #dcd8ca;margin:24px 0">';
        case 'spacer':
          return `<div aria-hidden="true" style="height:${b.height}px;line-height:${b.height}px">&#8203;</div>`;
        case 'button':
          return button(b.label, b.href);
        case 'image':
          return `<div style="margin:20px 0">${safeNewsletterLink(b.href) ? `<a target="_blank" rel="noopener noreferrer" href="${escapeHtml(url(b.href))}">${img(b.src, b.alt)}</a>` : img(b.src, b.alt)}${b.caption ? `<p style="font-size:13px;color:#60665d;margin:8px 0">${escapeHtml(b.caption)}</p>` : ''}</div>`;
        case 'product':
          return `<table role="presentation" width="100%" style="margin:24px 0;border:1px solid #dcd8ca"><tr><td style="padding:20px">${img(b.image, b.name)}<h2>${escapeHtml(b.name)}</h2>${b.price ? `<p style="font-size:22px;font-weight:700;color:${accent}">${escapeHtml(b.price)}</p>` : ''}${b.description ? `<p>${escapeHtml(b.description)}</p>` : ''}${button('Voir le produit', b.href)}</td></tr></table>`;
      }
    })
    .join('');
}
export function newsletterPlainText(
  doc: NewsletterDocument,
  plain: (source: string) => string,
  url: (source: string) => string,
) {
  return doc.blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
          return plain(b.text);
        case 'image':
          return [b.alt, b.caption, b.href ? url(b.href) : '']
            .filter(Boolean)
            .join('\n');
        case 'button':
          return `${b.label} : ${url(b.href)}`;
        case 'product':
          return [b.name, b.price, b.description, url(b.href)]
            .filter(Boolean)
            .join('\n');
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}
