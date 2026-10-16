import { CommunicationAnchor } from '@/components/admin/CommunicationAnchor';
import { EditorialProduction } from '@/components/admin/EditorialProduction';
import { getEditorialProduction } from '@/lib/carnets/production';
import { LifecycleEmailStatus } from '@/components/admin/LifecycleEmailStatus';
import { NewsletterStatus } from '@/generated/prisma/client';
import Link from 'next/link';
import {
  Plus,
  ArrowUpRight,
  Search,
  Users,
  FileEdit,
  CalendarClock,
  Send,
  ChevronDown,
  Settings2,
} from 'lucide-react';
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
import ui from '@/components/admin/Communication.module.scss';
import {
  CAMPAIGN_STATES,
  getNewsletterCampaignList,
} from '@/lib/admin/communication-queries';
import { adminListHref } from '@/lib/admin/list-url';

export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [data, campaigns, production] = await Promise.all([
    getAdminNewsletter(params),
    getNewsletterCampaignList(params),
    getEditorialProduction(),
  ]);
  const audienceOpen = Boolean(
    param(params, 'audience') ||
    param(params, 'search') ||
    param(params, 'status') ||
    param(params, 'page'),
  );
  const campaignHref = (status?: string) =>
    adminListHref('/admin/newsletter', params, {
      campaignStatus: status,
      campaignPage: undefined,
    }) + '#campagnes-newsletter';
  return (
    <>
      <CommunicationAnchor
        targets={[
          'campagnes-newsletter',
          'audience-newsletter',
          'technique-newsletter',
        ]}
        revision={JSON.stringify(params)}
      />
      <PageHeader
        title="Newsletter"
        description="Votre atelier éditorial : préparer, programmer, puis mesurer vos éditions."
      >
        <Link className={styles.button} href="/admin/newsletter/nouvelle">
          <Plus size={16} aria-hidden="true" />
          Nouvelle édition
        </Link>
      </PageHeader>
      <EditorialProduction
        data={production}
        emailsEnabled={process.env.EMAILS_ENABLED === 'true'}
      />
      <nav className={ui.metrics} aria-label="Repères newsletter">
        {[
          {
            label: 'Abonnés actifs',
            value: data.counts.ACTIVE ?? 0,
            href: '/admin/newsletter?audience=1#audience-newsletter',
            icon: Users,
            note: 'Audience & consentements',
          },
          {
            label: 'Brouillons',
            value: campaigns.counts.DRAFT ?? 0,
            href: campaignHref('DRAFT'),
            icon: FileEdit,
            note: 'À préparer',
          },
          {
            label: 'Programmées',
            value: campaigns.counts.QUEUED ?? 0,
            href: campaignHref('QUEUED'),
            icon: CalendarClock,
            note: 'Prochains envois',
          },
          {
            label: 'Campagnes terminées',
            value: campaigns.counts.COMPLETED ?? 0,
            href: campaignHref('COMPLETED'),
            icon: Send,
            note: 'Consulter la diffusion',
          },
        ].map(({ label: heading, value, href, icon: Icon, note }) => (
          <Link href={href} key={heading}>
            <span>
              <Icon size={17} aria-hidden="true" />
              {heading}
            </span>
            <strong>{value}</strong>
            <small>
              {note}
              <ArrowUpRight size={14} aria-hidden="true" />
            </small>
          </Link>
        ))}
      </nav>
      <section className={ui.section} aria-labelledby="campagnes-newsletter">
        <div className={ui.sectionHeader}>
          <div>
            <span className={ui.eyebrow}>Vos éditions</span>
            <h2 id="campagnes-newsletter">Campagnes</h2>
            <p>
              {campaigns.total} campagne{campaigns.total === 1 ? '' : 's'}
              {campaigns.search || campaigns.status
                ? ' dans cette sélection'
                : ''}{' '}
              · des brouillons à la diffusion.
            </p>
          </div>
          <Link className={ui.textLink} href="/admin/mesures">
            Mesurer les résultats <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <form
          key={`${campaigns.search}:${campaigns.status}:${campaigns.page}`}
          action="/admin/newsletter#campagnes-newsletter"
          className={ui.filters}
        >
          <label className={ui.search}>
            Rechercher une campagne
            <span>
              <Search size={17} aria-hidden="true" />
              <input
                name="campaignSearch"
                type="search"
                maxLength={200}
                defaultValue={campaigns.search}
                placeholder="Nom de campagne ou objet de l’email"
              />
            </span>
          </label>
          <label>
            État
            <select name="campaignStatus" defaultValue={campaigns.status}>
              <option value="">Tous les états</option>
              {Object.entries(CAMPAIGN_STATES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {['search', 'status', 'page', 'audience', 'technique'].map((key) =>
            param(params, key) ? (
              <input
                type="hidden"
                key={key}
                name={key}
                value={param(params, key)}
              />
            ) : null,
          )}
          <button type="submit" className={styles.button}>
            Filtrer
          </button>
          {(campaigns.search || campaigns.status) && (
            <Link
              className={ui.textLink}
              href={
                adminListHref('/admin/newsletter', params, {
                  campaignSearch: undefined,
                  campaignStatus: undefined,
                  campaignPage: undefined,
                }) + '#campagnes-newsletter'
              }
            >
              Effacer
            </Link>
          )}
        </form>
        {campaigns.campaigns.length ? (
          <AdminTable
            caption="Campagnes newsletter"
            headings={['Campagne', 'État', 'Diffusion', 'Ouvrir']}
          >
            {campaigns.campaigns.map((campaign) => {
              const sent = campaign.deliveryCounts.SENT ?? 0;
              const failed = campaign.deliveryCounts.FAILED ?? 0;
              return (
                <tr key={campaign.id}>
                  <td>
                    <Link href={`/admin/newsletter/campagnes/${campaign.id}`}>
                      {campaign.internalName}
                    </Link>
                    <small>{campaign.subject}</small>
                    <span className={ui.kind}>
                      {campaign.chapter
                        ? `Carnet #${String(campaign.chapter.number).padStart(3, '0')}`
                        : 'Campagne boutique'}
                    </span>
                  </td>
                  <td>
                    <Badge
                      value={
                        campaign.status === 'QUEUED'
                          ? 'Programmée'
                          : campaign.status
                      }
                      tone={
                        campaign.status === 'QUEUED' ? 'pending' : undefined
                      }
                    />
                    {campaign.status === 'QUEUED' &&
                      (campaign.nextPendingAt || campaign.scheduledAt) && (
                        <small>
                          À partir du :{' '}
                          {formatDate(
                            campaign.nextPendingAt ?? campaign.scheduledAt,
                          )}
                        </small>
                      )}
                  </td>
                  <td>
                    {campaign.status === 'DRAFT' ? (
                      'Non diffusée'
                    ) : (
                      <>
                        <strong>{sent}</strong> / {campaign.recipientCount}{' '}
                        envoyés
                      </>
                    )}
                    {failed > 0 && (
                      <small className={ui.error}>
                        {failed} échec{failed === 1 ? '' : 's'} à consulter
                      </small>
                    )}
                    {campaign.status === 'DRAFT' && (
                      <small>Audience fixée à la programmation</small>
                    )}
                  </td>
                  <td>
                    <Link
                      className={ui.rowAction}
                      href={
                        campaign.chapter?.editionCampaignId === campaign.id
                          ? `/admin/carnets/${campaign.chapter.id}`
                          : `/admin/newsletter/campagnes/${campaign.id}`
                      }
                    >
                      {campaign.chapter?.editionCampaignId === campaign.id
                        ? campaign.status === 'DRAFT'
                          ? 'Éditer le Carnet'
                          : 'Consulter le Carnet'
                        : 'Ouvrir la campagne'}{' '}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                    <small>Créée le {formatDate(campaign.createdAt)}</small>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        ) : (
          <EmptyState>
            {campaigns.search || campaigns.status
              ? 'Aucune campagne ne correspond à ces filtres. Effacez-les pour retrouver vos éditions.'
              : 'Aucune campagne préparée. Commencez par une nouvelle édition.'}
          </EmptyState>
        )}
        <Pagination
          page={campaigns.page}
          total={campaigns.total}
          params={params}
          path="/admin/newsletter"
          pageKey="campaignPage"
          fragment="campagnes-newsletter"
        />
      </section>
      <details
        id="audience-newsletter"
        className={ui.disclosure}
        open={audienceOpen}
      >
        <summary>
          <Users size={21} aria-hidden="true" />
          <span>
            <h2>Audience &amp; consentements</h2>
            <small>
              {data.counts.ACTIVE ?? 0} actives · {data.counts.PENDING ?? 0} en
              attente de confirmation · {data.counts.UNSUBSCRIBED ?? 0}{' '}
              désinscrites
            </small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className={ui.disclosureBody}>
          <p>
            Seules les adresses actives et confirmées peuvent recevoir une
            campagne.
          </p>
          <FilterPanel
            params={params}
            action="/admin/newsletter"
            fragment="audience-newsletter"
            keep={{
              audience: '1',
              campaignSearch: campaigns.search,
              campaignStatus: campaigns.status,
              campaignPage: String(campaigns.page),
            }}
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
            fragment="audience-newsletter"
          />
          <small>Dates affichées à l’heure de Paris.</small>
        </div>
      </details>
      <section aria-labelledby="technique-newsletter" className={ui.technical}>
        <h2 id="technique-newsletter" className={ui.eyebrow}>
          État technique
        </h2>
        <details
          className={ui.disclosure}
          open={Boolean(param(params, 'technique'))}
        >
          <summary>
            <Settings2 size={21} aria-hidden="true" />
            <span>
              <h3>Automatisations et état du service d’envoi</h3>
              <small>
                {process.env.EMAILS_ENABLED === 'true'
                  ? 'Service email activé'
                  : 'Service email désactivé'}{' '}
                · scénarios, délais et diagnostics
              </small>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className={ui.disclosureBody}>
            <LifecycleEmailStatus />
          </div>
        </details>
      </section>
    </>
  );
}
