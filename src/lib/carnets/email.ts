import type { NewsletterCampaignContent } from '@/emails/newsletter-campaign';
import {
  deriveCarnet,
  carnetUrl,
  type CarnetContent,
  type CarnetInline,
} from './content';
import type { CarnetProduct } from './comptoir';
import {
  serializeNewsletterDocument,
  type NewsletterBlock,
} from '@/lib/newsletter/document';
export type CarnetEmailSource = {
  title: string;
  slug: string;
  content: CarnetContent;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
};
/** Shared by the live preview and production. No independent excerpt field. */
export function carnetEmailContent(
  source: CarnetEmailSource,
  products: CarnetProduct[],
  email: { subject: string; preheader?: string | null },
  href = carnetUrl(source.slug),
): NewsletterCampaignContent {
  const excerpt = deriveCarnet(source.content).excerpt;
  return {
    subject: email.subject,
    preheader: email.preheader ?? null,
    heading: source.title,
    bodyMarkdown: '',
    ctaLabel: 'Continuer l’expédition',
    ctaUrl: href,
    carnetExcerpt: {
      html:
        excerpt?.html ??
        '<p>Placez la coupure newsletter pour afficher l’extrait.</p>',
      text:
        excerpt?.text ??
        'Placez la coupure newsletter pour afficher l’extrait.',
    },
    carnetIllustration: source.illustrationUrl
      ? { src: source.illustrationUrl, alt: source.illustrationAlt ?? '' }
      : undefined,
    carnetComptoir: products,
    carnetLinks: { storyPath: carnetUrl(source.slug), products },
  };
}
function markdownInline(nodes: CarnetInline[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n';
      let text = n.text.replace(/[\\`*_{}\[\]<>#!|~]/g, '\\$&');
      for (const m of n.marks ?? [])
        text = m.type === 'bold' ? `**${text}**` : `*${text}*`;
      return text;
    })
    .join('');
}
/** One-way snapshot into the existing Studio document schema. */
export function carnetEmailSnapshot(
  source: CarnetEmailSource,
  products: CarnetProduct[],
) {
  const blocks: NewsletterBlock[] = [];
  if (source.illustrationUrl)
    blocks.push({
      id: 'carnet-image',
      type: 'image',
      src: source.illustrationUrl,
      alt: source.illustrationAlt ?? '',
      caption: '',
      href: '',
    });
  const excerpt: string[] = [];
  for (const block of source.content.document.content) {
    if (block.type === 'newsletterCut') break;
    if (block.type === 'blockquote')
      excerpt.push(
        block.content
          .map((p) => `> ${markdownInline(p.content)}`)
          .join('\n>\n'),
      );
    else
      excerpt.push(
        `${block.type === 'heading' ? '#'.repeat(block.attrs.level) + ' ' : ''}${markdownInline(block.content)}`,
      );
  }
  blocks.push(
    { id: 'carnet-excerpt', type: 'text', text: excerpt.join('\n\n') },
    {
      id: 'carnet-cta',
      type: 'button',
      label: 'Continuer l’expédition',
      href: carnetUrl(source.slug),
    },
  );
  if (products.length)
    blocks.push(
      { id: 'carnet-comptoir', type: 'heading', text: 'Le Comptoir', level: 2 },
      ...products.map((p) => ({
        id: `product-${p.id}`,
        type: 'product' as const,
        productId: p.id,
        name: p.name,
        image: p.image,
        price: p.price,
        href: p.href,
        description: '',
      })),
    );
  return serializeNewsletterDocument({ version: 1, theme: 'journal', blocks });
}
