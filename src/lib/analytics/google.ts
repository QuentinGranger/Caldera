import { analyticsAllowed } from './client';

type Gtag = (...args: unknown[]) => void;
type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: Gtag;
  [key: `ga-disable-${string}`]: boolean;
};

const denied = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

/** Basic consent: no Google loader before agreement, and one loader per page. */
export function startGoogleMeasurement({
  measurementId,
  containerId,
  nonce,
}: {
  measurementId: string;
  containerId?: string;
  nonce?: string;
}) {
  if (!/^G-[A-Z0-9]+$/.test(measurementId) || !analyticsAllowed()) return;
  // A malformed configured container must not silently enable another transport.
  if (containerId && !/^GTM-[A-Z0-9]+$/.test(containerId)) return;
  const target = window as unknown as GoogleWindow;
  target.dataLayer ??= [];
  const gtag: Gtag =
    target.gtag ??
    function () {
      // Google's queue expects Arguments objects, not arrays.
      // eslint-disable-next-line prefer-rest-params
      target.dataLayer!.push(arguments);
    };
  target.gtag = gtag;
  target[`ga-disable-${measurementId}`] = false;
  const existing = document.getElementById('caldera-google-loader');
  if (!existing) gtag('consent', 'default', denied);
  gtag('consent', 'update', { ...denied, analytics_storage: 'granted' });
  if (!existing) {
    const settings = {
      send_page_view: false,
      cookie_expires: 180 * 86400,
      cookie_update: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + '/',
      page_title: 'Caldera',
      page_referrer: '',
    };
    gtag('set', settings);
    const script = document.createElement('script');
    script.id = 'caldera-google-loader';
    script.async = true;
    script.nonce = nonce ?? '';
    if (containerId) {
      target.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
    } else {
      // Keep the current installation working until GTM is actually published.
      gtag('js', new Date());
      gtag('config', measurementId, settings);
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    }
    document.head.appendChild(script);
  }
  let active = true;
  let pageContext = '';
  return {
    send(name: string, parameters: Record<string, unknown>) {
      if (!active || !analyticsAllowed()) return;
      if (typeof parameters.page_location === 'string') {
        const page = {
          page_location: parameters.page_location,
          page_title: parameters.page_title ?? 'Caldera',
          page_referrer: parameters.page_referrer ?? '',
        };
        const key = JSON.stringify(page);
        if (key !== pageContext) {
          // Keep automatic engagement on the current virtual page. `update`
          // merges the context without reinitialising GA4 or adding a view.
          gtag('config', measurementId, {
            ...page,
            update: true,
            send_page_view: false,
          });
          pageContext = key;
        }
      }
      if (containerId) {
        // Clear the previous payload: GTM v2 variables otherwise merge objects.
        target.dataLayer!.push({ caldera_parameters: null });
        target.dataLayer!.push({
          event: 'caldera_measurement',
          caldera_event_name: name,
          caldera_parameters: parameters,
        });
      } else {
        gtag('event', name, { ...parameters, send_to: measurementId });
      }
    },
    stop() {
      if (!active) return;
      active = false;
      target[`ga-disable-${measurementId}`] = true;
      gtag('consent', 'update', denied);
      // Loaded runtimes cannot be unloaded by removing a script element. Keep
      // one loader and revoke consent; reaccepting must not initialise it twice.
    },
  };
}
