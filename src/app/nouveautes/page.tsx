import { CatalogPage } from '@/components/catalog/CatalogPage';
import { catalogMetadata } from '@/lib/catalog/metadata';
import type { SearchParams } from '@/lib/catalog/params';
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
  return catalogMetadata(
    'Nouveautés',
    'Les dernières découvertes sélectionnées pour votre collection.',
    '/nouveautes',
    await searchParams,
  );
}
export default function Page({ searchParams }: Props) {
  return (
    <CatalogPage
      title="Nouveautés"
      description="Les dernières découvertes sélectionnées pour votre collection."
      path="/nouveautes"
      scope={{ newArrival: true }}
      searchParams={searchParams}
      breadcrumb={[
        { label: 'Accueil', href: '/' },
        { label: 'Catalogue', href: '/catalogue' },
        { label: 'Nouveautés' },
      ]}
    />
  );
}
