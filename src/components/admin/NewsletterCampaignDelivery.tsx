'use client';
import { useState } from 'react';
import { CalendarClock, Send, Users } from 'lucide-react';
import { AdminForm } from './AdminForm';
import { queueNewsletterCampaignAction } from '@/lib/newsletter/admin-actions';
import type { CampaignAudience } from '@/lib/newsletter/studio';
import styles from './NewsletterCampaignEditor.module.scss';
const LABELS: Record<CampaignAudience, string> = {
  all: 'Tous les abonnés confirmés',
  recent: 'Confirmés au cours des 30 derniers jours',
  established: 'Abonnés confirmés depuis plus de 30 jours',
};
export function NewsletterCampaignDelivery({
  id,
  audiences,
  issues,
}: {
  id: string;
  audiences: { value: CampaignAudience; count: number }[];
  issues: string[];
}) {
  const [audience, setAudience] = useState<CampaignAudience>('all');
  const [mode, setMode] = useState('now');
  const [date, setDate] = useState('');
  const count = audiences.find((a) => a.value === audience)?.count ?? 0;
  const validDate = date && Number.isFinite(new Date(date).getTime());
  const scheduledAt =
    mode === 'later' && validDate ? new Date(date).toISOString() : '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className={styles.deliveryPanel}>
      <div className={styles.sectionHeading}>
        <span className={styles.eyebrow}>DESTINATAIRES & ENVOI</span>
        <h3>Le bon message, au bon moment.</h3>
        <p>L’audience et le contenu seront figés à la confirmation.</p>
      </div>
      {issues.length > 0 ? (
        <div className={styles.issueList}>
          <strong>Complétez le brouillon avant l’envoi</strong>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : (
        <AdminForm
          action={queueNewsletterCampaignAction}
          guard={false}
          requireSaved
          submitDisabled={count === 0 || (mode === 'later' && !validDate)}
          submit={
            mode === 'later'
              ? 'Programmer la campagne'
              : `Mettre en file pour ${count} abonné${count > 1 ? 's' : ''}`
          }
          confirm={`${mode === 'later' ? `Programmer le début de l’envoi le ${validDate ? new Date(date).toLocaleString('fr-FR') : ''}` : 'Commencer l’envoi'} pour l’audience « ${LABELS[audience]} » (actuellement ${count} abonnés) ? Le contenu ne pourra plus être modifié. Le nombre définitif est recalculé au moment de la confirmation.`}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="scheduledAt" value={scheduledAt} />
          <input type="hidden" name="sendMode" value={mode} />
          <input type="hidden" name="timeZone" value={timezone} />
          <div className={styles.deliveryGrid}>
            <div>
              <h4>
                <Users size={17} /> Audience
              </h4>
              <label>
                Destinataires
                <select
                  name="audience"
                  value={audience}
                  onChange={(e) =>
                    setAudience(e.target.value as CampaignAudience)
                  }
                >
                  {audiences.map((a) => (
                    <option value={a.value} key={a.value}>
                      {LABELS[a.value]} ({a.count})
                    </option>
                  ))}
                </select>
              </label>
              <p>
                <strong>{count}</strong> abonné{count > 1 ? 's' : ''} éligible
                {count > 1 ? 's' : ''} actuellement.
              </p>
              <small>
                Les adresses en attente et désinscrites sont exclues. Le
                consentement est revérifié avant chaque envoi.
              </small>
            </div>
            <div>
              <h4>
                <CalendarClock size={17} /> Moment de l’envoi
              </h4>
              <label>
                Quand envoyer ?
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="now">
                    Dès le prochain passage du planificateur
                  </option>
                  <option value="later">À une date précise</option>
                </select>
              </label>
              {mode === 'later' && (
                <label>
                  Date et heure
                  <input
                    type="datetime-local"
                    name="scheduledLocal"
                    onInput={(e) => setDate(e.currentTarget.value)}
                    onBlur={(e) => setDate(e.currentTarget.value)}
                    value={date}
                    required
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <small>
                    Heure de votre navigateur :{' '}
                    <span suppressHydrationWarning>{timezone}</span>. Entre une
                    minute et 180 jours dans le futur.
                  </small>
                </label>
              )}
              <p>
                <Send size={14} /> Envoi progressif par lots.
              </p>
              <small>
                Le quota fournisseur et les délais anti-sollicitation peuvent
                étaler la réception après l’heure choisie.
              </small>
            </div>
          </div>
          {count === 0 && (
            <p className={styles.notice}>
              Aucun abonné dans cette audience. Choisissez une autre audience ou
              conservez le brouillon. Le serveur empêchera un envoi vide.
            </p>
          )}
        </AdminForm>
      )}
    </div>
  );
}
