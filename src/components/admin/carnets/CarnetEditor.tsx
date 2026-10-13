'use client';
import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { BookOpen, Scissors, ArrowRight, WandSparkles } from 'lucide-react';
import { AdminForm, useAdminFormChange } from '../AdminForm';
import type { AdminAction } from '@/lib/admin/action-types';
import type { CarnetEditorValue } from '@/lib/carnets/admin';
import {
  carnetBlockText,
  carnetCta,
  carnetEditorialWarnings,
  deriveCarnet,
  moveCarnetCut,
  removeCarnetCut,
  suggestCarnetSlug,
  CARNET_STATUS_LABELS,
  type CarnetContent,
} from '@/lib/carnets/content';
import { PRODUCTION_SITE_URL } from '@/lib/site';
import styles from './CarnetEditor.module.scss';
const Narrative = dynamic(() => import('./CarnetNarrativeEditor'), {
  ssr: false,
  loading: () => <p>Chargement de l’espace d’écriture…</p>,
});

export function CarnetPreview({ value }: { value: CarnetEditorValue }) {
  const [mode, setMode] = useState<'full' | 'excerpt'>('full');
  const derived = deriveCarnet(value.content);
  const cta = carnetCta(value.slug);
  const rendered = mode === 'full' ? derived.full : derived.excerpt;
  return (
    <aside className={styles.preview} aria-label="Aperçu du Carnet">
      <div className={styles.previewHeading}>
        <span>LECTURE</span>
        <h2>Aperçu du Carnet</h2>
      </div>
      <div
        className={styles.previewModes}
        role="group"
        aria-label="Mode d’aperçu"
      >
        <button
          type="button"
          aria-pressed={mode === 'full'}
          onClick={() => setMode('full')}
        >
          <BookOpen size={15} /> Chapitre complet
        </button>
        <button
          type="button"
          aria-pressed={mode === 'excerpt'}
          onClick={() => setMode('excerpt')}
        >
          <Scissors size={15} /> Extrait newsletter
        </button>
      </div>
      <article className={styles.reading}>
        <header>
          <span>LES TERRES DE CALDERA</span>
          <p>
            Les Carnets de Caldera · #
            {String(value.number || 1).padStart(3, '0')}
          </p>
        </header>
        {value.arcTitle && (
          <p className={styles.arc}>
            {value.arcTitle}
            {value.arcPosition && value.arcTotal
              ? ` · ${value.arcPosition} / ${value.arcTotal}`
              : ''}
          </p>
        )}
        <h2>{value.title || 'Titre du Carnet'}</h2>
        {rendered ? (
          <div
            className={styles.prose}
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        ) : (
          <p className={styles.missing}>
            Placez la coupure pour obtenir l’extrait. Le chapitre complet n’est
            jamais utilisé comme extrait par défaut.
          </p>
        )}
        {mode === 'excerpt' && rendered && (
          <>
            <button type="button" disabled className={styles.cta}>
              {cta.label} <ArrowRight size={16} />
            </button>
            <small>
              Adresse réservée · lecture publique non activée dans cette étape.
            </small>
          </>
        )}
      </article>
    </aside>
  );
}
function Fields({ initial }: { initial: CarnetEditorValue }) {
  const [value, setValue] = useState(initial),
    [manualSlug, setManualSlug] = useState(Boolean(initial.id || initial.slug)),
    [placement, setPlacement] = useState(() =>
      String(Math.max(0, deriveCarnet(initial.content).cutIndex - 1)),
    );
  const mark = useAdminFormChange(),
    id = useId();
  const derived = deriveCarnet(value.content);
  const warnings = carnetEditorialWarnings(value.content);
  const cta = carnetCta(value.slug);
  const blocks = value.content.document.content.filter(
    (b) => b.type !== 'newsletterCut',
  );
  function change(content: CarnetContent) {
    setValue((v) => ({ ...v, content }));
    mark?.();
  }
  function title(next: string) {
    setValue((v) => ({
      ...v,
      title: next,
      ...(!manualSlug ? { slug: suggestCarnetSlug(v.number, next) } : {}),
    }));
  }
  function number(next: number) {
    setValue((v) => ({
      ...v,
      number: next,
      ...(!manualSlug ? { slug: suggestCarnetSlug(next, v.title) } : {}),
    }));
  }
  return (
    <div
      onInvalidCapture={(event) => {
        const target = event.target as HTMLElement;
        const details = target.closest('details');
        if (details) details.open = true;
      }}
    >
      {value.id && <input type="hidden" name="id" value={value.id} />}
      <input type="hidden" name="revision" value={value.revision} />
      <input
        type="hidden"
        name="content"
        value={JSON.stringify(value.content)}
      />
      <section className={styles.intro}>
        <span>LES CARNETS DE CALDERA</span>
        <h2>Un récit. Deux façons de le découvrir.</h2>
        <p>
          Écrivez le chapitre une seule fois. La coupure détermine son ouverture
          dans la newsletter.
        </p>
      </section>
      <details className={styles.metadata} open={!initial.id}>
        <summary>
          Repères du Carnet · #{String(value.number || 1).padStart(3, '0')}
          {value.title ? ` · ${value.title}` : ''}
        </summary>
        <div className={styles.fields}>
          <label>
            Numéro du Carnet
            <input
              name="number"
              type="number"
              min={1}
              max={999999}
              required
              value={value.number || ''}
              onChange={(e) => number(Number(e.target.value))}
            />
          </label>
          <label className={styles.wide}>
            Titre
            <input
              name="title"
              required
              maxLength={200}
              value={value.title}
              onChange={(e) => title(e.target.value)}
              placeholder="Quand le lac recula"
            />
          </label>
          <label className={styles.wide}>
            Slug
            <input
              name="slug"
              required
              maxLength={120}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={value.slug}
              onChange={(e) => {
                setManualSlug(true);
                setValue((v) => ({ ...v, slug: e.target.value }));
              }}
            />
            <small>
              Après sauvegarde, modifier le titre ou le numéro ne change pas
              cette adresse automatiquement.
            </small>
          </label>
          <div className={styles.slugTools}>
            <button
              type="button"
              disabled={!value.title.trim() || !value.number}
              onClick={() => {
                setValue((v) => ({
                  ...v,
                  slug: suggestCarnetSlug(v.number, v.title),
                }));
                setManualSlug(true);
                mark?.();
              }}
            >
              <WandSparkles size={15} /> Générer le slug
            </button>
          </div>
          <label className={styles.wide}>
            Arc narratif (facultatif)
            <input
              name="arcTitle"
              maxLength={200}
              value={value.arcTitle}
              onChange={(e) =>
                setValue((v) => ({ ...v, arcTitle: e.target.value }))
              }
              placeholder="La route noyée"
            />
          </label>
          <label>
            Position dans l’arc
            <input
              name="arcPosition"
              type="number"
              min={1}
              max={1000}
              value={value.arcPosition}
              onChange={(e) =>
                setValue((v) => ({ ...v, arcPosition: e.target.value }))
              }
            />
          </label>
          <label>
            Total des chapitres de l’arc
            <input
              name="arcTotal"
              type="number"
              min={1}
              max={1000}
              value={value.arcTotal}
              onChange={(e) =>
                setValue((v) => ({ ...v, arcTotal: e.target.value }))
              }
            />
          </label>
          <label className={styles.wide}>
            Statut éditorial
            <select
              name="status"
              value={value.status}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  status: e.target.value as CarnetEditorValue['status'],
                }))
              }
            >
              {(['DRAFT', 'READY'] as const).map((s) => (
                <option key={s} value={s}>
                  {CARNET_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <small>
              « Prêt éditorialement » ne publie pas le chapitre et ne déclenche
              aucun email.
            </small>
          </label>
        </div>
      </details>
      <div className={styles.counters} aria-live="polite">
        <div>
          <BookOpen size={20} />
          <span>
            Chapitre complet
            <strong>{derived.full.words.toLocaleString('fr')} mots</strong>
            <small>Repère : 900–1 100</small>
          </span>
        </div>
        <div>
          <Scissors size={20} />
          <span>
            Extrait newsletter
            <strong>
              {derived.excerpt
                ? `${derived.excerpt.words.toLocaleString('fr')} mots`
                : 'Coupure à placer'}
            </strong>
            <small>Repère : 250–400</small>
          </span>
        </div>
      </div>
      <div className={styles.layout}>
        <div className={styles.writing}>
          <h2>Le récit complet</h2>
          <Narrative value={value.content} onChange={change} />
          <section className={styles.cutPanel} aria-labelledby={`${id}-cut`}>
            <h3 id={`${id}-cut`}>✂ La coupure newsletter</h3>
            <p>
              {derived.excerpt
                ? 'Une coupure est placée. Déplacez-la pour ajuster l’extrait.'
                : 'Aucune coupure : le brouillon peut être enregistré, mais aucun extrait n’est encore défini.'}
            </p>
            <label>
              Placer la coupure après
              <select
                value={placement}
                onChange={(e) => {
                  e.stopPropagation();
                  setPlacement(e.target.value);
                }}
              >
                {blocks.map((b, index) => (
                  <option key={index} value={index}>
                    Bloc {index + 1} ·{' '}
                    {carnetBlockText(b).slice(0, 70) || 'Paragraphe vide'}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button
                type="button"
                disabled={!blocks.length}
                onClick={() =>
                  change(
                    moveCarnetCut(
                      value.content,
                      Math.min(Number(placement), blocks.length - 1),
                    ),
                  )
                }
              >
                {derived.excerpt ? 'Déplacer la coupure' : 'Ajouter la coupure'}
              </button>
              <button
                type="button"
                disabled={!derived.excerpt}
                onClick={() => change(removeCarnetCut(value.content))}
              >
                Retirer la coupure
              </button>
            </div>
          </section>
          {warnings.length > 0 && (
            <div className={styles.warnings}>
              <h3>Repères éditoriaux</h3>
              <ul>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p>
                Ces recommandations de longueur ne bloquent pas la sauvegarde.
              </p>
            </div>
          )}
          <section className={styles.destination}>
            <h3>Destination automatique</h3>
            <p>{cta.label} →</p>
            <code>
              {value.slug
                ? `${PRODUCTION_SITE_URL}${cta.href}`
                : 'Renseignez le titre et le numéro pour proposer l’adresse.'}
            </code>
            <small>
              Cette adresse est préparée pour le futur chapitre. Aucun accès
              public ou privé n’est activé ici.
            </small>
          </section>
        </div>
        <CarnetPreview value={value} />
      </div>
    </div>
  );
}
export function CarnetEditor({
  value,
  action,
  revision,
  readOnly = false,
}: {
  value: CarnetEditorValue;
  action?: AdminAction;
  revision?: string;
  readOnly?: boolean;
}) {
  if (readOnly) return <CarnetPreview value={value} />;
  if (!action) return null;
  return (
    <div className={styles.editor}>
      <AdminForm
        action={action}
        fieldsKey={revision}
        submit="Enregistrer le Carnet"
      >
        <Fields initial={value} />
      </AdminForm>
    </div>
  );
}
