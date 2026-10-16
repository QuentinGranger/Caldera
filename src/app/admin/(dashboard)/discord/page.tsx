import { CommunicationAnchor } from '@/components/admin/CommunicationAnchor';
import Link from 'next/link';
import {
  FileEdit,
  Send,
  Clock3,
  CircleAlert,
  ChevronDown,
  Settings2,
  Plus,
} from 'lucide-react';
import {
  getDiscordPublicationList,
  DISCORD_STATES as states,
  DISCORD_VIEWS,
} from '@/lib/admin/communication-queries';
import { adminListHref } from '@/lib/admin/list-url';
import { param, type SearchParams } from '@/lib/admin/queries';
import { formatDate } from '@/lib/admin/format';
import { discordConfigured, discordEnabled } from '@/lib/discord/outbox';
import {
  saveDiscordDraftAction,
  manageDiscordPublicationAction,
} from '@/lib/discord/admin-actions';
import {
  renderDiscordPublication,
  type DiscordPublicationKind,
} from '@/lib/discord/publication';
import { siteOrigin } from '@/lib/site';
import { AdminForm } from '@/components/admin/AdminForm';
import {
  Field,
  Hidden,
  TextField,
  Check,
  SelectField,
} from '@/components/admin/AdminFields';
import {
  PageHeader,
  EmptyState,
  Badge,
  Pagination,
} from '@/components/admin/AdminUI';
import { FilterPanel } from '@/components/admin/FilterPanel';
import styles from '@/components/admin/Admin.module.scss';
import ui from '@/components/admin/Communication.module.scss';
const kinds = {
  release: 'Sorties',
  restock: 'Réassorts',
  announcement: 'Annonces',
  campaign: 'Campagnes',
};
export default async function DiscordAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getDiscordPublicationList(params);
  const enabled = discordEnabled();
  const configured = Object.keys(kinds).filter((kind) =>
    discordConfigured(kind as DiscordPublicationKind),
  ).length;
  const href = (view: string) =>
    adminListHref('/admin/discord', params, {
      view: view === 'all' ? undefined : view,
    }) + '#publications-discord';
  return (
    <>
      <CommunicationAnchor
        targets={[
          'publications-discord',
          'discord-composer',
          'discord-configuration',
          ...data.events.map((event) => `discord-${event.id}`),
        ]}
        revision={JSON.stringify(params)}
      />
      <PageHeader
        title="Discord"
        description="Préparez vos annonces, relisez-les et suivez leur publication dans les salons Caldera."
      >
        <Link
          className={styles.button}
          href={
            adminListHref('/admin/discord', params, { compose: '1' }) +
            '#discord-composer'
          }
        >
          <Plus size={16} aria-hidden="true" />
          Préparer une publication
        </Link>
      </PageHeader>
      <div className={ui.channelStatus}>
        <div>
          <strong>
            {enabled ? 'Publications activées' : 'Publications désactivées'}
          </strong>
          <p>
            {configured}/4 salons configurés · les brouillons nécessitent votre
            validation avant envoi.
          </p>
        </div>
        <a href="#discord-configuration" className={ui.textLink}>
          Voir la configuration
        </a>
      </div>
      <nav className={ui.metrics} aria-label="Repères Discord">
        {[
          {
            label: 'Brouillons',
            count: data.counts.drafts,
            view: 'drafts',
            icon: FileEdit,
            note: 'À relire et valider',
          },
          {
            label: 'En file',
            count: data.counts.queue,
            view: 'queue',
            icon: Clock3,
            note: 'En attente ou en cours',
          },
          {
            label: 'À vérifier',
            count: data.counts.review,
            view: 'review',
            icon: CircleAlert,
            note: 'Vérification dans Discord',
          },
          {
            label: 'Envoyées',
            count: data.counts.sent,
            view: 'sent',
            icon: Send,
            note: 'Messages confirmés',
          },
        ].map(({ label, count, view, icon: Icon, note }) => (
          <Link key={view} href={href(view)}>
            <span>
              <Icon size={17} aria-hidden="true" />
              {label}
            </span>
            <strong>{count}</strong>
            <small>{note}</small>
          </Link>
        ))}
      </nav>
      <div className={ui.discordGrid}>
        <section className={ui.section} aria-labelledby="publications-discord">
          <div className={ui.sectionHeader}>
            <div>
              <span className={ui.eyebrow}>Journal des publications</span>
              <h2 id="publications-discord">Publications récentes</h2>
              <p>
                {data.total} publication{data.total === 1 ? '' : 's'}
                {data.view !== 'all' || data.search
                  ? ' dans cette sélection'
                  : ''}{' '}
                · heure de Paris.
              </p>
            </div>
          </div>
          <nav
            className={ui.viewTabs}
            aria-label="Vues des publications Discord"
          >
            {Object.entries(DISCORD_VIEWS).map(([value, label]) => (
              <Link
                key={value}
                href={href(value)}
                aria-current={data.view === value ? 'page' : undefined}
              >
                {label}
                <b>{data.counts[value as keyof typeof DISCORD_VIEWS]}</b>
              </Link>
            ))}
          </nav>
          <FilterPanel
            action="/admin/discord"
            fragment="publications-discord"
            params={params}
            search={data.search}
            placeholder="Titre ou résumé d’une publication"
            keep={{ view: data.view === 'all' ? '' : data.view }}
          />
          {!data.events.length ? (
            <EmptyState>
              {data.view === 'all' && !data.search
                ? 'Aucune publication Discord pour l’instant. Préparez une première annonce depuis le panneau ci-contre.'
                : 'Aucune publication dans cette sélection. Consultez les autres vues ou effacez la recherche.'}
            </EmptyState>
          ) : (
            <ol className={ui.publications}>
              {data.events.map((event) => {
                let preview = '';
                try {
                  preview = renderDiscordPublication(
                    {
                      kind: event.kind as DiscordPublicationKind,
                      title: event.title,
                      summary: event.summary,
                      path: event.path,
                    },
                    siteOrigin(),
                  ).content;
                } catch {
                  preview = 'Contenu invalide : annulez cette publication.';
                }
                const review = ['REVIEW', 'REJECTED'].includes(event.status);
                const canSend =
                  enabled &&
                  discordConfigured(event.kind as DiscordPublicationKind);
                return (
                  <li key={event.id}>
                    <article
                      id={`discord-${event.id}`}
                      className={ui.publication}
                      data-review={review || undefined}
                      aria-label={event.title}
                    >
                      <div className={ui.publicationMeta}>
                        <Badge
                          value={states[event.status]}
                          tone={
                            review
                              ? 'pending'
                              : event.status === 'SENT'
                                ? 'success'
                                : event.status === 'PROCESSING'
                                  ? 'info'
                                  : 'neutral'
                          }
                        />
                        <span>
                          {kinds[event.kind as DiscordPublicationKind] ??
                            event.kind}
                        </span>
                        <time dateTime={event.createdAt.toISOString()}>
                          Créée le {formatDate(event.createdAt)}
                        </time>
                      </div>
                      <h3>{event.title}</h3>
                      <p>{event.summary}</p>
                      {['PENDING', 'RETRY'].includes(event.status) && (
                        <p>
                          Prochaine tentative éligible :{' '}
                          {formatDate(event.nextAttemptAt)}
                        </p>
                      )}
                      <details open={event.status === 'DRAFT' || review}>
                        <summary>Aperçu du message et actions</summary>
                        <pre>{preview}</pre>
                        {event.messageId && (
                          <p>
                            Message confirmé : <code>{event.messageId}</code>
                          </p>
                        )}
                        {review && (
                          <p className={ui.notice}>
                            Vérifiez le salon avant toute nouvelle tentative :
                            un envoi incertain peut avoir été accepté.
                          </p>
                        )}
                        <div className={ui.inlineForms}>
                          {event.status === 'DRAFT' && (
                            <>
                              <AdminForm
                                action={manageDiscordPublicationAction}
                                submit="Mettre en file"
                                submitDisabled={!canSend}
                                guard={false}
                                confirm="Publier ce contenu dans le salon Discord configuré ?"
                              >
                                <Hidden name="id" value={event.id} />
                                <Hidden name="operation" value="queue" />
                                <Check
                                  name="reviewed"
                                  label="J’ai relu ce contenu public et vérifié son lien."
                                />
                              </AdminForm>
                              {!canSend && (
                                <p>
                                  La mise en file est suspendue : activez les
                                  publications et configurez ce salon.
                                </p>
                              )}
                            </>
                          )}
                          {review && (
                            <>
                              <AdminForm
                                action={manageDiscordPublicationAction}
                                submit="Réessayer après vérification"
                                submitDisabled={!canSend}
                                guard={false}
                                confirm="Confirmez que ce message n’existe pas déjà dans Discord."
                              >
                                <Hidden name="id" value={event.id} />
                                <Hidden name="operation" value="retry" />
                                <Check
                                  name="reviewed"
                                  label="J’ai vérifié dans Discord : aucun message n’a été publié."
                                />
                              </AdminForm>
                              {event.status === 'REVIEW' && (
                                <details>
                                  <summary>
                                    Le message existe déjà dans Discord
                                  </summary>
                                  <AdminForm
                                    action={manageDiscordPublicationAction}
                                    submit="Confirmer le message existant"
                                    guard={false}
                                  >
                                    <Hidden name="id" value={event.id} />
                                    <Hidden
                                      name="operation"
                                      value="confirm-sent"
                                    />
                                    <Field
                                      label="Identifiant du message Discord existant"
                                      name="messageId"
                                      required
                                      pattern="[0-9]{15,25}"
                                    />
                                    <Check
                                      name="reviewed"
                                      label="J’ai retrouvé ce message dans le salon attendu."
                                    />
                                  </AdminForm>
                                </details>
                              )}
                            </>
                          )}
                          {[
                            'DRAFT',
                            'PENDING',
                            'RETRY',
                            'REVIEW',
                            'REJECTED',
                          ].includes(event.status) && (
                            <details>
                              <summary>Annuler cette publication</summary>
                              <AdminForm
                                action={manageDiscordPublicationAction}
                                submit="Annuler la publication"
                                guard={false}
                                tone="danger"
                                confirm="Annuler cette publication Discord ? Elle ne sera plus envoyée."
                              >
                                <Hidden name="id" value={event.id} />
                                <Hidden name="operation" value="cancel" />
                              </AdminForm>
                            </details>
                          )}
                        </div>
                      </details>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
          <Pagination
            path="/admin/discord"
            page={data.page}
            total={data.total}
            params={params}
            fragment="publications-discord"
          />
        </section>
        <aside
          className={ui.composer}
          id="discord-composer"
          aria-labelledby="discord-composer-title"
        >
          <span className={ui.eyebrow}>Composer</span>
          <h2 id="discord-composer-title">Une annonce à partager ?</h2>
          <p>
            Enregistrez un brouillon, relisez son aperçu, puis validez sa mise
            en file. Rien n’est publié à la sauvegarde.
          </p>
          <details open={!data.counts.all || param(params, 'compose') === '1'}>
            <summary>Préparer une annonce ou une campagne</summary>
            <AdminForm
              action={saveDiscordDraftAction}
              submit="Enregistrer le brouillon"
            >
              <SelectField label="Type" name="kind" defaultValue="announcement">
                <option value="announcement">Annonce</option>
                <option value="campaign">Campagne</option>
              </SelectField>
              <Field
                label="Titre public"
                name="title"
                maxLength={160}
                required
              />
              <TextField
                label="Résumé public — aucune donnée personnelle"
                name="summary"
                maxLength={600}
              />
              <Field
                label="Lien interne public (ex. /catalogue)"
                name="path"
                defaultValue="/"
                maxLength={200}
                required
              />
            </AdminForm>
          </details>
        </aside>
      </div>
      <details className={ui.disclosure} id="discord-configuration">
        <summary>
          <Settings2 size={21} aria-hidden="true" />
          <span>
            <h2>Configuration Discord</h2>
            <small>
              {configured}/4 salons configurés · sorties et réassorts
              automatiques
            </small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className={ui.disclosureBody}>
          <ul className={ui.channels}>
            {Object.entries(kinds).map(([kind, label]) => (
              <li key={kind}>
                <strong>{label}</strong>
                <small>
                  {discordConfigured(kind as DiscordPublicationKind)
                    ? 'Salon configuré'
                    : 'Salon à configurer'}
                </small>
              </li>
            ))}
          </ul>
          <p>
            Une sortie nécessite un produit publié marqué « Nouveauté » avec une
            date de sortie renseignée. Un réassort annonce uniquement un ajout
            physique de stock faisant sortir un produit de rupture.
          </p>
          <p>
            Les publications ne contiennent pas de données clients. Les accès au
            bot et aux webhooks sont gérés côté serveur.
          </p>
        </div>
      </details>
    </>
  );
}
