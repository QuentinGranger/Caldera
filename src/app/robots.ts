import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { isIndexableHost, siteOrigin } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isIndexableHost((await headers()).get('host')))
    return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private or transactional pages: already noindex, not worth crawling.
      disallow: ['/admin', '/api/', '/checkout', '/panier', '/commande/'],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
