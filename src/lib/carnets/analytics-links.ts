import { campaignUrl } from '@/lib/analytics/campaign';
import { PRODUCTION_SITE_URL } from '@/lib/site';
// Stable storage keys: retain historic observations and the database vocabulary.
export const CARNET_LINK_KEYS = [
  'story_continue',
  'comptoir_product_1',
  'comptoir_product_2',
  'comptoir_product_3',
] as const;
const CONTENT = [
  'continuer_expedition',
  'comptoir_produit_1',
  'comptoir_produit_2',
  'comptoir_produit_3',
] as const;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type CarnetLinks = {
  number: number;
  storyPath: string;
  products: { id: string; href: string }[];
};
export function carnetCampaignCode(number: number) {
  return Number.isSafeInteger(number) && number > 0 && number <= 999999
    ? `carnet_${String(number).padStart(3, '0')}`
    : null;
}
/** The only marketing-link generator for Carnets. No recipient identity is accepted. */
export function carnetLink(
  input: string,
  campaign: string,
  links?: CarnetLinks,
  trackingEnabled = true,
) {
  if (!links) return campaignUrl(input, campaign);
  try {
    const url = new URL(input, PRODUCTION_SITE_URL);
    if (url.origin !== new URL(PRODUCTION_SITE_URL).origin) return input;
    // Clear stale/editor-supplied tracking parameters, preserving access, variant and fragment.
    for (const key of [...url.searchParams.keys()])
      if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    const slot = links.products
      .slice(0, 3)
      .findIndex(
        (product) =>
          new URL(product.href, PRODUCTION_SITE_URL).pathname === url.pathname,
      );
    const index =
      url.pathname === links.storyPath ? 0 : slot >= 0 ? slot + 1 : -1;
    const code = carnetCampaignCode(links.number);
    // Non-marketing links (privacy, account, unsubscribe...) never acquire Carnet tags.
    if (!trackingEnabled || index < 0 || !code) return url.href;
    url.searchParams.set('utm_source', 'newsletter');
    url.searchParams.set('utm_medium', 'email');
    url.searchParams.set('utm_campaign', code);
    url.searchParams.set('utm_content', CONTENT[index]!);
    if (campaign.startsWith('campaign_') && UUID.test(campaign.slice(9)))
      url.searchParams.set('utm_id', campaign);
    return url.href;
  } catch {
    return input;
  }
}
/** Normalize new French content IDs and legacy emails to the existing storage keys. */
export function identifyCarnetClick(
  raw: unknown,
  campaignId: string,
  links: CarnetLinks,
) {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    if (url.origin !== new URL(PRODUCTION_SITE_URL).origin) return null;
    const legacy =
      url.searchParams.get('utm_campaign') === `campaign_${campaignId}`;
    const modern =
      url.searchParams.get('utm_campaign') ===
        carnetCampaignCode(links.number) &&
      url.searchParams.get('utm_id') === `campaign_${campaignId}` &&
      url.searchParams.get('utm_source') === 'newsletter' &&
      url.searchParams.get('utm_medium') === 'email';
    if (!legacy && !modern) return null;
    const content = url.searchParams.get('utm_content');
    const index = modern
      ? CONTENT.indexOf(content as (typeof CONTENT)[number])
      : CARNET_LINK_KEYS.indexOf(content as (typeof CARNET_LINK_KEYS)[number]);
    if (index === 0 && url.pathname === links.storyPath)
      return { linkKey: CARNET_LINK_KEYS[0], productId: null };
    const product = links.products[index - 1];
    if (
      index > 0 &&
      index <= 3 &&
      product &&
      UUID.test(product.id) &&
      new URL(product.href, PRODUCTION_SITE_URL).pathname === url.pathname
    )
      return { linkKey: CARNET_LINK_KEYS[index]!, productId: product.id };
  } catch {}
  return null;
}
