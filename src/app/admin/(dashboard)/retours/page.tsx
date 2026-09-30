import Link from 'next/link';
import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  AdminTable,
  Badge,
  EmptyState,
  FilterSelect,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { formatDate, label } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import { getAdminReturns } from '@/lib/returns/admin';
import { returnReasonLabels } from '@/lib/returns/rules';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

const statuses = [
  'REQUESTED',
  'APPROVED',
  'RECEIVED',
  'REFUNDED',
  'REJECTED',
  'CANCELED',
] as const;

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const params = await searchParams;
  const data = await getAdminReturns(params);
  return (
    <>
      <PageHeader
        title="Retours"
        description="Rétractations et retours déclarés par les clients ou créés ici. Acceptez, suivez la réception du colis, puis remboursez : le retour se clôt à la confirmation de Stripe."
      />
      <section className={styles.card} aria-label="Retours à traiter">
        <p>
          <strong>{data.counts.REQUESTED ?? 0}</strong> à examiner ·{' '}
          <strong>{data.counts.APPROVED ?? 0}</strong> en attente du colis ·{' '}
          <strong>{data.counts.RECEIVED ?? 0}</strong> reçus à rembourser
        </p>
      </section>
      <FilterPanel
        action="/admin/retours"
        search={param(params, 'search')}
        placeholder="N° de retour, de commande ou e-mail"
        activeCount={param(params, 'status') ? 1 : 0}
      >
        <FilterSelect
          name="status"
          label="État"
          value={param(params, 'status')}
          options={statuses.map((value) => ({
            value,
            label: label(`RETURN_STATE_${value}`),
          }))}
        />
      </FilterPanel>
      {data.rows.length ? (
        <>
          <AdminTable
            caption="Retours"
            headings={[
              'Retour',
              'Commande',
              'Motif',
              'Articles',
              'Reçu le',
              'État',
            ]}
          >
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/admin/retours/${row.id}`}>{row.number}</Link>
                  <small>
                    {row.source === 'ADMIN' ? 'Créé ici' : 'Client'}
                  </small>
                </td>
                <td>
                  <Link href={`/admin/commandes/${row.order.id}`}>
                    {row.order.orderNumber}
                  </Link>
                  <small>{row.order.email}</small>
                </td>
                <td>{returnReasonLabels[row.reason]}</td>
                <td>
                  {row.items.reduce((sum, item) => sum + item.quantity, 0)}
                </td>
                <td>{formatDate(row.createdAt)}</td>
                <td>
                  <Badge value={`RETURN_STATE_${row.status}`} />
                </td>
              </tr>
            ))}
          </AdminTable>
          <Pagination
            page={data.page}
            total={data.total}
            params={params}
            path="/admin/retours"
          />
        </>
      ) : (
        <EmptyState>Aucun retour pour ces critères.</EmptyState>
      )}
    </>
  );
}
