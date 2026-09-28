'use client';
import { useMemo, useRef, useState } from 'react';
import { AdminForm } from './AdminForm';
import type { AdminAction } from '@/lib/admin/action-types';
import { linkTarget, renderMarkdown } from '@/lib/content/markdown';
import styles from './NewsletterCampaignEditor.module.scss';

export type CampaignEditorValue = {
  id?: string;
  internalName: string;
  subject: string;
  preheader: string;
  heading: string;
  bodyMarkdown: string;
  ctaLabel: string;
  ctaUrl: string;
};

export function NewsletterCampaignPreview({
  value,
}: {
  value: Omit<CampaignEditorValue, 'id'>;
}) {
  const body = useMemo(
    () => renderMarkdown(value.bodyMarkdown, { headingLevel: 2 }),
    [value.bodyMarkdown],
  );
  const ctaTarget = useMemo(() => {
    const target = value.ctaUrl ? linkTarget(value.ctaUrl) : null;
    return target &&
      (/^\//.test(target.href) || /^https:\/\//.test(target.href))
      ? target.href
      : null;
  }, [value.ctaUrl]);
  return (
    <div className={styles.previewPanel}>
      <p className={styles.previewLabel}>Aperçu abonné</p>
      <div className={styles.inbox}>
        <strong>{value.subject || 'Objet de l’e-mail'}</strong>
        <span>{value.preheader || 'Texte d’aperçu dans la boîte mail'}</span>
      </div>
      <div className={styles.email}>
        <div className={styles.emailHeader}>LES TERRES DE CALDERA</div>
        <div className={styles.emailBody}>
          <h1>{value.heading || 'Titre de la newsletter'}</h1>
          {body ? (
            <div dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            <p>Le contenu apparaîtra ici.</p>
          )}
          {value.ctaLabel && ctaTarget && (
            <a className={styles.cta} href={ctaTarget}>
              {value.ctaLabel}
            </a>
          )}
        </div>
        <div className={styles.emailFooter}>
          Les Terres de Caldera · lien de désinscription personnel inclus lors
          de l’envoi
        </div>
      </div>
    </div>
  );
}

export function NewsletterCampaignEditor({
  value: initial,
  action,
  readOnly = false,
}: {
  value: CampaignEditorValue;
  action?: AdminAction;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const body = useRef<HTMLTextAreaElement>(null);
  function field<K extends keyof CampaignEditorValue>(
    key: K,
    next: CampaignEditorValue[K],
  ) {
    setValue((current) => ({ ...current, [key]: next }));
  }
  function insert(before: string, after = '', placeholder = 'texte') {
    const area = body.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = value.bodyMarkdown.slice(start, end) || placeholder;
    const next = `${value.bodyMarkdown.slice(0, start)}${before}${selected}${after}${value.bodyMarkdown.slice(end)}`;
    field('bodyMarkdown', next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  }
  if (readOnly) return <NewsletterCampaignPreview value={value} />;
  if (!action) return null;
  return (
    <div className={styles.layout}>
      <section className={styles.editor}>
        <h2>Contenu de la campagne</h2>
        <AdminForm action={action} submit="Enregistrer le brouillon">
          {value.id && <input type="hidden" name="id" value={value.id} />}
          <div className={styles.fields}>
            <label className={styles.full}>
              Nom interne
              <input
                name="internalName"
                maxLength={120}
                required
                value={value.internalName}
                onChange={(event) => field('internalName', event.target.value)}
                placeholder="Réassort Pokémon — octobre"
              />
              <small>Visible uniquement dans l’administration.</small>
            </label>
            <label className={styles.full}>
              Objet de l’e-mail
              <input
                name="subject"
                maxLength={160}
                required
                value={value.subject}
                onChange={(event) => field('subject', event.target.value)}
                placeholder="De nouvelles cartes arrivent en boutique"
              />
            </label>
            <label className={styles.full}>
              Texte d’aperçu
              <input
                name="preheader"
                maxLength={180}
                value={value.preheader}
                onChange={(event) => field('preheader', event.target.value)}
                placeholder="La phrase affichée après l’objet dans Gmail et Outlook"
              />
            </label>
            <label className={styles.full}>
              Grand titre
              <input
                name="heading"
                maxLength={160}
                required
                value={value.heading}
                onChange={(event) => field('heading', event.target.value)}
                placeholder="Une nouvelle expédition se prépare"
              />
            </label>
            <label className={styles.full}>
              Message
              <span
                className={styles.toolbar}
                aria-label="Mise en forme du message"
              >
                <button
                  type="button"
                  onClick={() => insert('**', '**', 'texte en gras')}
                >
                  Gras
                </button>
                <button
                  type="button"
                  onClick={() => insert('## ', '', 'Intertitre')}
                >
                  Titre
                </button>
                <button
                  type="button"
                  onClick={() => insert('- ', '', 'Élément de liste')}
                >
                  Liste
                </button>
                <button
                  type="button"
                  onClick={() => insert('[', '](https://)', 'texte du lien')}
                >
                  Lien
                </button>
              </span>
              <textarea
                ref={body}
                name="bodyMarkdown"
                maxLength={20000}
                required
                value={value.bodyMarkdown}
                onChange={(event) => field('bodyMarkdown', event.target.value)}
                placeholder={
                  'Bonjour,\n\nPrésentez ici les nouveautés, conseils ou réassorts.'
                }
              />
              <small>
                Mise en forme simple : titres, gras, listes et liens.
              </small>
            </label>
            <label>
              Texte du bouton
              <input
                name="ctaLabel"
                maxLength={80}
                value={value.ctaLabel}
                onChange={(event) => field('ctaLabel', event.target.value)}
                placeholder="Découvrir la sélection"
              />
            </label>
            <label>
              Lien du bouton
              <input
                name="ctaUrl"
                maxLength={500}
                value={value.ctaUrl}
                onChange={(event) => field('ctaUrl', event.target.value)}
                placeholder="/nouveautes"
              />
            </label>
          </div>
        </AdminForm>
      </section>
      <NewsletterCampaignPreview value={value} />
    </div>
  );
}
