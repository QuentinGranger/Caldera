import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { isIndexableHost, siteOrigin } from '@/lib/site';

// docs/seo-architecture.md §8. /_next/ and images stay crawlable.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isIndexableHost((await headers()).get('host')))
    return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Private or transactional pages: already noindex, not worth crawling.
        '/admin',
        '/api/',
        '/checkout',
        '/panier',
        '/commande/',
        '/compte',
        // Sort, search and price bounds: noindex listings without end.
        '/*?*sort=',
        '/*?*search=',
        '/*?*minPrice=',
        '/*?*maxPrice=',
      ],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
