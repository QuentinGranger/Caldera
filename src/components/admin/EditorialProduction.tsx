import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  CalendarDays,
  Pencil,
  Eye,
} from 'lucide-react';
import type { EditorialProduction as Production } from '@/lib/carnets/production';
import { testCarnetEditionAction } from '@/lib/carnets/actions';
import { formatDate } from '@/lib/admin/format';
import { AdminForm } from './AdminForm';
import { Badge } from './AdminUI';
import admin from './Admin.module.scss';
import styles from './EditorialProduction.module.scss';

function Check({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail?: string;
}) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className={done ? styles.done : styles.todo}>
      <Icon size={18} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <span className={styles.checkState}>{done ? 'Prêt' : 'À vérifier'}</span>
    </li>
  );
}

export function EditorialProduction({
  data,
  emailsEnabled,
}: {
  data: Production;
  emailsEnabled: boolean;
}) {
  const next = data.next;
  const months = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(data.monthsAhead);
  return (
    <div className={styles.grid}>
      <section className={styles.edition} aria-labelledby="prochaine-edition">
        <div className={styles.topline}>
          <h2 id="prochaine-edition">Prochaine édition</h2>
          <BookOpen size={21} aria-hidden="true" />
        </div>
        {next ? (
          <>
            <div className={styles.titleRow}>
              <h3>
                <span>#{String(next.number).padStart(3, '0')}</span> —{' '}
                {next.title}
              </h3>
              {next.campaignStatus && <Badge value={next.campaignStatus} />}
            </div>
            <p className={styles.arc}>
              {next.arcTitle ? (
                <>
                  Arc : {next.arcTitle}
                  {next.arcPosition && next.arcTotal
                    ? ` · ${next.arcPosition}/${next.arcTotal}`
                    : ''}
                </>
              ) : (
                'Arc non renseigné'
              )}
            </p>
            <div className={styles.nextAction}>
              <span>Votre prochaine action</span>
              <Link
                href={
                  next.campaignStatus === 'QUEUED' && next.campaignId
                    ? `/admin/newsletter/campagnes/${next.campaignId}`
                    : `/admin/carnets/${next.id}${!next.chapterReady ? '#carnet-recit' : !next.illustrationReady ? '#carnet-recit' : next.unavailable.length ? '#carnet-comptoir' : !next.emailReady ? '#carnet-email' : '#carnet-verification'}`
                }
              >
                {next.campaignStatus === 'QUEUED'
                  ? 'Suivre la programmation'
                  : !next.chapterReady
                    ? 'Compléter le récit'
                    : !next.illustrationReady
                      ? 'Ajouter l’illustration et son alt'
                      : next.unavailable.length
                        ? 'Vérifier les produits du Comptoir'
                        : !next.emailReady
                          ? 'Compléter l’email'
                          : !next.testCurrent
                            ? 'Vérifier et tester l’édition'
                            : 'Ouvrir la vérification finale'}{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ul className={styles.checklist}>
              <Check
                done={next.chapterReady}
                label="Chapitre prêt"
                detail={
                  next.chapterReady
                    ? undefined
                    : 'Vérifiez le récit, sa coupure et le statut Prêt.'
                }
              />
              <Check
                done={next.excerptReady}
                label="Extrait newsletter prêt"
                detail={`${next.excerptWords} mot${next.excerptWords === 1 ? '' : 's'}`}
              />
              <Check
                done={next.illustrationReady}
                label="Illustration présente"
                detail={
                  next.illustrationReady
                    ? undefined
                    : 'Image et texte alternatif nécessaires.'
                }
              />
              <Check
                done={!next.unavailable.length}
                label="Produits du Comptoir disponibles"
                detail={
                  next.productCount
                    ? `${next.productCount} produit${next.productCount === 1 ? '' : 's'} · stock vérifié à l’ouverture de cette page`
                    : 'Comptoir vide · facultatif'
                }
              />
              <Check
                done={next.testCurrent}
                label="Test email envoyé"
                detail={
                  next.lastTestAt
                    ? `${next.testCurrent ? 'Dernier test' : 'Édition modifiée depuis le test'} : ${formatDate(next.lastTestAt)}`
                    : 'Aucun test enregistré pour cette édition.'
                }
              />
            </ul>
            {!!next.unavailable.length && (
              <p className={styles.warning} role="alert">
                Envoi bloqué :{' '}
                {next.unavailable
                  .map((p) => `${p.name} (${p.reason})`)
                  .join(', ')}
                . Remplacez ou supprimez ces produits dans le Comptoir.
              </p>
            )}
            {!next.emailReady && (
              <p className={styles.warning}>
                Complétez l’objet et le preheader dans l’éditeur avant le test.
              </p>
            )}
            {next.customized && (
              <p className={styles.note}>
                Email personnalisé : vérifiez aussi sa composition dans
                l’aperçu.
              </p>
            )}
            <dl className={styles.dates}>
              <div>
                <dt>
                  <CalendarDays size={15} aria-hidden="true" />
                  Newsletter
                </dt>
                <dd>
                  {next.newsletterAt ? (
                    <time dateTime={next.newsletterAt.toISOString()}>
                      {formatDate(next.newsletterAt)}
                    </time>
                  ) : (
                    'À planifier'
                  )}
                </dd>
              </div>
              <div>
                <dt>Publication publique</dt>
                <dd>
                  {next.publicAt ? (
                    <time dateTime={next.publicAt.toISOString()}>
                      {formatDate(next.publicAt)}
                    </time>
                  ) : (
                    'À planifier'
                  )}
                </dd>
              </div>
            </dl>
            <p className={styles.note}>
              Heure de Paris · les dates d’un brouillon restent prévisionnelles
              jusqu’à sa programmation.
            </p>
            <div className={styles.actions}>
              <Link className={admin.button} href={`/admin/carnets/${next.id}`}>
                <Pencil size={15} aria-hidden="true" />
                {next.campaignStatus === 'QUEUED' ? 'Consulter' : 'Modifier'}
              </Link>
              <Link
                className={`${admin.button} ${admin.secondaryButton}`}
                href={`/admin/carnets/${next.id}#carnet-email`}
              >
                <Eye size={15} aria-hidden="true" />
                Prévisualiser
              </Link>
              <AdminForm
                action={testCarnetEditionAction}
                guard={false}
                submit="M’envoyer un test"
                pendingLabel="Envoi du test…"
                submitDisabled={!next.canTest || !emailsEnabled}
              >
                <input type="hidden" name="id" value={next.id} />
                <input type="hidden" name="revision" value={next.revision} />
                <input
                  type="hidden"
                  name="campaignUpdatedAt"
                  value={next.campaignUpdatedAt ?? ''}
                />
              </AdminForm>
            </div>
            {!emailsEnabled && (
              <p className={styles.note}>
                Envoi d’emails désactivé dans cet environnement.
              </p>
            )}
            {!next.campaignUpdatedAt && (
              <p className={styles.note}>
                Enregistrez l’édition dans l’éditeur Carnet pour activer son
                test email.
              </p>
            )}
          </>
        ) : (
          <div className={styles.empty}>
            <BookOpen size={32} aria-hidden="true" />
            <h3>Aucun Carnet en préparation</h3>
            <p>
              Préparez votre prochain récit, puis son extrait et sa diffusion.
            </p>
            <Link className={admin.button} href="/admin/carnets/nouveau">
              Créer un Carnet <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>
      <section className={styles.advance} aria-labelledby="avance-editoriale">
        <h2 id="avance-editoriale">Avance éditoriale</h2>
        <p className={styles.count}>
          {data.readyCount}
          <span>
            chapitre{data.readyCount === 1 ? '' : 's'} prêt
            {data.readyCount === 1 ? '' : 's'}
          </span>
        </p>
        <p className={styles.months}>
          = <strong>{months} mois</strong> d’avance
        </p>
        <progress
          max={6}
          value={Math.min(data.readyCount, 6)}
          aria-label={`${months} mois d’avance éditoriale ; repère visuel de 3 mois`}
        />
        <div className={styles.scale}>
          <span>0</span>
          <span>Repère : 3 mois</span>
        </div>
        <p className={styles.note}>
          Base : 2 Carnets par mois. Seuls les chapitres marqués « Prêt », dont
          la diffusion n’a pas commencé, sont comptés.
        </p>
        <p className={styles.note}>
          La checklist de chaque édition reste à valider avant l’envoi.
        </p>
        <div className={styles.reserveLinks}>
          <Link className={styles.reserveLink} href="/admin/carnets/calendrier">
            <CalendarDays size={16} aria-hidden="true" />
            Planifier les prochaines éditions
          </Link>
          <Link className={styles.reserveLink} href="/admin/carnets">
            Voir les Carnets <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
