import { CatalogPage } from '@/components/catalog/CatalogPage';
import { catalogMetadata } from '@/lib/catalog/metadata';
import type { SearchParams } from '@/lib/catalog/params';
type Props = { searchParams: Promise<SearchParams> };
const description =
  'Cartes, coffrets et découvertes pour explorer tous les territoires de votre collection.';
export async function generateMetadata({ searchParams }: Props) {
  return catalogMetadata(
    'Catalogue Pokémon',
    description,
    '/catalogue',
    await searchParams,
  );
}
export default function Page({ searchParams }: Props) {
  return (
    <CatalogPage
      title="Catalogue"
      description={description}
      path="/catalogue"
      searchParams={searchParams}
      breadcrumb={[{ label: 'Accueil', href: '/' }, { label: 'Catalogue' }]}
    />
  );
}
