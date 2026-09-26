export const PRODUCTION_SITE_URL = 'https://lesterresdecaldera.fr';
export const PRODUCTION_HOST = 'lesterresdecaldera.fr';

/** Public origin for absolute URLs: SITE_URL when valid, production otherwise. */
export function siteOrigin() {
  try {
    const url = new URL(process.env.SITE_URL || PRODUCTION_SITE_URL);
    if (['http:', 'https:'].includes(url.protocol)) return url.origin;
  } catch {
    /* URL invalide : repli sur le domaine de production. */
  }
  return PRODUCTION_SITE_URL;
}

/** Only the shop domain is indexable; vercel.app aliases would duplicate it. */
export function isIndexableHost(host: string | null) {
  return host === PRODUCTION_HOST || host === `www.${PRODUCTION_HOST}`;
}
