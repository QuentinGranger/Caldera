import Link from 'next/link';
import { Upload } from 'lucide-react';
import { AdminTable, EmptyState, PageHeader } from '@/components/admin/AdminUI';
import {
  ImportBadge,
  SupplierForm,
} from '@/components/admin/SupplierImportParts';
import { ImportsTable, WatchTable } from '@/components/admin/SupplierTables';
import { requireAdmin } from '@/lib/admin/auth';
import { formatDate } from '@/lib/admin/format';
import {
  getSupplierImports,
  getSuppliers,
  getSupplierWatch,
} from '@/lib/supplier-import/admin';
import { saveSupplierAction } from '@/lib/supplier-import/admin-actions';
import styles from '@/components/admin/Admin.module.scss';

export default async function SuppliersPage() {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const [suppliers, imports, watch] = await Promise.all([
    getSuppliers(),
    getSupplierImports({}, 8),
    getSupplierWatch({}, 10),
  ]);
  return (
    <>
      <PageHeader
        title="Fournisseurs"
        description="Importez les catalogues fournisseurs (CSV, Excel, PDF, JSON), suivez leurs offres, leurs prix et leurs stocks. Rien n’est modifié dans la boutique sans votre validation."
      >
        {suppliers.length > 0 && (
          <Link
            className={styles.button}
            href="/admin/fournisseurs/imports/nouveau"
          >
            <Upload size={17} aria-hidden="true" />
            Importer un catalogue
          </Link>
        )}
      </PageHeader>
      {suppliers.length ? (
        <AdminTable
          caption="Fournisseurs"
          headings={['Fournisseur', 'Code', 'Offres', 'Dernier import']}
        >
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>
                <Link href={`/admin/fournisseurs/${supplier.id}`}>
                  {supplier.name}
                </Link>
                {!supplier.isActive && <small>Désactivé</small>}
              </td>
              <td>
                <code>{supplier.code}</code>
              </td>
              <td>
                {supplier.active} au catalogue
                {supplier.missing > 0 && (
                  <small>
                    {supplier.missing} absente(s) du dernier catalogue
                  </small>
                )}
              </td>
              <td>
                {supplier.imports[0] ? (
                  <>
                    <Link
                      href={`/admin/fournisseurs/imports/${supplier.imports[0].id}`}
                    >
                      {formatDate(supplier.imports[0].createdAt)}
                    </Link>{' '}
                    <ImportBadge status={supplier.imports[0].status} />
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>
          Ajoutez un premier fournisseur pour importer son catalogue.
        </EmptyState>
      )}
      <details className={styles.card} open={!suppliers.length}>
        <summary>Ajouter un fournisseur</summary>
        <SupplierForm action={saveSupplierAction} />
      </details>
      <section className={styles.card}>
        <div className={styles.panelHeader}>
          <h2>Derniers imports</h2>
          <Link href="/admin/fournisseurs/imports">Tout l’historique</Link>
        </div>
        <ImportsTable rows={imports.rows} />
      </section>
      <section className={styles.card}>
        <div className={styles.panelHeader}>
          <h2>Veille : ce qui a changé</h2>
          <Link href="/admin/fournisseurs/veille">Toute la veille</Link>
        </div>
        <WatchTable rows={watch.rows} />
      </section>
    </>
  );
}
