export const SITE_NAME = 'Les Terres de Caldera';
export const PRODUCTION_SITE_URL = 'https://lesterresdecaldera.fr';
export const PRODUCTION_HOST = 'lesterresdecaldera.fr';

export function productionUrl(path = '/') {
  return new URL(path, PRODUCTION_SITE_URL).href;
}
