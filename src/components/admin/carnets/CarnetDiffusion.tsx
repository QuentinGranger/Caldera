import styles from './CarnetEditor.module.scss';
function display(value?: string) {
  if (!value) return 'À programmer';
  const d = new Date(value.endsWith('Z') ? value : `${value}:00Z`);
  if (!Number.isFinite(d.getTime())) return 'Date à compléter';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: value.endsWith('Z') ? 'Europe/Paris' : 'UTC',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}
export function CarnetDiffusion({
  early,
  publicAt,
  frozen,
  campaignId,
}: {
  early?: string;
  publicAt?: string;
  frozen?: boolean;
  campaignId?: string;
}) {
  return (
    <section className={styles.diffusion} aria-label="Diffusion du Carnet">
      <span>DIFFUSION · HEURE DE PARIS</span>
      <h2>Quatorze jours d’avance.</h2>
      <div>
        <p>
          Avant-première abonnés<strong>{display(early)}</strong>
        </p>
        <span aria-hidden="true">↓</span>
        <p>
          Publication publique<strong>{display(publicAt)}</strong>
          <small>Automatique · +14 jours</small>
        </p>
      </div>
      <p>
        {frozen
          ? 'Calendrier figé · l’envoi a commencé.'
          : campaignId
            ? 'Programmé · annulez puis reprogrammez la campagne avant son premier envoi pour changer les dates.'
            : 'Prévision éditoriale · programmez une campagne liée pour activer la diffusion.'}
      </p>
      {campaignId && (
        <a href={`/admin/newsletter/campagnes/${campaignId}`}>
          Ouvrir la campagne de diffusion →
        </a>
      )}
    </section>
  );
}
