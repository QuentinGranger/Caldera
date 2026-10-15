'use client';
import Link from 'next/link';
import { renderNewsletterCampaignEmail } from '@/emails/newsletter-campaign';
import { carnetEmailContent } from '@/lib/carnets/email';
import { carnetUrl } from '@/lib/carnets/content';
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
import { carnetChecklist, type DepartureCheck } from '@/lib/carnets/readiness';
import { parseCarnetDate } from '@/lib/carnets/dates';
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
    ? {
        ...campaign,
        ...email,
        campaignId: campaign.id,
        carnetLinks: {
          number: value.number,
          storyPath: carnetUrl(value.slug),
          products: campaign.products,
        },
      }
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
        signé lors de la diffusion. Les paramètres de suivi du récit et des
        trois positions du Comptoir sont générés automatiquement ; aucune saisie
        UTM n’est nécessaire.
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
  verification,
}: {
  verification?: CarnetEditorValue['verification'];
  value: CarnetEditorValue;
  products: CarnetProduct[];
  dirty: boolean;
  viewed: { desktop: boolean; mobile: boolean };
  onPreview: (device: PreviewDevice) => void;
  readOnly?: boolean;
}) {
  const ids = value.productIds ?? [];
  const selected = ids.map(
    (id) =>
      products.find((p) => p.id === id) ?? {
        id,
        name: 'Produit introuvable',
        eligible: false,
        unavailableReason: 'référence introuvable',
      },
  );
  const date = (input?: string) => {
    try {
      return parseCarnetDate(input ?? '', 'Diffusion') ?? null;
    } catch {
      return null;
    }
  };
  const proof = verification ?? {
    testCurrent: false,
    accessConfigured: false,
    testSentAt: null,
  };
  const checklist = carnetChecklist(
    {
      ...value,
      updatedAt: new Date(0),
      illustrationUrl: value.illustrationUrl ?? null,
      illustrationAlt: value.illustrationAlt ?? null,
      earlyAccessAt: date(value.earlyAccessAt),
      publicAt: date(
        value.publicAt ?? carnetPublicLocal(value.earlyAccessAt ?? ''),
      ),
      publishedAt: value.publishedAt ? new Date(value.publishedAt) : null,
    },
    value.campaign
      ? {
          ...value.campaign,
          carnetCustomized: value.campaign.customized,
          subject: value.emailSubject ?? '',
          preheader: value.emailPreheader ?? '',
          updatedAt: new Date(value.campaign.updatedAt),
        }
      : null,
    selected,
    { ...proof, dirty },
  );
  const ready = checklist.canSchedule;
  function fix(action: NonNullable<DepartureCheck['action']>) {
    const selectors = {
      recit: '[name="status"]',
      coupure: '#carnet-coupure',
      illustration: '[name="illustrationAlt"]',
      comptoir: '#carnet-comptoir',
      email: '#carnet-email',
      diffusion: '#carnet-diffusion',
      test: '#carnet-test button[type="submit"]',
    };
    const target = document.querySelector<HTMLElement>(
      selectors[action.target],
    );
    if (!target) return;
    let parent = target.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    target.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'center',
    });
    if (action.target === 'test') {
      (target as HTMLButtonElement).click();
      return;
    }
    (target.matches('input,select,button')
      ? target
      : target.querySelector<HTMLElement>(
          'input,select,button,[contenteditable="true"]',
        )
    )?.focus({ preventScroll: true });
  }
  return (
    <>
      <section
        id="carnet-verification"
        className={styles.workflowSection}
        aria-labelledby="verification-title"
      >
        <span className={styles.eyebrow}>05 / VÉRIFICATION</span>
        <h2 id="verification-title">La dernière lecture avant le départ</h2>
        <p className={styles.checkLegend}>
          ✓ Conforme · ⚠ À corriger (conseil) · ✕ Bloquant
        </p>
        <ul
          className={styles.checklist}
          aria-label="Checklist de départ du Carnet"
        >
          {checklist.checks.map((check) => (
            <li key={check.key} data-state={check.state}>
              <span aria-hidden="true">
                {check.state === 'ok'
                  ? '✓'
                  : check.state === 'warning'
                    ? '⚠'
                    : '✕'}
              </span>
              <div>
                <strong>
                  <span className={styles.srOnly}>
                    {check.state === 'ok'
                      ? 'Conforme : '
                      : check.state === 'warning'
                        ? 'À corriger : '
                        : 'Bloquant : '}
                  </span>
                  {check.label}
                </strong>
                <small>
                  {check.detail}
                  {check.key === 'test' && proof.testSentAt
                    ? ` Dernier test : ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(proof.testSentAt))}.`
                    : ''}
                </small>
                {check.action &&
                !readOnly &&
                value.campaign?.customized &&
                ['cta', 'composition'].includes(check.key) ? (
                  <Link
                    href={`/admin/newsletter/campagnes/${value.campaign.id}`}
                  >
                    Corriger dans le Studio
                  </Link>
                ) : (
                  check.action &&
                  !readOnly && (
                    <button
                      type="button"
                      onClick={() => fix(check.action!)}
                      disabled={
                        check.action.target === 'test' &&
                        (dirty || !checklist.canTest)
                      }
                    >
                      {check.action.label}
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
        <div
          className={ready ? styles.departureReady : styles.departureBlocked}
          role="status"
        >
          <strong>
            {readOnly
              ? 'ÉDITION ENGAGÉE DANS LA DIFFUSION'
              : ready
                ? 'PRÊT POUR LE DÉPART'
                : 'LE DÉPART ATTEND VOS CORRECTIONS'}
          </strong>
          <p>
            {readOnly
              ? 'La programmation et le contenu sont figés. Consultez le suivi de campagne.'
              : ready
                ? `Toutes les vérifications obligatoires passent.${checklist.warnings.length ? ' Les conseils éditoriaux restent à relire.' : ''}`
                : `${checklist.blocking.length} point(s) bloquant(s). Corrigez-les, sauvegardez puis envoyez-vous un test.`}
          </p>
        </div>
        <p>
          Le stock et la version testée seront revérifiés côté serveur au moment
          de programmer. Les aperçus restent une aide à votre relecture.
        </p>
        <div className={styles.panelActions}>
          <button type="button" onClick={() => onPreview('desktop')}>
            Aperçu ordinateur
          </button>
          <button type="button" onClick={() => onPreview('mobile')}>
            Aperçu mobile
          </button>
        </div>
        <p className={styles.checkLegend}>
          Relecture ordinateur :{' '}
          {viewed.desktop ? 'ouverte pour cette version' : 'à ouvrir'} · Mobile
          : {viewed.mobile ? 'ouverte pour cette version' : 'à ouvrir'}
        </p>
        {dirty && (
          <p role="status" className={styles.notice}>
            Modifications non enregistrées : sauvegardez avant de tester,
            programmer ou ouvrir le Studio.
          </p>
        )}
        {value.campaign ? (
          <div className={styles.panelActions}>
            <div id="carnet-test">
              <AdminForm
                action={testCarnetEditionAction}
                guard={false}
                requireSaved
                submit="M’envoyer un test"
                submitDisabled={dirty || !checklist.canTest}
              >
                <EditionReferences value={value} />
              </AdminForm>
            </div>
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
