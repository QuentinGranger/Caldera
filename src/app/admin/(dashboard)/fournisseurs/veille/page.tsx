import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  FilterSelect,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { WatchTable } from '@/components/admin/SupplierTables';
import { requireAdmin } from '@/lib/admin/auth';
import { label } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import {
  getSuppliers,
  getSupplierWatch,
  WATCH_KINDS,
} from '@/lib/supplier-import/admin';

export default async function SupplierWatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const params = await searchParams;
  const [data, suppliers] = await Promise.all([
    getSupplierWatch(params),
    getSuppliers(),
  ]);
  return (
    <>
      <PageHeader
        title="Veille fournisseurs"
        description="Ce que chaque import validé a changé : baisses et hausses de prix, retours en stock, ruptures, nouvelles références, références disparues, dates de sortie."
      />
      <FilterPanel
        action="/admin/fournisseurs/veille"
        search={param(params, 'search')}
        placeholder="Nom, référence ou EAN"
        activeCount={
          [param(params, 'kind'), param(params, 'supplier')].filter(Boolean)
            .length
        }
      >
        <FilterSelect
          name="supplier"
          label="Fournisseur"
          value={param(params, 'supplier')}
          options={suppliers.map((supplier) => ({
            value: supplier.id,
            label: supplier.name,
          }))}
        />
        <FilterSelect
          name="kind"
          label="Changement"
          value={param(params, 'kind')}
          options={[...WATCH_KINDS, 'STOCK', 'INFO'].map((value) => ({
            value,
            label: label(`CHANGE_${value}`),
          }))}
        />
      </FilterPanel>
      <WatchTable rows={data.rows} />
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/fournisseurs/veille"
      />
    </>
  );
}
