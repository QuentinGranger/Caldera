import { Suspense } from 'react';
import { CatalogPageSkeleton } from '@/components/loading/LoadingSkeleton';
import {
  ListingHubPage,
  listingHubMetadata,
} from '@/components/catalog/ListingHubPage';
import type { SearchParams } from '@/lib/catalog/params';
type Props = { searchParams: Promise<SearchParams> };
export function generateMetadata({ searchParams }: Props) {
  return listingHubMetadata('nouveautes', searchParams);
}
export default async function Page({ searchParams }: Props) {
  const content = (
    <ListingHubPage listing="nouveautes" searchParams={searchParams} />
  );
  // Filtered URLs may canonicalise with a 308; do not begin streaming first.
  if (Object.keys(await searchParams).length > 0) return content;
  return <Suspense fallback={<CatalogPageSkeleton />}>{content}</Suspense>;
}
