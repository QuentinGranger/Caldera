import { campaignUrl } from '@/lib/analytics/campaign';
import { PRODUCTION_SITE_URL } from '@/lib/site';
export const CARNET_LINK_KEYS = [
  'story_continue',
  'comptoir_product_1',
  'comptoir_product_2',
  'comptoir_product_3',
] as const;
export type CarnetLinks = {
  storyPath: string;
  products: { id: string; href: string }[];
};
export function carnetLink(
  input: string,
  campaign: string,
  links?: CarnetLinks,
) {
  const decorated = campaignUrl(input, campaign);
  if (!links) return decorated;
  try {
    const url = new URL(decorated, PRODUCTION_SITE_URL);
    if (url.origin !== new URL(PRODUCTION_SITE_URL).origin) return decorated;
    const slot = links.products
      .slice(0, 3)
      .findIndex(
        (product) =>
          new URL(product.href, PRODUCTION_SITE_URL).pathname === url.pathname,
      );
    const key =
      url.pathname === links.storyPath
        ? 'story_continue'
        : slot >= 0
          ? `comptoir_product_${slot + 1}`
          : null;
    if (key) url.searchParams.set('utm_content', key);
    return url.href;
  } catch {
    return decorated;
  }
}
export function identifyCarnetClick(
  raw: unknown,
  campaignId: string,
  links: CarnetLinks,
) {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    if (
      url.origin !== new URL(PRODUCTION_SITE_URL).origin ||
      url.searchParams.get('utm_campaign') !== `campaign_${campaignId}`
    )
      return null;
    const key = url.searchParams.get('utm_content');
    if (key === 'story_continue' && url.pathname === links.storyPath)
      return { linkKey: key, productId: null };
    const slot =
      CARNET_LINK_KEYS.indexOf(key as (typeof CARNET_LINK_KEYS)[number]) - 1;
    const product = links.products[slot];
    if (
      slot >= 0 &&
      slot < 3 &&
      product &&
      new URL(product.href, PRODUCTION_SITE_URL).pathname === url.pathname &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        product.id,
      )
    )
      return { linkKey: key!, productId: product.id };
  } catch {}
  return null;
}
