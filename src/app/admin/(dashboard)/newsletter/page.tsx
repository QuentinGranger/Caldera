import { NewsletterStatus } from '@/generated/prisma/client';
import Link from 'next/link';
import { Plus } from 'lucide-react';
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
  getAdminNewsletterCampaigns,
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
  const [data, campaigns] = await Promise.all([
    getAdminNewsletter(params),
    getAdminNewsletterCampaigns(),
  ]);
  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Consultez les consentements confirmés et les désinscriptions. Seules les adresses actives peuvent recevoir une campagne."
      >
        <Link
          className={styles.button}
          href="/admin/newsletter/campagnes/nouvelle"
        >
          <Plus size={16} aria-hidden="true" />
          Nouvelle campagne
        </Link>
      </PageHeader>
      <section className={styles.card} aria-label="État des inscriptions">
        <p>
          <strong>{data.counts.ACTIVE ?? 0}</strong> actives ·{' '}
          <strong>{data.counts.PENDING ?? 0}</strong> en attente de confirmation
          · <strong>{data.counts.UNSUBSCRIBED ?? 0}</strong> désinscrites
        </p>
      </section>
      <section aria-labelledby="campagnes-newsletter">
        <div className={styles.panelHeader}>
          <h2 id="campagnes-newsletter">Campagnes</h2>
        </div>
        {campaigns.length ? (
          <AdminTable
            caption="Campagnes newsletter"
            headings={[
              'Campagne',
              'État',
              'Destinataires',
              'Envoyés',
              'Échecs',
              'Création',
            ]}
          >
            {campaigns.map((campaign) => {
              const sent = campaign.deliveryCounts.SENT ?? 0;
              const failed = campaign.deliveryCounts.FAILED ?? 0;
              return (
                <tr key={campaign.id}>
                  <td>
                    <Link href={`/admin/newsletter/campagnes/${campaign.id}`}>
                      {campaign.internalName}
                    </Link>
                    <small>{campaign.subject}</small>
                  </td>
                  <td>
                    <Badge value={campaign.status} />
                  </td>
                  <td>{campaign.recipientCount}</td>
                  <td>{sent}</td>
                  <td>{failed}</td>
                  <td>{formatDate(campaign.createdAt)}</td>
                </tr>
              );
            })}
          </AdminTable>
        ) : (
          <EmptyState>Aucune campagne préparée.</EmptyState>
        )}
      </section>
      <div className={styles.panelHeader}>
        <h2>Abonnés et consentements</h2>
      </div>
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
