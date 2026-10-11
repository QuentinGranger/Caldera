import { FilterPanel } from '@/components/admin/FilterPanel';
import { FulfillmentStatus } from '@/generated/prisma/client';
import { fulfillmentLabels } from '@/lib/fulfillment/carriers';
import Link from 'next/link';
import { adminListHref } from '@/lib/admin/list-url';
import { OrderStatus, PaymentStatus } from '@/generated/prisma/client';
import {
  getAdminOrders,
  getOrderQueue,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { euros, formatDate, label } from '@/lib/admin/format';
import {
  PageHeader,
  AdminTable,
  Badge,
  Pagination,
  EmptyState,
  FilterSelect,
} from '@/components/admin/AdminUI';
import styles from '@/components/admin/Admin.module.scss';
import { toCents } from '@/lib/refunds/amounts';
const TAB_LABELS = {
  UNFULFILLED: 'À préparer',
  PREPARING: 'En préparation',
  READY_TO_SHIP: 'Prêtes',
  SHIPPED: 'Expédiées',
} as const;
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [data, queue] = await Promise.all([
    getAdminOrders(params),
    getOrderQueue(),
  ]);
  const view = param(params, 'view');
  const fulfillment = param(params, 'fulfillment');
  const tabs = [
    { label: 'À traiter', href: '?view=todo', count: queue.todo, view: 'todo' },
    ...(['UNFULFILLED', 'PREPARING', 'READY_TO_SHIP', 'SHIPPED'] as const).map(
      (value) => ({
        label: TAB_LABELS[value],
        href: `?fulfillment=${value}`,
        count: value === 'SHIPPED' ? undefined : queue[value],
        fulfillment: value,
      }),
    ),
    { label: 'Toutes', href: '' },
  ].map((tab) => ({
    ...tab,
    href: adminListHref('/admin/commandes', params, {
      view: 'view' in tab ? tab.view : undefined,
      fulfillment: 'fulfillment' in tab ? tab.fulfillment : undefined,
    }),
  }));
  const currentTab = tabs.find((tab) =>
    'view' in tab
      ? view === tab.view
      : 'fulfillment' in tab
        ? !view && fulfillment === tab.fulfillment
        : !view && !fulfillment,
  );
  // A tab is a view, not a filter: only what was chosen beyond it opens
  // the filters (and the default order is no criterion).
  const fromTab = currentTab && 'fulfillment' in currentTab;
  const sort = param(params, 'sort');
  const activeCount =
    ['emails', 'fulfillment', 'status', 'payment', 'from', 'to', 'shipping']
      .filter((key) => !(fromTab && key === 'fulfillment'))
      .filter((key) => param(params, key)).length +
    (sort && sort !== 'newest' ? 1 : 0);
  const options = (values: string[]) =>
    values.map((value) => ({ value, label: label(value) }));
  const filterDefinitions: [string, string][] = [
    ['emails', 'Emails'],
    ['status', 'Commande'],
    ['payment', 'Paiement'],
    ['from', 'Du'],
    ['to', 'Au'],
    ['shipping', 'Livraison'],
    ['fulfillment', 'Préparation'],
    ['sort', 'Tri'],
  ];
  return (
    <>
      <PageHeader
        title="Commandes"
        description="Retrouvez une commande, suivez sa préparation et organisez les expéditions."
      />
      <nav className={styles.tabs} aria-label="Vues commandes">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
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
        action="/admin/commandes"
        search={param(params, 'search')}
        placeholder="Numéro, email, ID public, SKU ou suivi"
        activeCount={activeCount}
        params={params}
        criteria={filterDefinitions
          .filter(
            ([name]) =>
              param(params, name) &&
              !(name === 'fulfillment' && fromTab) &&
              (name !== 'sort' || sort !== 'newest'),
          )
          .map(([name, title]) => {
            const value = param(params, name);
            const names: Record<string, string> = {
              failed: 'En échec',
              oldest: 'Plus anciennes',
              amount: 'Montant croissant',
              amountDesc: 'Montant décroissant',
              paid: 'Date de paiement',
              shipped: 'Date d’expédition',
            };
            const text =
              name === 'shipping'
                ? data.shipping.find((item) => item.code === value)?.name
                : (names[value] ?? label(value));
            return { name, label: `${title} : ${text ?? value}` };
          })}
        keep={{ view }}
      >
        <FilterSelect
          name="emails"
          label="Emails"
          value={param(params, 'emails')}
          options={[{ value: 'failed', label: 'En échec' }]}
        />
        <FilterSelect
          name="fulfillment"
          label="Préparation"
          value={param(params, 'fulfillment')}
          options={Object.values(FulfillmentStatus).map((value) => ({
            value,
            label: fulfillmentLabels[value]!,
          }))}
        />
        <FilterSelect
          name="status"
          label="Commande"
          value={param(params, 'status')}
          options={options(Object.values(OrderStatus))}
        />
        <FilterSelect
          name="payment"
          label="Paiement"
          value={param(params, 'payment')}
          options={options(Object.values(PaymentStatus))}
        />
        <label>
          Du (Paris)
          <input name="from" type="date" defaultValue={param(params, 'from')} />
        </label>
        <label>
          Au (inclus)
          <input name="to" type="date" defaultValue={param(params, 'to')} />
        </label>
        <FilterSelect
          name="shipping"
          label="Livraison"
          value={param(params, 'shipping')}
          options={data.shipping.map((method) => ({
            value: method.code,
            label: method.name,
          }))}
        />
        <label>
          Trier
          <select name="sort" defaultValue={param(params, 'sort') || 'newest'}>
            <option value="newest">Plus récentes</option>
            <option value="oldest">Plus anciennes</option>
            <option value="amount">Montant croissant</option>
            <option value="amountDesc">Montant décroissant</option>
            <option value="paid">Date de paiement</option>
            <option value="shipped">Date d’expédition</option>
          </select>
        </label>
      </FilterPanel>
      {data.orders.length ? (
        <AdminTable
          caption="Commandes"
          headings={[
            'Commande',
            'Client',
            'Statut & paiement',
            'Préparation',
            'Total',
            'Livraison',
          ]}
        >
          {data.orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link href={`/admin/commandes/${order.id}`}>
                  {order.orderNumber}
                </Link>
                <small>{formatDate(order.createdAt)}</small>
              </td>
              <td>{order.email}</td>
              <td>
                <div className={styles.cellBadges}>
                  <Badge value={order.status} />
                  {order.refunds.length > 0 && order.payment && (
                    <Badge
                      value={
                        order.refunds.reduce(
                          (sum, refund) => sum + toCents(refund.amount),
                          0,
                        ) >= toCents(order.payment.amount)
                          ? 'REFUNDED'
                          : 'PARTIALLY_REFUNDED'
                      }
                    />
                  )}
                </div>
                <small>
                  Paiement : {order.payment ? label(order.payment.status) : '—'}
                </small>
              </td>
              <td>
                {order.status === 'PAID' ? (
                  <Badge value={order.fulfillmentStatus} />
                ) : (
                  '—'
                )}
              </td>
              <td>
                <strong className={styles.cellAmount}>
                  {euros(order.totalAmount)}
                </strong>
                <small>
                  {order._count.items} ligne{order._count.items > 1 ? 's' : ''}
                </small>
              </td>
              <td>{order.shippingMethodName}</td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>Aucune commande trouvée.</EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/commandes"
      />
      <small>Dates et filtres : Europe/Paris.</small>
    </>
  );
}
