import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  FilterSelect,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { ImportsTable } from '@/components/admin/SupplierTables';
import { requireAdmin } from '@/lib/admin/auth';
import { label } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import { getSupplierImports, getSuppliers } from '@/lib/supplier-import/admin';

const statuses = [
  'REVIEW',
  'MAPPING',
  'EXTRACTING',
  'APPLIED',
  'REVERTED',
  'CANCELED',
  'FAILED',
];

export default async function SupplierImportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const params = await searchParams;
  const [data, suppliers] = await Promise.all([
    getSupplierImports(params),
    getSuppliers(),
  ]);
  return (
    <>
      <PageHeader
        title="Historique des imports"
        description="Chaque fichier déposé : fournisseur, auteur, lignes, résultat, durée et état. Le dernier import appliqué d’un fournisseur peut être défait depuis sa page."
      />
      <FilterPanel
        action="/admin/fournisseurs/imports"
        search={param(params, 'search')}
        placeholder="Nom du fichier"
        activeCount={
          [param(params, 'status'), param(params, 'supplier')].filter(Boolean)
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
          name="status"
          label="État"
          value={param(params, 'status')}
          options={statuses.map((value) => ({
            value,
            label: label(`IMPORT_${value}`),
          }))}
        />
      </FilterPanel>
      <ImportsTable rows={data.rows} />
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/fournisseurs/imports"
      />
    </>
  );
}
