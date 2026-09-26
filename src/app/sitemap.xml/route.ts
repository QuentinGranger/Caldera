import { connection } from 'next/server';
import { getSitemapFiles } from '../sitemaps/_lib/data';
import { buildSitemapIndex, xmlResponse } from '../sitemaps/_lib/xml';

// Sitemap index (docs/seo-architecture.md §8), read at request time and cached
// by the CDN: the catalogue changes without a redeploy.
export async function GET() {
  await connection();
  return xmlResponse(buildSitemapIndex(await getSitemapFiles()));
}
