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
  const count = (status: (typeof statuses)[number]) => data.counts[status] ?? 0;
  const tabs = [
    {
      label: 'En cours',
      query: '?open=1',
      count: count('REQUESTED') + count('APPROVED') + count('RECEIVED'),
    },
    {
      label: 'À examiner',
      query: '?status=REQUESTED',
      count: count('REQUESTED'),
    },
    {
      label: 'En attente du colis',
      query: '?status=APPROVED',
      count: count('APPROVED'),
    },
    {
      label: 'À rembourser',
      query: '?status=RECEIVED',
      count: count('RECEIVED'),
    },
    { label: 'Tous', query: '' },
  ];
  const status = param(params, 'status');
  const currentTab = tabs.find((tab) =>
    tab.query === '?open=1'
      ? !status && param(params, 'open') === '1'
      : tab.query
        ? tab.query === `?status=${status}`
        : !status && param(params, 'open') !== '1',
  );
  return (
    <>
      <PageHeader
        title="Retours"
        description="Rétractations et retours déclarés par les clients ou créés ici. Acceptez, suivez la réception du colis, puis remboursez : le retour se clôt à la confirmation de Stripe."
      />
      <nav className={styles.tabs} aria-label="Vues retours">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={`/admin/retours${tab.query}`}
            aria-current={tab === currentTab ? 'page' : undefined}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={styles.tabCount}>{tab.count}</span>
            )}
          </Link>
        ))}
      </nav>
      <FilterPanel
        action="/admin/retours"
        search={param(params, 'search')}
        placeholder="N° de retour, de commande ou e-mail"
        // A tab's status is a view, not a criterion.
        activeCount={status && !currentTab ? 1 : 0}
        keep={{ open: param(params, 'open') }}
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
