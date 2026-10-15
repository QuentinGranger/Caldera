export const MEASUREMENT_EVENTS = [
  'page_view',
  'carnet_view',
  'carnet_complete',
  'view_item',
  'add_to_cart',
  'begin_checkout',
  'add_payment_info',
] as const;
export function publicCampaign(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
    ? value
    : null;
}
export function classifyChannel(
  source: unknown,
  medium: unknown,
  referrer: unknown,
) {
  const s = publicCampaign(source)?.toLowerCase();
  const m = publicCampaign(medium)?.toLowerCase();
  if (m === 'email')
    return { channel: 'newsletter', source: s ?? 'newsletter' };
  if (s === 'discord') return { channel: 'discord', source: 'discord' };
  if (s && ['instagram', 'facebook', 'tiktok', 'youtube', 'x'].includes(s))
    return { channel: 'social', source: s };
  if (s === 'google')
    return {
      channel: m === 'cpc' ? 'paid_google' : 'google',
      source: 'google',
    };
  try {
    const host = new URL(String(referrer)).hostname;
    if (/(^|\.)google\.[a-z.]+$/.test(host))
      return { channel: 'google', source: 'google' };
    if (
      /(^|\.)(instagram\.com|facebook\.com|t\.co|youtube\.com|tiktok\.com)$/.test(
        host,
      )
    )
      return { channel: 'social', source: host };
    if (/(^|\.)discord\.(com|gg)$/.test(host))
      return { channel: 'discord', source: 'discord' };
    if (host && !/(^|\.)lesterresdecaldera\.fr$/.test(host))
      return { channel: 'referral', source: host.slice(0, 80) };
  } catch {}
  return { channel: s ? 'campaign' : 'direct', source: s ?? 'direct' };
}
