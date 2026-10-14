'use client';
import dynamic from 'next/dynamic';
import {
  useId,
  useState,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react';
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
import Image from 'next/image';
import { CarnetComptoir } from './CarnetComptoir';
import {
  CarnetEmailPanel,
  CarnetSchedulePanel,
  CarnetVerification,
  type PreviewDevice,
} from './CarnetEditionPanels';
import { useCarnetRecovery } from './useCarnetRecovery';
import type { CarnetProduct } from '@/lib/carnets/comptoir';
import { GameLogoField } from '../GameLogoField';
const Narrative = dynamic(() => import('./CarnetNarrativeEditor'), {
  ssr: false,
  loading: () => <p>Chargement de l’espace d’écriture…</p>,
});

export function CarnetPreview({ value }: { value: CarnetEditorValue }) {
  const [mode, setMode] = useState<'full' | 'excerpt'>('full');
  const derived = deriveCarnet(value.content);
  const cta = carnetCta(value.slug);
  const rendered = mode === 'full' ? derived.full : derived.excerpt;
  const illustration =
    value.illustrationUrl &&
    /^\/(?:assets\/[a-zA-Z0-9_./-]+|media\/[a-f0-9-]+\.webp)$/.test(
      value.illustrationUrl,
    ) &&
    !value.illustrationUrl.includes('..')
      ? value.illustrationUrl
      : null;
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
        {value.location && (
          <p className={styles.arc}>Lieu · {value.location}</p>
        )}
        {illustration && (
          <Image
            src={illustration}
            alt={value.illustrationAlt ?? ''}
            width={960}
            height={540}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: 8,
              marginBottom: 20,
            }}
          />
        )}
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
              Le lien de lecture anticipée sera signé automatiquement lors de la
              diffusion.
            </small>
          </>
        )}
      </article>
    </aside>
  );
}
function Fields({
  initial,
  value,
  setValue,
  products,
  onProducts,
  device,
  onDevice,
}: {
  initial: CarnetEditorValue;
  value: CarnetEditorValue;
  setValue: Dispatch<SetStateAction<CarnetEditorValue>>;
  products: CarnetProduct[];
  onProducts: (products: CarnetProduct[]) => void;
  device: PreviewDevice;
  onDevice: (device: PreviewDevice) => void;
}) {
  const [manualSlug, setManualSlug] = useState(
      Boolean(initial.id || initial.slug),
    ),
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
      ...(!v.emailSubject ||
      v.emailSubject ===
        `${v.title} — Carnet #${String(v.number).padStart(3, '0')}`.slice(
          0,
          160,
        )
        ? {
            emailSubject:
              `${next} — Carnet #${String(v.number).padStart(3, '0')}`.slice(
                0,
                160,
              ),
          }
        : {}),
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
        name="campaignUpdatedAt"
        value={value.campaign?.updatedAt ?? ''}
      />
      <input
        type="hidden"
        name="content"
        value={JSON.stringify(value.content)}
      />
      <section id="carnet-recit" className={styles.intro}>
        <span>01 / RÉCIT</span>
        <h2>Un récit. Deux façons de le découvrir.</h2>
        <p>
          Écrivez le chapitre une seule fois. La coupure détermine son ouverture
          dans la newsletter.
        </p>
      </section>
      <details className={styles.metadata} open>
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
          <label className={styles.wide}>
            Lieu (facultatif)
            <input
              name="location"
              maxLength={200}
              value={value.location ?? ''}
              onChange={(e) =>
                setValue((v) => ({ ...v, location: e.target.value }))
              }
              placeholder="Nom du lieu du récit"
            />
          </label>
          {value.publishedAt && (
            <p className={styles.wide}>
              Première publication effective : {value.publishedAt} (Paris).
            </p>
          )}
          <div className={`${styles.wide} ${styles.media}`}>
            <GameLogoField
              name="illustration"
              label="Illustration du Carnet"
              currentUrl={value.illustrationUrl ?? ''}
              maxBytes={4 * 1024 * 1024}
              maxLabel="4 Mo"
              onUrlChange={(illustrationUrl) =>
                setValue((v) => ({
                  ...v,
                  illustrationUrl,
                  ...(!illustrationUrl ? { illustrationAlt: '' } : {}),
                }))
              }
            />
          </div>
          <label className={styles.wide}>
            Texte alternatif de l’illustration
            <input
              name="illustrationAlt"
              maxLength={300}
              value={value.illustrationAlt ?? ''}
              onChange={(e) =>
                setValue((v) => ({ ...v, illustrationAlt: e.target.value }))
              }
            />
            <small>
              Décrivez l’image. Ce texte est requis lorsqu’une illustration est
              renseignée.
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
              Une seule adresse, en avant-première puis en accès public. Le lien
              newsletter reçoit une autorisation temporaire automatiquement.
            </small>
          </section>
        </div>
        <details className={styles.webPreview}>
          <summary>Aperçu du chapitre web</summary>
          <CarnetPreview value={value} />
        </details>
      </div>
      <CarnetComptoir
        ids={value.productIds ?? []}
        products={products}
        onProductsChange={onProducts}
        onChange={(productIds, nextProducts) => {
          if (nextProducts) onProducts(nextProducts);
          setValue((v) => ({ ...v, productIds }));
          mark?.();
        }}
      />
      <CarnetEmailPanel
        value={value}
        products={products}
        device={device}
        onDevice={onDevice}
        onChange={(key, next) => setValue((v) => ({ ...v, [key]: next }))}
      />
      <CarnetSchedulePanel
        value={value}
        onChange={(earlyAccessAt) => setValue((v) => ({ ...v, earlyAccessAt }))}
      />
    </div>
  );
}

function Edition({
  value: initial,
  action,
  products,
  readOnly,
}: {
  value: CarnetEditorValue;
  action?: AdminAction;
  products: CarnetProduct[];
  readOnly: boolean;
}) {
  const normalized = useMemo(
    () => ({
      ...initial,
      productIds: initial.productIds ?? [],
      emailSubject: initial.emailSubject ?? '',
      emailPreheader: initial.emailPreheader ?? '',
    }),
    [initial],
  );
  const [value, setValue] = useState<CarnetEditorValue>(normalized);
  const [productOptions, setProductOptions] = useState(products);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [views, setViews] = useState<{ desktop?: string; mobile?: string }>({});
  const rescue = useCarnetRecovery(normalized, value);
  const draftFingerprint = JSON.stringify(value);
  const fingerprint = JSON.stringify({
    value,
    products: (value.productIds ?? []).map((id) =>
      productOptions.find((p) => p.id === id),
    ),
  });
  const dirty =
    JSON.stringify({
      ...initial,
      productIds: initial.productIds ?? [],
      emailSubject: initial.emailSubject ?? '',
      emailPreheader: initial.emailPreheader ?? '',
    }) !== draftFingerprint;
  function preview(next: PreviewDevice) {
    setDevice(next);
    if (next !== 'text') setViews((v) => ({ ...v, [next]: fingerprint }));
  }
  function openPreview(next: PreviewDevice) {
    preview(next);
    document.getElementById('carnet-email')?.scrollIntoView({ block: 'start' });
  }
  return (
    <div className={styles.editor}>
      <nav className={styles.workflowNav} aria-label="Étapes du Carnet">
        {[
          ['recit', 'Récit'],
          ['comptoir', 'Le Comptoir'],
          ['email', 'Email'],
          ['diffusion', 'Diffusion'],
          ['verification', 'Vérification'],
        ].map(([anchor, label], i) => (
          <a key={anchor} href={`#carnet-${anchor}`}>
            <span>{i + 1}</span>
            {label}
          </a>
        ))}
      </nav>
      {readOnly ? (
        <>
          <section id="carnet-recit">
            <CarnetPreview value={value} />
          </section>
          <section id="carnet-comptoir" className={styles.workflowSection}>
            <h2>Le Comptoir</h2>
            <ul>
              {(value.productIds ?? []).map((id) => (
                <li key={id}>
                  {productOptions.find((p) => p.id === id)?.name ??
                    'Produit indisponible'}
                </li>
              ))}
            </ul>
          </section>
          <CarnetEmailPanel
            value={value}
            products={productOptions}
            readOnly
            device={device}
            onDevice={preview}
          />
          <CarnetSchedulePanel value={value} readOnly />
        </>
      ) : (
        action && (
          <AdminForm action={action} submit="Enregistrer l’édition">
            <Recovery
              initial={initial}
              value={value}
              setValue={setValue}
              rescue={rescue}
            />
            <Fields
              initial={initial}
              value={value}
              setValue={setValue}
              products={productOptions}
              onProducts={setProductOptions}
              device={device}
              onDevice={preview}
            />
          </AdminForm>
        )
      )}
      <CarnetVerification
        value={value}
        products={productOptions}
        dirty={!readOnly && dirty}
        viewed={{
          desktop: views.desktop === fingerprint,
          mobile: views.mobile === fingerprint,
        }}
        onPreview={openPreview}
        readOnly={readOnly}
      />
    </div>
  );
}
function Recovery({
  setValue,
  rescue,
}: {
  initial: CarnetEditorValue;
  value: CarnetEditorValue;
  setValue: Dispatch<SetStateAction<CarnetEditorValue>>;
  rescue: ReturnType<typeof useCarnetRecovery>;
}) {
  const mark = useAdminFormChange();
  return (
    <div className={styles.recovery}>
      {rescue.recovery && (
        <>
          <p>
            Une copie de secours non enregistrée est disponible dans cet onglet.
          </p>
          <button
            type="button"
            onClick={() => {
              setValue(rescue.recovery!);
              mark?.();
              rescue.dismiss();
            }}
          >
            Restaurer la copie
          </button>
          <button type="button" onClick={rescue.dismiss}>
            Ignorer
          </button>
        </>
      )}
      <small>
        {rescue.unavailable
          ? 'Copie de secours indisponible : enregistrez régulièrement.'
          : rescue.saved
            ? 'Copie de secours locale actualisée · enregistrez pour sauvegarder dans Caldera.'
            : 'Copie de secours dans cet onglet · 24 h · aucun envoi automatique.'}{' '}
        Les fichiers à importer doivent être sélectionnés à nouveau après
        rechargement.
      </small>
    </div>
  );
}
export function CarnetEditor({
  value,
  action,
  revision,
  readOnly = false,
  products = [],
}: {
  value: CarnetEditorValue;
  action?: AdminAction;
  revision?: string;
  readOnly?: boolean;
  products?: CarnetProduct[];
}) {
  return (
    <Edition
      key={revision ?? 'new'}
      value={value}
      action={action}
      products={products}
      readOnly={readOnly}
    />
  );
}
