import { FilterPanel } from '@/components/admin/FilterPanel';
import { FulfillmentStatus } from '@/generated/prisma/client';
import { fulfillmentLabels } from '@/lib/fulfillment/carriers';
import Link from 'next/link';
import { OrderStatus, PaymentStatus } from '@/generated/prisma/client';
import { getAdminOrders, param, type SearchParams } from '@/lib/admin/queries';
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
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminOrders(params);
  const options = (values: string[]) =>
    values.map((value) => ({ value, label: label(value) }));
  return (
    <>
      <PageHeader
        title="Commandes"
        description="Retrouvez une commande, suivez sa préparation et organisez les expéditions."
      />
      <nav className={styles.tabs} aria-label="Vues commandes">
        <Link
          href="/admin/commandes?view=todo"
          aria-current={param(params, 'view') === 'todo' ? 'page' : undefined}
        >
          À traiter
        </Link>
        <Link
          href="/admin/commandes?fulfillment=PREPARING"
          aria-current={
            !param(params, 'view') &&
            param(params, 'fulfillment') === 'PREPARING'
              ? 'page'
              : undefined
          }
        >
          En préparation
        </Link>
        <Link
          href="/admin/commandes?fulfillment=READY_TO_SHIP"
          aria-current={
            !param(params, 'view') &&
            param(params, 'fulfillment') === 'READY_TO_SHIP'
              ? 'page'
              : undefined
          }
        >
          Prêtes
        </Link>
        <Link
          href="/admin/commandes?fulfillment=SHIPPED"
          aria-current={
            !param(params, 'view') && param(params, 'fulfillment') === 'SHIPPED'
              ? 'page'
              : undefined
          }
        >
          Expédiées
        </Link>
        <Link
          href="/admin/commandes"
          aria-current={
            !param(params, 'view') && !param(params, 'fulfillment')
              ? 'page'
              : undefined
          }
        >
          Toutes
        </Link>
      </nav>
      <FilterPanel
        action="/admin/commandes"
        search={param(params, 'search')}
        placeholder="Numéro, email, ID public, SKU ou suivi"
        activeCount={
          [
            'emails',
            'view',
            'fulfillment',
            'status',
            'payment',
            'from',
            'to',
            'shipping',
            'sort',
          ].filter((key) => param(params, key)).length
        }
      >
        <FilterSelect
          name="emails"
          label="Emails"
          value={param(params, 'emails')}
          options={[{ value: 'failed', label: 'En échec' }]}
        />
        {param(params, 'view') && (
          <input type="hidden" name="view" value={param(params, 'view')} />
        )}
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
            'Numéro',
            'Date',
            'Email client',
            'Commande',
            'Paiement',
            'Préparation',
            'Lignes',
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
              </td>
              <td>{formatDate(order.createdAt)}</td>
              <td>{order.email}</td>
              <td>
                <Badge value={order.status} />
              </td>
              <td>
                {order.payment ? <Badge value={order.payment.status} /> : '—'}
              </td>
              <td>
                {order.status === 'PAID' ? (
                  <Badge value={order.fulfillmentStatus} />
                ) : (
                  '—'
                )}
              </td>
              <td>{order._count.items}</td>
              <td>{euros(order.totalAmount)}</td>
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
