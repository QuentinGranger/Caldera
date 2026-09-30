import Link from 'next/link';
import { AdminTable, EmptyState } from '@/components/admin/AdminUI';
import { euros, formatDate, label } from '@/lib/admin/format';
import type {
  getSupplierImports,
  getSupplierWatch,
} from '@/lib/supplier-import/admin';
import type { StoredSummary } from '@/lib/supplier-import/service';
import { ChangeList, ImportBadge } from './SupplierImportParts';

const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} ko`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;

const duration = (ms: number | null) =>
  ms === null
    ? '—'
    : ms < 1000
      ? `${ms} ms`
      : `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

/** The import log: supplier, file, date, who, counts, status, duration. */
export function ImportsTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getSupplierImports>>['rows'];
}) {
  if (!rows.length)
    return <EmptyState>Aucun import pour ces critères.</EmptyState>;
  return (
    <AdminTable
      caption="Historique des imports"
      headings={[
        'Fichier',
        'Fournisseur',
        'Déposé',
        'Lignes',
        'Résultat',
        'Durée',
        'État',
      ]}
    >
      {rows.map((row) => {
        const summary = row.summary as
          | (StoredSummary & {
              applied?: {
                offersCreated: number;
                offersUpdated: number;
                productsCreated: number;
              };
            })
          | null;
        return (
          <tr key={row.id}>
            <td>
              <Link href={`/admin/fournisseurs/imports/${row.id}`}>
                {row.fileName}
              </Link>
              <small>
                {row.fileKind} · {size(row.fileSize)} · {label(row.scope)}
              </small>
            </td>
            <td>
              <Link href={`/admin/fournisseurs/${row.supplier.id}`}>
                {row.supplier.name}
              </Link>
            </td>
            <td>
              {formatDate(row.createdAt)}
              <small>par {row.createdBy.name}</small>
            </td>
            <td>{summary?.rows ?? '—'}</td>
            <td>
              {summary?.applied ? (
                <>
                  {summary.applied.offersCreated} créée(s) ·{' '}
                  {summary.applied.offersUpdated} mise(s) à jour
                  <small>
                    {summary.applied.productsCreated} brouillon(s)
                    {row.appliedBy ? ` · validé par ${row.appliedBy.name}` : ''}
                  </small>
                </>
              ) : summary ? (
                <>
                  {summary.toReview} à vérifier · {summary.rejected} rejetée(s)
                </>
              ) : (
                (row.error ?? '—')
              )}
            </td>
            <td>{duration(row.durationMs)}</td>
            <td>
              <ImportBadge status={row.status} />
            </td>
          </tr>
        );
      })}
    </AdminTable>
  );
}

/** Supplier watch: prices, stock and references that moved. */
export function WatchTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getSupplierWatch>>['rows'];
}) {
  if (!rows.length)
    return (
      <EmptyState>
        Aucun changement pour l’instant : il apparaîtra au prochain import
        validé.
      </EmptyState>
    );
  return (
    <AdminTable
      caption="Veille fournisseurs"
      headings={[
        'Date',
        'Référence',
        'Fournisseur',
        'Changement',
        'Prix d’achat HT',
        'Produit Caldera',
      ]}
    >
      {rows.map((row) => (
        <tr key={row.id}>
          <td>{formatDate(row.createdAt)}</td>
          <td>
            {row.offer.name}
            <small>
              <code>{row.offer.supplierSku}</code>
            </small>
          </td>
          <td>
            <Link href={`/admin/fournisseurs/${row.offer.supplier.id}`}>
              {row.offer.supplier.name}
            </Link>
          </td>
          <td>
            <ChangeList
              changes={[
                {
                  kind: row.kind,
                  field: row.field,
                  before: row.before as string | number | null,
                  after: row.after as string | number | null,
                },
              ]}
            />
          </td>
          <td>{euros(row.offer.purchasePrice)}</td>
          <td>
            {row.offer.variant ? (
              <Link href={`/admin/produits/${row.offer.variant.product.id}`}>
                {row.offer.variant.product.name}
              </Link>
            ) : (
              '—'
            )}
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}
