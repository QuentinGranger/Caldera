import { connection } from 'next/server';
import { getSitemapUrls } from '../_lib/data';
import {
  buildUrlset,
  parseSitemapName,
  sitemapNotFound,
  xmlResponse,
} from '../_lib/xml';

// /sitemaps/pages.xml, landings.xml, content.xml and products-{n}.xml.
export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  await connection();
  const name = parseSitemapName((await context.params).name);
  if (!name) return sitemapNotFound();
  const urls = await getSitemapUrls(name);
  if (!urls) return sitemapNotFound();
  const response = xmlResponse(buildUrlset(urls));
  if (name.kind === 'content')
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
