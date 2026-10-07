import { requireAdmin } from '@/lib/admin/auth';
import { getPrisma } from '@/lib/db/prisma';
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
import { PageHeader, EmptyState } from '@/components/admin/AdminUI';
import styles from '@/components/admin/Admin.module.scss';
const states = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  PROCESSING: 'Envoi en cours',
  SENT: 'Envoyé',
  RETRY: 'Délai Discord',
  REVIEW: 'À vérifier dans Discord',
  REJECTED: 'Refusé par Discord',
  CANCELLED: 'Annulé',
};
const kinds = {
  release: 'Sorties',
  restock: 'Réassorts',
  announcement: 'Annonces',
  campaign: 'Campagnes',
};
export default async function DiscordAdminPage() {
  await requireAdmin();
  const events = await getPrisma().discordOutbox.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return (
    <>
      <PageHeader
        title="Discord"
        description="Sorties et réassorts automatiques. Annonces et campagnes publiées après votre validation, sans données clients."
      />
      <section className={styles.card} aria-label="Configuration Discord">
        <h2>
          {discordEnabled()
            ? 'Publications activées'
            : 'Publications désactivées'}
        </h2>
        <ul>
          {Object.entries(kinds).map(([kind, label]) => (
            <li key={kind}>
              {label} :{' '}
              {discordConfigured(kind as DiscordPublicationKind)
                ? 'salon configuré'
                : 'salon à configurer'}
            </li>
          ))}
        </ul>
        <p>
          Une sortie nécessite un produit publié marqué « Nouveauté » avec une
          date de sortie renseignée. Un réassort annonce uniquement un ajout
          physique de stock faisant sortir un produit de rupture.
        </p>
      </section>
      <section className={styles.card} aria-label="Préparer une publication">
        <h2>Préparer une annonce ou une campagne</h2>
        <AdminForm
          action={saveDiscordDraftAction}
          submit="Enregistrer le brouillon"
        >
          <SelectField label="Type" name="kind" defaultValue="announcement">
            <option value="announcement">Annonce</option>
            <option value="campaign">Campagne</option>
          </SelectField>
          <Field label="Titre public" name="title" maxLength={160} required />
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
      </section>
      <h2>Publications récentes</h2>
      {!events.length && (
        <EmptyState>Aucune publication Discord pour l’instant.</EmptyState>
      )}
      {events.map((event) => {
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
        return (
          <section
            className={styles.card}
            key={event.id}
            aria-label={event.title}
          >
            <h3>{event.title}</h3>
            <p>
              {states[event.status]} ·{' '}
              {kinds[event.kind as DiscordPublicationKind]} ·{' '}
              {event.createdAt.toLocaleString('fr-FR', {
                timeZone: 'Europe/Paris',
              })}
            </p>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                fontFamily: 'inherit',
              }}
            >
              {preview}
            </pre>
            {event.messageId && <p>Message confirmé : {event.messageId}</p>}
            {event.status === 'DRAFT' && (
              <AdminForm
                action={manageDiscordPublicationAction}
                submit="Mettre en file"
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
            )}
            {['REVIEW', 'REJECTED'].includes(event.status) && (
              <>
                <p>
                  Vérifiez le salon avant toute nouvelle tentative : un envoi
                  incertain peut avoir été accepté.
                </p>
                <AdminForm
                  action={manageDiscordPublicationAction}
                  submit="Réessayer après vérification"
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
                  <AdminForm
                    action={manageDiscordPublicationAction}
                    submit="Confirmer le message existant"
                    guard={false}
                  >
                    <Hidden name="id" value={event.id} />
                    <Hidden name="operation" value="confirm-sent" />
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
                )}
              </>
            )}
            {['DRAFT', 'PENDING', 'RETRY', 'REVIEW', 'REJECTED'].includes(
              event.status,
            ) && (
              <AdminForm
                action={manageDiscordPublicationAction}
                submit="Annuler la publication"
                guard={false}
              >
                <Hidden name="id" value={event.id} />
                <Hidden name="operation" value="cancel" />
              </AdminForm>
            )}
          </section>
        );
      })}
    </>
  );
}
