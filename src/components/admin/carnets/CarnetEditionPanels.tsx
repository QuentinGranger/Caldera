'use client';
import Link from 'next/link';
import { renderNewsletterCampaignEmail } from '@/emails/newsletter-campaign';
import { carnetEmailContent } from '@/lib/carnets/email';
import { deriveCarnet, carnetCta } from '@/lib/carnets/content';
import { carnetPublicLocal } from '@/lib/carnets/dates';
import type { CarnetEditorValue } from '@/lib/carnets/admin';
import type { CarnetProduct } from '@/lib/carnets/comptoir';
import { NewsletterEmailPreview } from '../NewsletterEmailPreview';
import { AdminForm } from '../AdminForm';
import {
  advancedCarnetEditionAction,
  automaticCarnetEditionAction,
  testCarnetEditionAction,
  queueCarnetEditionAction,
  cancelCarnetEditionAction,
} from '@/lib/carnets/actions';
import { CarnetDiffusion } from './CarnetDiffusion';
import styles from './CarnetEditor.module.scss';
export type PreviewDevice = 'desktop' | 'mobile' | 'text';
export function CarnetEmailPanel({
  value,
  products,
  onChange,
  device,
  onDevice,
  readOnly = false,
}: {
  value: CarnetEditorValue;
  products: CarnetProduct[];
  onChange?: (key: 'emailSubject' | 'emailPreheader', next: string) => void;
  device: PreviewDevice;
  onDevice: (device: PreviewDevice) => void;
  readOnly?: boolean;
}) {
  const selected = (value.productIds ?? []).flatMap((id) => {
    const p = products.find((p) => p.id === id);
    return p ? [p] : [];
  });
  const campaign = value.campaign;
  const email = {
    subject: value.emailSubject ?? '',
    preheader: value.emailPreheader ?? '',
  };
  const content = campaign?.customized
    ? { ...campaign, ...email, campaignId: campaign.id }
    : {
        ...carnetEmailContent(
          value,
          readOnly && campaign?.products.length ? campaign.products : selected,
          email,
        ),
        campaignId: campaign?.id,
      };
  const rendered = renderNewsletterCampaignEmail(content, {
    logo: '/assets/brand/logo-header-no-bg.png',
  });
  return (
    <section
      id="carnet-email"
      className={styles.workflowSection}
      aria-labelledby="email-title"
    >
      <span className={styles.eyebrow}>03 / EMAIL</span>
      <h2 id="email-title">L’édition dans la boîte mail</h2>
      {campaign?.customized && (
        <p className={styles.notice}>
          Email personnalisé dans le Campaign Studio. Le récit et le Comptoir
          ci-dessus ne modifient pas cette composition. L’objet et le preheader
          restent partagés.
        </p>
      )}
      <div className={styles.emailFields}>
        <label>
          Objet de l’email
          <input
            name="emailSubject"
            value={email.subject}
            maxLength={160}
            readOnly={readOnly}
            onChange={(e) => onChange?.('emailSubject', e.target.value)}
            placeholder="Quand le lac recula — Carnet #001"
          />
        </label>
        <label>
          Preheader
          <input
            name="emailPreheader"
            value={email.preheader}
            maxLength={180}
            readOnly={readOnly}
            onChange={(e) => onChange?.('emailPreheader', e.target.value)}
            placeholder="Une ouverture sur ce nouvel épisode…"
          />
        </label>
      </div>
      <p>
        Le test utilise la dernière version enregistrée. Une image importée
        apparaît dans l’email après sauvegarde. Le lien d’accès anticipé sera
        signé lors de la diffusion.
      </p>
      <NewsletterEmailPreview
        rendered={rendered}
        subject={email.subject}
        preheader={email.preheader}
        device={device}
        onDevice={onDevice}
        downloadable={false}
      />
    </section>
  );
}
export function CarnetSchedulePanel({
  value,
  onChange,
  readOnly = false,
}: {
  value: CarnetEditorValue;
  onChange?: (next: string) => void;
  readOnly?: boolean;
}) {
  const date = value.earlyAccessAt ?? '',
    publicAt = readOnly ? value.publicAt : carnetPublicLocal(date);
  return (
    <section
      id="carnet-diffusion"
      className={styles.workflowSection}
      aria-labelledby="diffusion-title"
    >
      <span className={styles.eyebrow}>04 / DIFFUSION</span>
      <h2 id="diffusion-title">Une date, deux rendez-vous</h2>
      {!readOnly && (
        <label>
          Envoi aux abonnés · heure de Paris
          <input
            name="earlyAccessAt"
            type="datetime-local"
            value={date}
            min="2000-01-01T00:00"
            max="2099-12-31T23:59"
            onInput={(e) => onChange?.(e.currentTarget.value)}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </label>
      )}
      <CarnetDiffusion
        early={date}
        publicAt={publicAt}
        frozen={Boolean(value.publishedAt)}
        campaignId={value.releaseCampaignId}
      />
      {!readOnly && date && !publicAt && (
        <p role="alert">
          Date invalide ou heure ambiguë à Paris : choisissez un autre horaire.
        </p>
      )}
      <p>
        Tous les abonnés confirmés · envoi progressif par le planificateur
        existant. La sauvegarde prépare la date ; seul « Programmer » active la
        diffusion.
      </p>
    </section>
  );
}
function EditionReferences({ value }: { value: CarnetEditorValue }) {
  return (
    <>
      <input type="hidden" name="id" value={value.id ?? ''} />
      <input type="hidden" name="revision" value={value.revision} />
      <input
        type="hidden"
        name="campaignUpdatedAt"
        value={value.campaign?.updatedAt ?? ''}
      />
    </>
  );
}
export function CarnetVerification({
  value,
  products,
  dirty,
  viewed,
  onPreview,
  readOnly = false,
}: {
  value: CarnetEditorValue;
  products: CarnetProduct[];
  dirty: boolean;
  viewed: { desktop: boolean; mobile: boolean };
  onPreview: (device: PreviewDevice) => void;
  readOnly?: boolean;
}) {
  const derived = deriveCarnet(value.content),
    ids = value.productIds ?? [];
  const checks: [string, boolean][] = [
    ['Titre renseigné', Boolean(value.title.trim())],
    ['Arc renseigné (facultatif)', Boolean(value.arcTitle.trim())],
    [
      'Image principale et texte alternatif',
      Boolean(value.illustrationUrl && value.illustrationAlt?.trim()),
    ],
    [
      'Récit avant et après la coupure',
      Boolean(
        derived.excerpt?.words && derived.full.words > derived.excerpt.words,
      ),
    ],
    ['Statut prêt éditorialement', value.status === 'READY'],
    [
      `Extrait : ${derived.excerpt?.words ?? 0} mots · repère 250–400`,
      Boolean(derived.excerpt?.words),
    ],
    [
      `Chapitre : ${derived.full.words} mots · repère 900–1 100`,
      derived.full.words > 0,
    ],
    ['Objet email', Boolean(value.emailSubject?.trim())],
    ['Preheader', Boolean(value.emailPreheader?.trim())],
    [
      'CTA généré : Continuer l’expédition',
      !value.campaign?.customized &&
        Boolean(carnetCta(value.slug).href && value.slug),
    ],
    [
      ids.length
        ? `${ids.length} produit${ids.length > 1 ? 's' : ''} disponible${ids.length > 1 ? 's' : ''}`
        : 'Comptoir vide (facultatif)',
      ids.every((id) => products.some((p) => p.id === id && p.eligible)),
    ],
    [
      'Date d’envoi et publication à J+14',
      Boolean(value.earlyAccessAt && carnetPublicLocal(value.earlyAccessAt)),
    ],
    ['Aperçu ordinateur ouvert pour cette version', viewed.desktop],
    ['Aperçu mobile ouvert pour cette version', viewed.mobile],
  ];
  const ready = Boolean(
    value.campaign &&
    value.status === 'READY' &&
    value.illustrationUrl &&
    value.illustrationAlt?.trim() &&
    derived.excerpt?.words &&
    derived.full.words > derived.excerpt.words &&
    value.emailSubject?.trim() &&
    value.emailPreheader?.trim() &&
    ids.every((id) => products.some((p) => p.id === id && p.eligible)),
  );
  return (
    <>
      <section
        id="carnet-verification"
        className={styles.workflowSection}
        aria-labelledby="verification-title"
      >
        <span className={styles.eyebrow}>05 / VÉRIFICATION</span>
        <h2 id="verification-title">La dernière lecture avant le départ</h2>
        <ul className={styles.checklist}>
          {checks.map(([label, ok]) => (
            <li key={label} data-ok={ok}>
              <span aria-hidden="true">{ok ? '✓' : '○'}</span>
              <span>
                <span className={styles.srOnly}>
                  {ok ? 'Vérifié : ' : 'À vérifier : '}
                </span>
                {label}
              </span>
            </li>
          ))}
        </ul>
        <p>
          Ouvrir un aperçu ne confirme pas sa qualité. Relisez le contenu, les
          liens et les informations commerciales. Les longueurs recommandées
          restent indicatives.
        </p>
        <div className={styles.panelActions}>
          <button type="button" onClick={() => onPreview('desktop')}>
            Aperçu ordinateur
          </button>
          <button type="button" onClick={() => onPreview('mobile')}>
            Aperçu mobile
          </button>
        </div>
        {dirty && (
          <p role="status" className={styles.notice}>
            Modifications non enregistrées : sauvegardez avant de tester,
            programmer ou ouvrir le Studio.
          </p>
        )}
        {value.campaign ? (
          <div className={styles.panelActions}>
            <AdminForm
              action={testCarnetEditionAction}
              guard={false}
              requireSaved
              submit="M’envoyer un test"
              submitDisabled={dirty || !ready}
            >
              <EditionReferences value={value} />
            </AdminForm>
            {!readOnly && (
              <AdminForm
                action={queueCarnetEditionAction}
                guard={false}
                requireSaved
                submit="Programmer"
                submitDisabled={
                  dirty ||
                  !ready ||
                  !value.earlyAccessAt ||
                  !carnetPublicLocal(value.earlyAccessAt)
                }
                confirm="Programmer cette édition pour tous les abonnés confirmés ? Le récit et la composition seront figés. La publication publique suivra automatiquement 14 jours plus tard."
              >
                <EditionReferences value={value} />
              </AdminForm>
            )}
            {value.campaign.status === 'QUEUED' && !value.publishedAt && (
              <AdminForm
                action={cancelCarnetEditionAction}
                guard={false}
                submit="Annuler la programmation"
                confirm="Annuler avant le début de l’envoi et reprendre le brouillon ?"
              >
                <EditionReferences value={value} />
              </AdminForm>
            )}
            <Link href={`/admin/newsletter/campagnes/${value.campaign.id}`}>
              Suivi de la campagne
            </Link>
          </div>
        ) : (
          <p>
            Enregistrez le Carnet pour créer sa campagne et activer les tests et
            la programmation.
          </p>
        )}
      </section>
      {!readOnly && (
        <details className={styles.advanced}>
          <summary>
            Mode avancé
            {value.campaign?.customized ? ' · email personnalisé' : ''}
          </summary>
          <p>
            Utilisez le Campaign Studio uniquement pour les éditions nécessitant
            une composition exceptionnelle. Le chapitre original reste géré dans
            le Carnet. Les changements du récit ne seront pas reportés
            automatiquement dans l’email personnalisé.
          </p>
          {value.campaign && (
            <AdminForm
              action={advancedCarnetEditionAction}
              guard={false}
              requireSaved
              submit="Ouvrir dans le Campaign Studio"
              submitDisabled={dirty}
              confirm={
                value.campaign.customized
                  ? undefined
                  : 'Créer une composition indépendante depuis la dernière édition enregistrée ? Le récit original restera inchangé.'
              }
            >
              <EditionReferences value={value} />
            </AdminForm>
          )}
          {value.campaign?.customized && (
            <AdminForm
              action={automaticCarnetEditionAction}
              guard={false}
              requireSaved
              submit="Rétablir le format automatique"
              submitDisabled={dirty}
              confirm="Remplacer la composition personnalisée par le format automatique du Carnet ? Les personnalisations email seront supprimées ; le récit sera conservé."
            >
              <EditionReferences value={value} />
            </AdminForm>
          )}
        </details>
      )}
    </>
  );
}
