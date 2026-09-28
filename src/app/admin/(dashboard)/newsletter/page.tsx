import { NewsletterStatus } from '@/generated/prisma/client';
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
import {
  getAdminNewsletter,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import styles from '@/components/admin/Admin.module.scss';

export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminNewsletter(params);
  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Consultez les consentements confirmés et les désinscriptions. Seules les adresses actives peuvent recevoir une campagne."
      />
      <section className={styles.card} aria-label="État des inscriptions">
        <p>
          <strong>{data.counts.ACTIVE ?? 0}</strong> actives ·{' '}
          <strong>{data.counts.PENDING ?? 0}</strong> en attente de confirmation
          · <strong>{data.counts.UNSUBSCRIBED ?? 0}</strong> désinscrites
        </p>
      </section>
      <FilterPanel
        action="/admin/newsletter"
        search={param(params, 'search')}
        placeholder="Adresse e-mail"
        activeCount={param(params, 'status') ? 1 : 0}
      >
        <FilterSelect
          name="status"
          label="État"
          value={param(params, 'status')}
          options={Object.values(NewsletterStatus).map((value) => ({
            value,
            label: label(value),
          }))}
        />
      </FilterPanel>
      {data.subscribers.length ? (
        <AdminTable
          caption="Inscriptions à la newsletter"
          headings={[
            'Adresse e-mail',
            'État',
            'Consentement',
            'Confirmation',
            'Désinscription',
            'Source',
          ]}
        >
          {data.subscribers.map((subscriber) => (
            <tr key={subscriber.id}>
              <td>{subscriber.email}</td>
              <td>
                <Badge value={subscriber.status} />
              </td>
              <td>{formatDate(subscriber.consentAt)}</td>
              <td>{formatDate(subscriber.confirmedAt)}</td>
              <td>{formatDate(subscriber.unsubscribedAt)}</td>
              <td>{subscriber.consentSource}</td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>Aucune inscription trouvée.</EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/newsletter"
      />
      <small>Dates affichées à l’heure de Paris.</small>
    </>
  );
}
