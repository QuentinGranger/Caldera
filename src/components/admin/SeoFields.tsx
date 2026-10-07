import { useId } from 'react';
import {
  INTRO_MAX_LENGTH,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
} from '@/lib/admin/limits';
import { FaqEditor } from './FaqEditor';
import styles from './Admin.module.scss';
export function SeoFields({
  seoTitle,
  seoDescription,
  editorial,
}: {
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Intro and FAQ of a game, set or category page; products only have overrides. */
  editorial?: { intro?: string | null; faq: string };
}) {
  const id = useId();
  return (
    <>
      {editorial && (
        <>
          <label className={styles.full}>
            Introduction éditoriale (Markdown)
            <textarea
              name="intro"
              rows={8}
              maxLength={INTRO_MAX_LENGTH}
              defaultValue={editorial.intro ?? ''}
              aria-describedby={`${id}-intro`}
            />
            <small id={`${id}-intro`}>
              Affichée en tête de la page publique. Titres ##, listes, liens et
              **gras** sont acceptés. Uniquement des faits vérifiables.
            </small>
          </label>
          <FaqEditor initialValue={editorial.faq} />
        </>
      )}
      <label className={styles.full}>
        Titre SEO
        <input
          name="seoTitle"
          maxLength={SEO_TITLE_MAX_LENGTH}
          defaultValue={seoTitle ?? ''}
          aria-describedby={`${id}-title`}
        />
        <small id={`${id}-title`}>
          {SEO_TITLE_MAX_LENGTH} caractères maximum, sans « Caldera » (ajouté
          automatiquement). Vide : titre généré à partir du catalogue.
        </small>
      </label>
      <label className={styles.full}>
        Meta description
        <textarea
          name="seoDescription"
          rows={3}
          maxLength={SEO_DESCRIPTION_MAX_LENGTH}
          defaultValue={seoDescription ?? ''}
          aria-describedby={`${id}-description`}
        />
        <small id={`${id}-description`}>
          {SEO_DESCRIPTION_MAX_LENGTH} caractères maximum. Vide : description
          générée (nombre de produits, prix, disponibilité).
        </small>
      </label>
    </>
  );
}
