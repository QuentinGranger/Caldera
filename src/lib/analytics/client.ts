export type CommerceItem = {
  item_id: string;
  item_name?: string;
  price: number;
  quantity: number;
};
export type CommerceEvent =
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase';
export const CONSENT_KEY = 'caldera-analytics-consent-v1';
export function analyticsAllowed() {
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null');
    if (!(value?.expires > Date.now())) {
      localStorage.removeItem('caldera-measurement-visitor');
      return false;
    }
    return value.accepted === true;
  } catch {
    return false;
  }
}
export function safeAnalyticsPath(path: string) {
  return /^\/(admin|compte|commande|paiement|panier\/reprendre|newsletter|checkout\/paiement|api)(\/|$)/.test(
    path,
  )
    ? null
    : path;
}
export function analyticsLocation(input: string) {
  const url = new URL(input);
  const path = safeAnalyticsPath(url.pathname);
  if (!path) return null;
  const output = new URL(path, url.origin);
  for (const key of [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
  ]) {
    const value = url.searchParams.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value))
      output.searchParams.set(key, value);
  }
  return output.href;
}
export function trackCommerce(
  name: CommerceEvent,
  data: {
    items: CommerceItem[];
    value?: number;
    transaction_id?: string;
    shipping?: number;
    tax?: number;
  },
) {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  measureLocal(name);
  window.dispatchEvent(
    new CustomEvent('caldera:commerce', {
      detail: { name, data: { ...data, currency: 'EUR' } },
    }),
  );
}

let measurementQueue = Promise.resolve();
export function measureLocal(event: string) {
  if (
    !analyticsAllowed() ||
    ![
      'page_view',
      'view_item',
      'add_to_cart',
      'begin_checkout',
      'add_payment_info',
    ].includes(event)
  )
    return;
  let visitor: string;
  try {
    visitor =
      localStorage.getItem('caldera-measurement-visitor') ??
      crypto.randomUUID();
    localStorage.setItem('caldera-measurement-visitor', visitor);
  } catch {
    return;
  }
  const url = new URL(location.href);
  let referrer = '';
  try {
    referrer = new URL(document.referrer).origin;
  } catch {}
  const body = JSON.stringify({
    event,
    consent: true,
    visitor,
    source: url.searchParams.get('utm_source'),
    medium: url.searchParams.get('utm_medium'),
    campaign: url.searchParams.get('utm_campaign'),
    referrer,
  });
  // Serialize so first-event responses cannot create concurrent sessions.
  measurementQueue = measurementQueue.then(async () => {
    if (!analyticsAllowed()) return;
    await fetch('/api/measurement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  });
}
