import type { Metadata } from 'next';
import type { SearchParams } from './params';
export function catalogMetadata(
  title: string,
  description: string,
  path: string,
  params: SearchParams = {},
): Metadata {
  let canonical: string | undefined;
  if (process.env.SITE_URL) {
    try {
      const base = new URL(process.env.SITE_URL);
      if (['http:', 'https:'].includes(base.protocol))
        canonical = new URL(path, base.origin).href;
    } catch {
      /* Domaine non configuré : ne pas inventer de canonical. */
    }
  }
  return {
    title: `${title} | Les Terres de Caldera`,
    description,
    ...(Object.keys(params).length
      ? { robots: { index: false, follow: true } }
      : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
  };
}
