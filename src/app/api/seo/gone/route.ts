import { connection } from 'next/server';
import { listGoneProductSlugs } from '@/lib/product/gone';

export const runtime = 'nodejs';

// Read by src/proxy.ts to answer 410 on products withdrawn for good. Public
// information only: slugs of archived products.
export async function GET() {
  await connection();
  return Response.json(
    { products: await listGoneProductSlugs() },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
