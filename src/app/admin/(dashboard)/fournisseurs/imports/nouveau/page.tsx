import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/admin/AdminUI';
import { ImportSteps } from '@/components/admin/SupplierImportParts';
import { SupplierUpload } from '@/components/admin/SupplierUpload';
import { requireAdmin } from '@/lib/admin/auth';
import { param, type SearchParams } from '@/lib/admin/queries';
import { getSupplierOptions } from '@/lib/supplier-import/admin';
import styles from '@/components/admin/Admin.module.scss';

// The last chunk triggers reading the file (a PDF of 150 pages included).
export const maxDuration = 60;

export default async function NewSupplierImportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const [suppliers, params] = await Promise.all([
    getSupplierOptions(),
    searchParams,
  ]);
  const chosen = param(params, 'fournisseur');
  return (
    <>
      <PageHeader
        title="Importer un catalogue"
        description="Déposez le fichier d’un fournisseur : il est lu, ses colonnes sont reconnues, puis chaque ligne est comparée au catalogue. Vous validez l’aperçu avant tout import."
      />
      <ImportSteps status="NEW" />
      {suppliers.length ? (
        <section className={styles.card}>
          <SupplierUpload
            suppliers={suppliers}
            supplierId={
              suppliers.some((supplier) => supplier.id === chosen)
                ? chosen
                : suppliers[0]!.id
            }
          />
        </section>
      ) : (
        <EmptyState>
          Aucun fournisseur actif.{' '}
          <Link href="/admin/fournisseurs">Ajoutez-en un</Link> d’abord.
        </EmptyState>
      )}
    </>
  );
}
