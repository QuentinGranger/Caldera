/** Public Discord publications only. Customer and order data have no place here. */
export type DiscordPublicationKind =
  'release' | 'restock' | 'announcement' | 'campaign';

export type DiscordPublication = {
  kind: DiscordPublicationKind;
  title: string;
  summary: string;
  path: string;
};

const labels: Record<DiscordPublicationKind, string> = {
  release: 'Nouvelle sortie',
  restock: 'Retour en stock',
  announcement: 'Annonce Caldera',
  campaign: 'Actualité Caldera',
};

function cleanText(value: string, max: number) {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > max)
    throw new Error('DISCORD_CONTENT_INVALID');
  // Prevent markdown formatting and mentions in editorial/product text.
  return cleaned.replace(/([\\*_`~|>[\]()])/g, '\\$1').replace(/@/g, '@\u200b');
}

function publicUrl(path: string, origin: string) {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\\?#\u0000-\u001f\u007f]/.test(path)
  )
    throw new Error('DISCORD_PATH_INVALID');
  const base = new URL(origin);
  if (base.protocol !== 'https:') throw new Error('DISCORD_ORIGIN_INVALID');
  const target = new URL(path, base);
  if (target.origin !== base.origin) throw new Error('DISCORD_PATH_INVALID');
  return target.href;
}

/** No user-controlled webhook/channel, raw Markdown or external link. */
export function renderDiscordPublication(
  publication: DiscordPublication,
  origin: string,
) {
  const label = labels[publication.kind];
  if (!label) throw new Error('DISCORD_KIND_INVALID');
  const content = `**${label}**\n${cleanText(publication.title, 160)}\n${cleanText(publication.summary, 600)}\n${publicUrl(publication.path, origin)}`;
  if (content.length > 2000) throw new Error('DISCORD_CONTENT_INVALID');
  return {
    content,
    allowed_mentions: { parse: [] as string[] },
  };
}
