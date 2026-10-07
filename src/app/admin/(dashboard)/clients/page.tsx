import Link from 'next/link';
import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  AdminTable,
  EmptyState,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { euros, formatDate } from '@/lib/admin/format';
import {
  getAdminCustomers,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import styles from '@/components/admin/Admin.module.scss';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminCustomers(params);
  return (
    <>
      <PageHeader
        title="Clients"
        description="Comptes ouverts sur la boutique. Les commandes passées sans compte restent dans Commandes."
      />
      <FilterPanel
        action="/admin/clients"
        search={param(params, 'search')}
        placeholder="Nom ou e-mail"
      />
      {data.customers.length ? (
        <AdminTable
          caption="Comptes clients"
          headings={[
            'Client',
            'Compte créé',
            'Commandes payées',
            'Total payé',
            'Dernière commande',
            'Favoris · alertes',
          ]}
        >
          {data.customers.map((customer) => (
            <tr key={customer.id}>
              <td>
                <strong>{customer.name}</strong>
                <small>
                  {customer.email}
                  {customer.emailVerified ? '' : ' · e-mail non vérifié'}
                </small>
              </td>
              <td>{formatDate(customer.createdAt)}</td>
              <td>
                {customer.orders ? (
                  <Link
                    href={`/admin/commandes?search=${encodeURIComponent(customer.email)}`}
                  >
                    {customer.orders} commande{customer.orders > 1 ? 's' : ''}
                  </Link>
                ) : (
                  <span className={styles.muted}>Aucune</span>
                )}
              </td>
              <td>{customer.spent ? euros(customer.spent) : '—'}</td>
              <td>{formatDate(customer.lastOrderAt)}</td>
              <td>
                {customer._count.wishlistItems} · {customer._count.stockAlerts}
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>
          {param(params, 'search')
            ? 'Aucun compte ne correspond à cette recherche.'
            : 'Aucun compte client pour le moment.'}
        </EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/clients"
      />
      <small>
        Dates : Europe/Paris. Lecture seule : chaque client gère son compte.
      </small>
    </>
  );
}
