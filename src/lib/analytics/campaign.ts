import { PRODUCTION_SITE_URL } from '@/lib/site';
/** Public, non-personal campaign identifiers only; never recipient or delivery IDs. */
export function campaignUrl(
  input: string,
  campaign: string,
  source = 'newsletter',
) {
  try {
    const url = new URL(input, PRODUCTION_SITE_URL);
    if (url.origin !== new URL(PRODUCTION_SITE_URL).origin) return input;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(campaign)) return input;
    url.searchParams.set('utm_source', source);
    url.searchParams.set(
      'utm_medium',
      source === 'discord' ? 'community' : 'email',
    );
    url.searchParams.set('utm_campaign', campaign);
    return url.href;
  } catch {
    return input;
  }
}
