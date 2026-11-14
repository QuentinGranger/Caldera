export const newsletterChannels = {
  instagram_bio: 'Bio Instagram',
  instagram_story: 'Stories Instagram',
  instagram: 'Instagram (lien non identifié)',
  discord: 'Discord',
  site: 'Site Caldera',
  unknown: 'Origine inconnue',
} as const;

export type NewsletterChannel = keyof typeof newsletterChannels;

export function validNewsletterChannel(value: unknown): NewsletterChannel {
  return typeof value === 'string' && Object.hasOwn(newsletterChannels, value)
    ? (value as NewsletterChannel)
    : 'unknown';
}

export function newsletterChannelFromUrl(
  params: Pick<URLSearchParams, 'get'>,
  referrer: string,
  origin: string,
): NewsletterChannel {
  const source = params.get('utm_source')?.toLowerCase();
  const content = params.get('utm_content')?.toLowerCase();
  if (source === 'instagram') {
    if (content === 'bio') return 'instagram_bio';
    if (content === 'story') return 'instagram_story';
    return 'instagram';
  }
  if (source === 'discord') return 'discord';
  if (source) return 'unknown';
  try {
    const from = new URL(referrer);
    if (/(^|\.)instagram\.com$/.test(from.hostname)) return 'instagram';
    if (/(^|\.)discord\.(com|gg)$/.test(from.hostname)) return 'discord';
    if (from.origin === origin) return 'site';
  } catch {
    // The browser can omit the referrer.
  }
  return 'unknown';
}

export const openingCampaignParamKeys = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
] as const;
