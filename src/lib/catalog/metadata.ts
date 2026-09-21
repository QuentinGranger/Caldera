import type { Metadata } from 'next';
import { PRODUCTION_SITE_URL } from '@/lib/site';
import type { SearchParams } from './params';
export function catalogMetadata(
  title: string,
  description: string,
  path: string,
  params: SearchParams = {},
): Metadata {
  let canonical: string | undefined;
  {
    try {
      const base = new URL(process.env.SITE_URL || PRODUCTION_SITE_URL);
      if (['http:', 'https:'].includes(base.protocol))
        canonical = new URL(path, base.origin).href;
    } catch {
      /* URL invalide : ne pas produire de canonical erronée. */
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
