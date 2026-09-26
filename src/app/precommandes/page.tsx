import {
  ListingHubPage,
  listingHubMetadata,
} from '@/components/catalog/ListingHubPage';
import type { SearchParams } from '@/lib/catalog/params';
type Props = { searchParams: Promise<SearchParams> };
export function generateMetadata({ searchParams }: Props) {
  return listingHubMetadata('precommandes', searchParams);
}
export default function Page({ searchParams }: Props) {
  return <ListingHubPage listing="precommandes" searchParams={searchParams} />;
}
