import Link from 'next/link';
import { FileText, Settings } from 'lucide-react';
import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  AdminTable,
  EmptyState,
  FilterSelect,
  IntegrityWarning,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { euros, formatDate } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import { getPrisma } from '@/lib/db/prisma';
import { getAdminInvoices, invoiceSettings } from '@/lib/invoices/admin';
import { missingMentions } from '@/lib/invoices/document';
import { sellerFrom } from '@/lib/invoices/service';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const params = await searchParams;
  const [data, settings] = await Promise.all([
    getAdminInvoices(params),
    invoiceSettings(getPrisma()),
  ]);
  const missing = missingMentions(sellerFrom(settings));
  const sum = (kind: 'INVOICE' | 'CREDIT_NOTE') =>
    data.sums.find((row) => row.kind === kind);
  const year = new Date().getFullYear();
  return (
    <>
      <PageHeader
        title="Factures et avoirs"
        description="Une facture est émise à chaque paiement confirmé, un avoir à chaque remboursement confirmé. Numérotation continue par année, documents figés : ils ne se modifient ni ne se suppriment."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/factures/reglages"
        >
          <Settings size={16} aria-hidden="true" />
          Mentions légales
        </Link>
      </PageHeader>
      {missing.length > 0 && (
        <IntegrityWarning>
          Mentions obligatoires manquantes sur les factures :{' '}
          {missing.join(', ')}.{' '}
          <Link href="/admin/factures/reglages">Compléter</Link> avant
          l’ouverture de la boutique.
        </IntegrityWarning>
      )}
      <section className={styles.card} aria-label="Totaux">
        <p>
          <strong>{sum('INVOICE')?._count._all ?? 0}</strong> facture(s) ·{' '}
          {euros(sum('INVOICE')?._sum.totalAmount ?? 0)} ·{' '}
          <strong>{sum('CREDIT_NOTE')?._count._all ?? 0}</strong> avoir(s) ·{' '}
          {euros(sum('CREDIT_NOTE')?._sum.totalAmount ?? 0)}
          {settings.vatRegime === 'STANDARD' &&
            ` · TVA facturée ${euros(
              Number(sum('INVOICE')?._sum.taxAmount ?? 0) -
                Number(sum('CREDIT_NOTE')?._sum.taxAmount ?? 0),
            )}`}
        </p>
      </section>
      <FilterPanel
        action="/admin/factures"
        search={param(params, 'search')}
        placeholder="N° de facture, de commande ou e-mail"
        activeCount={
          (param(params, 'kind') ? 1 : 0) + (param(params, 'year') ? 1 : 0)
        }
      >
        <FilterSelect
          name="kind"
          label="Document"
          value={param(params, 'kind')}
          options={[
            { value: 'INVOICE', label: 'Factures' },
            { value: 'CREDIT_NOTE', label: 'Avoirs' },
          ]}
        />
        <FilterSelect
          name="year"
          label="Année"
          value={param(params, 'year')}
          options={[year, year - 1, year - 2].map((value) => ({
            value: String(value),
            label: String(value),
          }))}
        />
      </FilterPanel>
      {data.rows.length ? (
        <>
          <AdminTable
            caption="Factures et avoirs"
            headings={['Numéro', 'Date', 'Commande', 'Montant TTC', 'PDF']}
          >
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.number}</strong>
                  <small>
                    {row.kind === 'INVOICE'
                      ? 'Facture'
                      : `Avoir sur ${row.invoice?.number ?? '—'}`}
                  </small>
                </td>
                <td>{formatDate(row.issuedAt)}</td>
                <td>
                  <Link href={`/admin/commandes/${row.order.id}`}>
                    {row.order.orderNumber}
                  </Link>
                  <small>{row.order.email}</small>
                </td>
                <td>
                  {row.kind === 'CREDIT_NOTE' ? '−' : ''}
                  {euros(row.totalAmount)}
                </td>
                <td>
                  <a
                    href={`/admin/factures/${row.id}/pdf`}
                    target="_blank"
                    rel="noopener"
                  >
                    <FileText size={15} aria-hidden="true" /> Ouvrir
                  </a>
                </td>
              </tr>
            ))}
          </AdminTable>
          <Pagination
            page={data.page}
            total={data.total}
            params={params}
            path="/admin/factures"
          />
        </>
      ) : (
        <EmptyState>Aucun document pour ces critères.</EmptyState>
      )}
    </>
  );
}
