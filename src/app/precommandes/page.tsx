import { CatalogPage } from '@/components/catalog/CatalogPage';
import { catalogMetadata } from '@/lib/catalog/metadata';
import type { SearchParams } from '@/lib/catalog/params';
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
  return catalogMetadata(
    'Précommandes',
    'Préparez votre prochaine exploration avec les sorties à venir.',
    '/precommandes',
    await searchParams,
  );
}
export default function Page({ searchParams }: Props) {
  return (
    <CatalogPage
      title="Précommandes"
      description="Préparez votre prochaine exploration avec les sorties à venir."
      path="/precommandes"
      scope={{ preorder: true }}
      searchParams={searchParams}
      breadcrumb={[
        { label: 'Accueil', href: '/' },
        { label: 'Catalogue', href: '/catalogue' },
        { label: 'Précommandes' },
      ]}
    />
  );
}
