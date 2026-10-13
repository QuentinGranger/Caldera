'use client';
import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Download,
  GripVertical,
  LayoutTemplate,
  Mail,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { NewsletterEmailPreview } from './NewsletterEmailPreview';
import { BlockInspector, BlockMiniPreview } from './NewsletterBlocks';
import { useNewsletterRecovery } from './useNewsletterRecovery';
import { renderDocument } from '@/lib/content/markdown';
import { AdminForm, useAdminFormChange } from './AdminForm';
import type { AdminAction } from '@/lib/admin/action-types';
import { renderNewsletterCampaignEmail } from '@/emails/newsletter-campaign';
import {
  BLOCK_LABELS,
  safeNewsletterLink,
  importNewsletterTemplate,
  MAX_DOCUMENT_LENGTH,
  parseNewsletterDocument,
  documentFromLegacy,
  MAX_BLOCKS,
  newsletterIssues,
  serializeNewsletterDocument,
  THEMES,
  type NewsletterBlock,
  type NewsletterDocument,
} from '@/lib/newsletter/document';
import type { NewsletterProductOption } from '@/lib/newsletter/studio';
import styles from './NewsletterCampaignEditor.module.scss';
import { CARNET_STATUS_LABELS, carnetUrl } from '@/lib/carnets/content';
export type CampaignChapterOption = {
  id: string;
  number: number;
  title: string;
  status: keyof typeof CARNET_STATUS_LABELS;
};

export type CampaignEditorValue = {
  id?: string;
  internalName: string;
  subject: string;
  preheader: string;
  heading: string;
  bodyMarkdown: string;
  ctaLabel: string;
  ctaUrl: string;
  chapterId?: string;
  carnetCustomized?: boolean;
  editionOwned?: boolean;
  carnetSource?: {
    id: string;
    title: string;
    slug: string;
    html: string;
    text: string;
    illustration?: { src: string; alt: string };
    products?: import('@/lib/carnets/comptoir').CarnetProduct[];
  };
};
const STEP_LABELS = ['Paramètres', 'Composition', 'Vérification'];
const TEMPLATES = [
  {
    id: 'blank',
    title: 'Page blanche',
    description: 'Votre composition, à votre rythme.',
    heading: '',
    text: '',
  },
  {
    id: 'journal',
    title: 'Le journal',
    description: 'Une actualité utile et un lien pour aller plus loin.',
    heading: 'Le journal Caldera',
    text: 'Bonjour,\n\nPartagez ici une actualité vérifiée et ce qu’elle apporte à votre communauté.\n\n## Pour aller plus loin\nAjoutez un conseil ou une ressource utile.',
  },
  {
    id: 'release',
    title: 'Nouvelle sortie',
    description: 'Présentez une extension et ses produits.',
    heading: 'Une nouvelle exploration',
    text: 'Bonjour,\n\nPrésentez l’extension, son univers et sa date de sortie confirmée. Ajoutez ensuite les produits réellement disponibles.',
  },
  {
    id: 'restock',
    title: 'Retour en stock',
    description: 'Un message court, centré sur les produits.',
    heading: 'De retour sur Caldera',
    text: 'Bonjour,\n\nIndiquez les références de nouveau disponibles et ce qui les distingue. Vérifiez leur stock avant de programmer cet envoi.',
  },
  {
    id: 'selection',
    title: 'Sélection du moment',
    description: 'Guidez vos abonnés avec une sélection choisie.',
    heading: 'Votre prochaine découverte',
    text: 'Bonjour,\n\nExpliquez à qui s’adresse cette sélection et pourquoi vous l’avez choisie. Ajoutez vos produits et un conseil pour les comparer.',
  },
] as const;
function freshBlock(type: NewsletterBlock['type']): NewsletterBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case 'heading':
      return { id, type, text: '', level: 2 };
    case 'feature':
      return {
        id,
        type,
        src: '',
        alt: '',
        title: '',
        text: '',
        label: '',
        href: '',
        placement: 'left',
      };
    case 'columns':
      return {
        id,
        type,
        columns: [
          { title: '', text: '', label: '', href: '' },
          { title: '', text: '', label: '', href: '' },
        ],
      };
    case 'text':
      return { id, type, text: '' };
    case 'image':
      return { id, type, src: '', alt: '', caption: '', href: '' };
    case 'button':
      return { id, type, label: 'Découvrir', href: '/catalogue' };
    case 'product':
      return {
        id,
        type,
        productId: '',
        name: '',
        image: '',
        price: '',
        href: '',
        description: '',
      };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, height: 32 };
  }
}

function renderPreview(value: Omit<CampaignEditorValue, 'id'>) {
  if (
    value.chapterId &&
    !value.carnetCustomized &&
    value.carnetSource?.id === value.chapterId
  )
    return renderNewsletterCampaignEmail(
      {
        ...value,
        heading: value.carnetSource.title,
        carnetExcerpt: {
          html: value.carnetSource.html,
          text: value.carnetSource.text,
        },
        carnetIllustration: value.carnetSource.illustration,
        carnetComptoir: value.carnetSource.products,
        ctaLabel: 'Continuer l’expédition',
        ctaUrl: carnetUrl(value.carnetSource.slug),
      },
      { logo: '/assets/brand/logo-header-no-bg.png' },
    );
  let bodyMarkdown = value.bodyMarkdown;
  try {
    const document = parseNewsletterDocument(bodyMarkdown, true);
    if (document) bodyMarkdown = serializeNewsletterDocument(document);
    return renderNewsletterCampaignEmail(
      {
        ...value,
        bodyMarkdown,
        preheader: value.preheader || null,
        subject: value.subject || 'Objet de votre campagne',
        heading: value.heading || 'Votre prochaine histoire',
      },
      { logo: '/assets/brand/logo-header-no-bg.png' },
    );
  } catch {
    return renderNewsletterCampaignEmail(
      {
        ...value,
        bodyMarkdown:
          'Le contenu dépasse les limites de l’éditeur. Réduisez la longueur du message.',
        preheader: null,
      },
      { logo: '/assets/brand/logo-header-no-bg.png' },
    );
  }
}

function useDocumentHistory(initial: NewsletterDocument) {
  const [history, setHistory] = useState({
    past: [] as NewsletterDocument[],
    present: initial,
    future: [] as NewsletterDocument[],
  });
  return {
    doc: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    change: (doc: NewsletterDocument) =>
      setHistory((h) => ({
        past: [...h.past, h.present].slice(-50),
        present: doc,
        future: [],
      })),
    undo: () =>
      setHistory((h) =>
        h.past.length
          ? {
              past: h.past.slice(0, -1),
              present: h.past.at(-1)!,
              future: [h.present, ...h.future],
            }
          : h,
      ),
    redo: () =>
      setHistory((h) =>
        h.future.length
          ? {
              past: [...h.past, h.present],
              present: h.future[0]!,
              future: h.future.slice(1),
            }
          : h,
      ),
  };
}
export function NewsletterCampaignPreview({
  value,
}: {
  value: Omit<CampaignEditorValue, 'id'>;
}) {
  const deferred = useDeferredValue(value);
  const rendered = useMemo(() => renderPreview(deferred), [deferred]);
  return (
    <NewsletterEmailPreview
      rendered={rendered}
      subject={value.subject}
      preheader={value.preheader}
    />
  );
}
function Studio({
  initial,
  products,
  chapters,
}: {
  initial: CampaignEditorValue;
  products: NewsletterProductOption[];
  chapters: CampaignChapterOption[];
}) {
  const [value, setValue] = useState(initial);
  const initialDoc = useMemo(() => {
    const doc = documentFromLegacy(initial.bodyMarkdown);
    return initial.ctaLabel && initial.ctaUrl
      ? {
          ...doc,
          blocks: [
            ...doc.blocks,
            {
              id: 'legacy-button',
              type: 'button' as const,
              label: initial.ctaLabel,
              href: initial.ctaUrl,
            },
          ],
        }
      : doc;
  }, [initial]);
  const history = useDocumentHistory(initialDoc);
  const doc = history.doc;
  const rescue = useNewsletterRecovery(initial, initialDoc, value, doc);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState<string | null>(
    doc.blocks[0]?.id ?? null,
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [imported, setImported] = useState<NewsletterDocument | null>(null);
  const [importError, setImportError] = useState('');
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number] | null>(
    null,
  );
  const templateDialog = useRef<HTMLDialogElement>(null);
  const mark = useAdminFormChange();
  const prefix = useId();
  const serialized = serializeNewsletterDocument(doc);
  const previewValue = {
    ...value,
    bodyMarkdown: serialized,
    ctaLabel: '',
    ctaUrl: '',
  };
  const issues = newsletterIssues(doc);
  const links = doc.blocks.flatMap((block, index) => {
    const direct =
      block.type === 'button' ||
      block.type === 'image' ||
      block.type === 'product' ||
      block.type === 'feature'
        ? [block.href]
        : block.type === 'columns'
          ? block.columns.map((c) => c.href)
          : [];
    const texts =
      block.type === 'text' || block.type === 'feature'
        ? [block.text]
        : block.type === 'columns'
          ? block.columns.map((c) => c.text)
          : [];
    return [
      ...new Set([
        ...direct,
        ...texts.flatMap((text) => renderDocument(text).links),
      ]),
    ]
      .filter(Boolean)
      .map((href) => ({ block: index + 1, href }));
  });
  const bytes = new TextEncoder().encode(
    renderPreview(previewValue).html,
  ).length;
  function change(next: NewsletterDocument) {
    history.change(next);
    mark?.();
  }
  function add(type: NewsletterBlock['type']) {
    if (doc.blocks.length >= MAX_BLOCKS) return;
    const b = freshBlock(type);
    const blocks = [...doc.blocks];
    const at = active
      ? blocks.findIndex((b) => b.id === active) + 1
      : blocks.length;
    blocks.splice(at, 0, b);
    change({ ...doc, blocks });
    setActive(b.id);
    setAnnouncement(`${BLOCK_LABELS[type]} ajouté.`);
  }
  function move(id: string, index: number) {
    const blocks = [...doc.blocks];
    const from = blocks.findIndex((b) => b.id === id);
    if (from < 0 || index < 0 || index >= blocks.length) return;
    const [block] = blocks.splice(from, 1);
    blocks.splice(index, 0, block!);
    change({ ...doc, blocks });
    setAnnouncement(`Bloc déplacé en position ${index + 1}.`);
  }
  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    const blocks: NewsletterBlock[] = t.text
      ? [
          { ...freshBlock('text'), type: 'text', text: t.text },
          {
            ...freshBlock('button'),
            type: 'button',
            label: 'Voir les produits disponibles',
            href: '/catalogue',
          },
        ]
      : [];
    if (t.id === 'journal')
      blocks.splice(1, 0, {
        id: crypto.randomUUID(),
        type: 'columns',
        columns: [
          {
            title: 'Le conseil Caldera',
            text: 'Ajoutez un conseil pratique pour votre communauté.',
            label: 'Lire les guides',
            href: '/guides',
          },
          {
            title: 'À explorer',
            text: 'Présentez un univers ou une extension avec des informations vérifiées.',
            label: 'Explorer Pokémon',
            href: '/pokemon',
          },
        ],
      });
    if (t.id === 'release')
      blocks.splice(1, 0, {
        id: crypto.randomUUID(),
        type: 'feature',
        src: '',
        alt: '',
        title: 'L’extension en lumière',
        text: 'Expliquez ce qui distingue cette extension, à partir des informations confirmées.',
        label: 'Découvrir les extensions',
        href: '/extensions',
        placement: 'left',
        style: { align: 'left', tone: 'sage', padding: 16, radius: 8 },
      });
    if (t.id === 'selection')
      blocks.splice(1, 0, {
        id: crypto.randomUUID(),
        type: 'columns',
        columns: [
          {
            title: 'Pour commencer',
            text: 'Indiquez un format adapté et expliquez votre choix.',
            label: 'Voir les produits',
            href: '/catalogue',
          },
          {
            title: 'Pour collectionner',
            text: 'Donnez un repère concret pour choisir une référence disponible.',
            label: 'Explorer la sélection',
            href: '/catalogue',
          },
        ],
        style: { align: 'left', tone: 'cream', padding: 16, radius: 8 },
      });
    if (t.id === 'restock') blocks.splice(1, 0, freshBlock('product'));
    change({
      version: 1,
      theme: t.id === 'selection' ? 'selection' : 'journal',
      blocks,
    });
    setValue((v) => ({ ...v, heading: v.heading || t.heading }));
    setActive(blocks[0]?.id ?? null);
    setStep(1);
    setAnnouncement(`Modèle ${t.title} appliqué.`);
  }
  function chooseTemplate(t: (typeof TEMPLATES)[number]) {
    if (doc.blocks.length) {
      setImported(null);
      setTemplate(t);
      templateDialog.current?.showModal();
    } else applyTemplate(t);
  }
  function exportTemplate() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-newsletter-caldera.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  async function importTemplate(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_DOCUMENT_LENGTH * 4)
        throw new Error('Le fichier de modèle dépasse 240 000 octets.');
      const parsed = importNewsletterTemplate(await file.text());
      if (!parsed) throw new Error('Modèle invalide.');
      // Fresh identities avoid accidental ID collisions when templates are reused.
      const next = {
        ...parsed,
        blocks: parsed.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      };
      if (doc.blocks.length) {
        setImported(next);
        setTemplate(null);
        templateDialog.current?.showModal();
      } else {
        change(next);
        setActive(next.blocks[0]?.id ?? null);
        setStep(1);
      }
      setImportError('');
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Import impossible.',
      );
    }
  }
  const field = (key: keyof CampaignEditorValue, next: string) =>
    setValue((v) => ({ ...v, [key]: next }));
  return (
    <div
      onInvalidCapture={(e) => {
        const element = e.target as HTMLElement;
        const panel = element.closest<HTMLElement>('[data-step]');
        if (panel) setStep(Number(panel.dataset.step));
      }}
    >
      {value.id && <input type="hidden" name="id" value={value.id} />}
      <input type="hidden" name="bodyMarkdown" value={serialized} />
      <input type="hidden" name="ctaLabel" value="" />
      <input type="hidden" name="ctaUrl" value="" />
      <div className={styles.studioHeader}>
        <div>
          <span className={styles.eyebrow}>CALDERA · CAMPAIGN STUDIO</span>
          <h2>Une lettre qui donne envie.</h2>
          <p>Composez, vérifiez, puis choisissez le bon moment.</p>
        </div>
        <span className={styles.draftPill}>
          <span /> Brouillon
        </span>
      </div>
      {rescue.recovery && (
        <div className={styles.recovery} role="status">
          <div>
            <strong>Une composition non enregistrée a été retrouvée.</strong>
            <p>
              Copie de secours de cet onglet, du{' '}
              {new Date(rescue.recovery.savedAt).toLocaleString('fr-FR')}. Elle
              ne remplace pas le brouillon enregistré sur Caldera.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (rescue.recovery) {
                setValue((v) => ({ ...v, ...rescue.recovery!.value }));
                change(rescue.recovery.doc);
                setActive(rescue.recovery.doc.blocks[0]?.id ?? null);
                setStep(1);
                rescue.dismiss();
              }
            }}
          >
            Restaurer
          </button>
          <button type="button" onClick={rescue.dismiss}>
            Ignorer
          </button>
        </div>
      )}
      <p className={styles.rescueStatus}>
        {rescue.unavailable
          ? 'Copie de secours indisponible dans ce navigateur. Enregistrez régulièrement votre brouillon.'
          : rescue.savedAt
            ? `Copie de secours dans cet onglet à ${new Date(rescue.savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · enregistrez pour synchroniser avec Caldera.`
            : 'Copie de secours automatique dans cet onglet · conservée 24 h · aucun envoi automatique.'}
      </p>
      <nav className={styles.steps} aria-label="Étapes de création">
        {STEP_LABELS.slice(
          0,
          value.chapterId && !value.carnetCustomized ? 1 : 3,
        ).map((label, index) => (
          <button
            type="button"
            key={label}
            aria-current={step === index ? 'step' : undefined}
            disabled={
              Boolean(value.chapterId) && !value.carnetCustomized && index !== 0
            }
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            {label}
            {index < 2 && <ChevronRight size={16} />}
          </button>
        ))}
      </nav>
      <div className={styles.layout}>
        <div className={styles.workbench}>
          <section
            data-step="0"
            hidden={step !== 0}
            aria-labelledby={`${prefix}-settings`}
          >
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>
                01 / LA PREMIÈRE IMPRESSION
              </span>
              <h3 id={`${prefix}-settings`}>Préparez l’ouverture</h3>
              <p>Un objet clair. Une promesse utile. Votre identité Caldera.</p>
            </div>
            <div className={styles.settingsFields}>
              <label>
                Carnet associé (facultatif)
                <select
                  name="chapterId"
                  disabled={value.editionOwned}
                  value={value.chapterId ?? ''}
                  onChange={(e) => {
                    field('chapterId', e.target.value);
                    if (e.target.value) {
                      const selected = chapters.find(
                        (c) => c.id === e.target.value,
                      );
                      if (selected) field('heading', selected.title);
                      setStep(0);
                    }
                  }}
                >
                  <option value="">Aucun Carnet — campagne classique</option>
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      #{String(chapter.number).padStart(3, '0')} ·{' '}
                      {chapter.title} · {CARNET_STATUS_LABELS[chapter.status]}
                    </option>
                  ))}
                </select>
                <small>
                  {value.carnetCustomized ? (
                    'Composition personnalisée : le récit web reste dans le Carnet, sans synchronisation automatique.'
                  ) : (
                    <>
                      Avec un Carnet, le titre, l’extrait et le bouton sont
                      dérivés du récit enregistré. Enregistrez après une
                      nouvelle sélection pour actualiser l’aperçu. Les blocs
                      classiques ne sont pas envoyés.
                    </>
                  )}
                </small>
                {value.chapterId && (
                  <a
                    href={`/admin/carnets/${value.chapterId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ouvrir le Carnet source
                  </a>
                )}
              </label>
              <label>
                Nom interne
                <input
                  name="internalName"
                  required
                  maxLength={120}
                  value={value.internalName}
                  onChange={(e) => field('internalName', e.target.value)}
                  placeholder="Sélection d’octobre"
                />
                <small>
                  Pour retrouver votre campagne. Invisible pour vos abonnés.
                </small>
              </label>
              <label>
                Objet de l’e-mail
                <input
                  name="subject"
                  required
                  maxLength={160}
                  value={value.subject}
                  onChange={(e) => field('subject', e.target.value)}
                  placeholder="Votre prochaine découverte Pokémon"
                />
                <small>
                  {value.subject.length}/160 · idéalement un objet court et
                  précis.
                </small>
              </label>
              <label>
                Texte d’aperçu
                <input
                  name="preheader"
                  maxLength={180}
                  value={value.preheader}
                  onChange={(e) => field('preheader', e.target.value)}
                  placeholder="Complétez l’objet sans le répéter"
                />
                <small>
                  {value.preheader.length}/180 · affiché à côté de l’objet.
                </small>
              </label>
              <label>
                Grand titre de l’e-mail
                <input
                  name="heading"
                  required
                  maxLength={200}
                  readOnly={Boolean(value.chapterId) && !value.carnetCustomized}
                  value={value.heading}
                  onChange={(e) => field('heading', e.target.value)}
                  placeholder="Votre prochaine exploration"
                />
              </label>
            </div>
            {(!value.chapterId || value.carnetCustomized) && (
              <button
                type="button"
                className={styles.continueButton}
                onClick={() => setStep(1)}
              >
                Composer le message <ChevronRight size={16} />
              </button>
            )}
          </section>
          <section
            data-step="1"
            hidden={step !== 1}
            aria-labelledby={`${prefix}-content`}
          >
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>02 / VOTRE HISTOIRE</span>
              <h3 id={`${prefix}-content`}>Composez votre campagne</h3>
              <p>
                Ajoutez des blocs, puis glissez-les dans l’ordre qui vous
                convient.
              </p>
            </div>
            <details className={styles.templates} open={!doc.blocks.length}>
              <summary>
                <LayoutTemplate size={18} /> Partir d’un modèle
              </summary>
              <div className={styles.templateGrid}>
                {TEMPLATES.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => chooseTemplate(t)}
                  >
                    <span className={styles.templateMini}>
                      <span />
                      <i />
                      <i />
                      <b />
                    </span>
                    <strong>{t.title}</strong>
                    <small>{t.description}</small>
                  </button>
                ))}
              </div>
            </details>
            <div className={styles.compositionTools}>
              <label>
                Ambiance
                <select
                  value={doc.theme}
                  onChange={(e) =>
                    change({
                      ...doc,
                      theme: e.target.value as NewsletterDocument['theme'],
                    })
                  }
                >
                  {Object.entries(THEMES).map(([id, t]) => (
                    <option key={id} value={id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label="Annuler la dernière modification du contenu"
                  disabled={!history.canUndo}
                  onClick={() => {
                    history.undo();
                    mark?.();
                  }}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label="Rétablir la modification du contenu"
                  disabled={!history.canRedo}
                  onClick={() => {
                    history.redo();
                    mark?.();
                  }}
                >
                  <Redo2 size={17} />
                </button>
              </div>
            </div>
            <div
              className={styles.blockLibrary}
              role="group"
              aria-label="Ajouter un bloc"
            >
              {Object.entries(BLOCK_LABELS).map(([type, label]) => (
                <button
                  type="button"
                  key={type}
                  disabled={doc.blocks.length >= MAX_BLOCKS}
                  onClick={() => add(type as NewsletterBlock['type'])}
                >
                  <Plus size={15} />
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.blockCount}>
              {doc.blocks.length}/{MAX_BLOCKS} blocs · flèches disponibles pour
              réordonner au clavier.
            </p>
            <details className={styles.designPanel}>
              <summary>Style global & modèles réutilisables</summary>
              <div className={styles.fields}>
                <label>
                  Typographie du contenu
                  <select
                    value={doc.design?.font ?? 'sans'}
                    onChange={(e) =>
                      change({
                        ...doc,
                        design: {
                          fontSize: 16,
                          accent: 'forest',
                          ...doc.design,
                          font: e.target.value as 'sans' | 'serif',
                        },
                      })
                    }
                  >
                    <option value="sans">Sans serif · Arial</option>
                    <option value="serif">Éditoriale · Georgia</option>
                  </select>
                </label>
                <label>
                  Taille du texte
                  <select
                    value={doc.design?.fontSize ?? 16}
                    onChange={(e) =>
                      change({
                        ...doc,
                        design: {
                          font: 'sans',
                          accent: 'forest',
                          ...doc.design,
                          fontSize: Number(e.target.value) as 16 | 18,
                        },
                      })
                    }
                  >
                    <option value={16}>16 px</option>
                    <option value={18}>18 px · lecture confortable</option>
                  </select>
                </label>
                <label>
                  Couleur des boutons
                  <select
                    value={doc.design?.accent ?? 'forest'}
                    onChange={(e) =>
                      change({
                        ...doc,
                        design: {
                          font: 'sans',
                          fontSize: 16,
                          ...doc.design,
                          accent: e.target.value as
                            'forest' | 'bronze' | 'plum',
                        },
                      })
                    }
                  >
                    <option value="forest">Forêt</option>
                    <option value="bronze">Bronze</option>
                    <option value="plum">Prune</option>
                  </select>
                </label>
              </div>
              <div className={styles.templateTools}>
                <button type="button" onClick={exportTemplate}>
                  <Download size={16} /> Exporter le modèle
                </button>
                <label>
                  Importer un modèle
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      void importTemplate(e.target.files?.[0]);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <small>
                Fichier Caldera réutilisable. Le modèle contient la composition
                et son style, sans destinataires ni programmation.
              </small>
              {importError && <p role="alert">{importError}</p>}
            </details>
            {doc.blocks.length > 0 && (
              <details className={styles.outline}>
                <summary>Plan du message · {doc.blocks.length} blocs</summary>
                <ol>
                  {doc.blocks.map((b, i) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        aria-current={active === b.id ? 'true' : undefined}
                        onClick={() => {
                          setActive(b.id);
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`${prefix}-${b.id}`)
                              ?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                              }),
                          );
                        }}
                      >
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {BLOCK_LABELS[b.type]}
                        {b.type === 'heading'
                          ? ` · ${b.text}`
                          : b.type === 'product'
                            ? ` · ${b.name}`
                            : ''}
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {!doc.blocks.length && (
              <div className={styles.emptyCanvas}>
                <Mail size={32} />
                <h4>À vous d’écrire la suite.</h4>
                <p>Choisissez un modèle ou ajoutez votre premier bloc.</p>
                <button type="button" onClick={() => add('text')}>
                  <Plus size={16} /> Ajouter du texte
                </button>
              </div>
            )}
            <div className={styles.blockList}>
              {doc.blocks.map((block, index) => (
                <article
                  key={block.id}
                  className={`${styles.block} ${active === block.id ? styles.activeBlock : ''}`}
                  onDragOver={(e) => {
                    if (dragging) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(e) => {
                    if (dragging) {
                      e.preventDefault();
                      move(dragging, index);
                      setDragging(null);
                    }
                  }}
                >
                  <div className={styles.blockHeader}>
                    <span
                      draggable
                      onDragStart={(e) => {
                        setDragging(block.id);
                        e.dataTransfer.setData('text/plain', block.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={styles.dragHandle}
                      title="Glisser pour déplacer"
                    >
                      <GripVertical size={18} />
                    </span>
                    <button
                      type="button"
                      className={styles.blockTitle}
                      aria-expanded={active === block.id}
                      aria-controls={`${prefix}-${block.id}`}
                      onClick={() =>
                        setActive(active === block.id ? null : block.id)
                      }
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{BLOCK_LABELS[block.type]}</strong>
                      <small>
                        {block.type === 'text'
                          ? block.text.replace(/[#*]/g, '').slice(0, 45)
                          : block.type === 'product'
                            ? block.name
                            : block.type === 'button'
                              ? block.label
                              : ''}
                      </small>
                    </button>
                    <div className={styles.blockActions}>
                      <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={`Monter le bloc ${index + 1}`}
                        disabled={index === 0}
                        onClick={() => move(block.id, index - 1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={`Descendre le bloc ${index + 1}`}
                        disabled={index === doc.blocks.length - 1}
                        onClick={() => move(block.id, index + 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={`Dupliquer le bloc ${index + 1}`}
                        disabled={doc.blocks.length >= MAX_BLOCKS}
                        onClick={() => {
                          const copy = { ...block, id: crypto.randomUUID() };
                          const blocks = [...doc.blocks];
                          blocks.splice(index + 1, 0, copy);
                          change({ ...doc, blocks });
                          setActive(copy.id);
                        }}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={`Supprimer le bloc ${index + 1}`}
                        onClick={() => {
                          change({
                            ...doc,
                            blocks: doc.blocks.filter((b) => b.id !== block.id),
                          });
                          setAnnouncement(
                            'Bloc supprimé. Vous pouvez annuler cette modification.',
                          );
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {active !== block.id && (
                    <BlockMiniPreview
                      block={block}
                      doc={doc}
                      onEdit={() => setActive(block.id)}
                    />
                  )}
                  <div
                    id={`${prefix}-${block.id}`}
                    hidden={active !== block.id}
                    className={styles.blockBody}
                  >
                    {active === block.id && (
                      <BlockInspector
                        block={block}
                        products={products}
                        onChange={(updated) =>
                          change({
                            ...doc,
                            blocks: doc.blocks.map((b) =>
                              b.id === block.id ? updated : b,
                            ),
                          })
                        }
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
            <button
              type="button"
              className={styles.continueButton}
              onClick={() => setStep(2)}
            >
              Vérifier la campagne <ChevronRight size={16} />
            </button>
          </section>
          <section
            data-step="2"
            hidden={step !== 2}
            aria-labelledby={`${prefix}-review`}
          >
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>03 / AVANT LE DÉPART</span>
              <h3 id={`${prefix}-review`}>Chaque détail compte</h3>
              <p>
                Enregistrez votre travail avant de tester ou de programmer
                l’envoi.
              </p>
            </div>
            <ul className={styles.checklist}>
              {[
                {
                  ok: Boolean(value.subject.trim()),
                  label: 'Objet renseigné',
                  detail: `${value.subject.length} caractères`,
                },
                {
                  ok: Boolean(value.preheader.trim()),
                  label: 'Texte d’aperçu',
                  detail: 'Conseillé pour compléter votre objet',
                },
                {
                  ok: Boolean(value.heading.trim()),
                  label: 'Titre principal renseigné',
                  detail: 'Visible à l’ouverture de l’e-mail',
                },
                {
                  ok: !issues.length,
                  label: 'Contenu et liens',
                  detail: issues.length
                    ? `${issues.length} point(s) à corriger`
                    : 'Blocs et liens vérifiés',
                },
                {
                  ok: bytes <= 95000,
                  label: 'Poids du message',
                  detail: `${Math.ceil(bytes / 1024)} Ko de HTML · limite de sécurité : 95 000 octets`,
                },
                {
                  ok: true,
                  label: 'Pied de page inclus',
                  detail: 'Discord, Instagram et désinscription personnelle',
                },
              ].map((item) => (
                <li key={item.label}>
                  <span
                    className={item.ok ? styles.checkOk : styles.checkWarning}
                  >
                    {item.ok ? <Check size={16} /> : <span>!</span>}
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
            {issues.length > 0 && (
              <div className={styles.issueList}>
                <h4>À compléter avant l’envoi</h4>
                <ul>
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                <button type="button" onClick={() => setStep(1)}>
                  Revenir à la composition
                </button>
              </div>
            )}
            <details className={styles.linkReview}>
              <summary>
                Vérifier les destinations · {links.length} lien(s)
              </summary>
              {links.length ? (
                <ul>
                  {links.map(({ block, href }) => (
                    <li key={`${block}-${href}`}>
                      <span>Bloc {block}</span>
                      <a
                        href={safeNewsletterLink(href) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {href}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Aucun lien dans le contenu. Ajoutez un bouton utile si votre
                  campagne invite à découvrir un produit ou un guide.
                </p>
              )}
              <small>
                Contrôle de format uniquement. Ouvrez les liens pour vérifier la
                page cible et les informations commerciales.
              </small>
            </details>
            <p className={styles.notice}>
              Les modèles contiennent des indications à personnaliser. Relisez
              les faits, prix et disponibilités : aucun envoi ne part depuis cet
              éditeur.
            </p>
          </section>
        </div>
        {value.chapterId &&
        !value.carnetCustomized &&
        value.carnetSource?.id !== value.chapterId ? (
          <aside className={styles.notice}>
            Enregistrez la campagne pour charger l’extrait du Carnet
            sélectionné. Le récit complet reste dans les Carnets.
          </aside>
        ) : (
          <NewsletterCampaignPreview value={previewValue} />
        )}
      </div>
      <p className={styles.srOnly} role="status">
        {announcement}
      </p>
      <dialog ref={templateDialog} className={styles.templateDialog}>
        <h3>Remplacer la composition ?</h3>
        <p>
          Le modèle remplacera les blocs actuels. Le bouton Annuler permettra de
          retrouver votre composition.
        </p>
        <div>
          <button type="button" onClick={() => templateDialog.current?.close()}>
            Conserver mes blocs
          </button>
          <button
            type="button"
            onClick={() => {
              if (imported) {
                change(imported);
                setActive(imported.blocks[0]?.id ?? null);
                setStep(1);
                setAnnouncement('Modèle importé.');
                setImported(null);
              } else if (template) applyTemplate(template);
              templateDialog.current?.close();
            }}
          >
            Appliquer le modèle
          </button>
        </div>
      </dialog>
    </div>
  );
}
export function NewsletterCampaignEditor({
  value,
  action,
  readOnly = false,
  products = [],
  chapters = [],
  revision,
}: {
  value: CampaignEditorValue;
  revision?: string;
  action?: AdminAction;
  readOnly?: boolean;
  products?: NewsletterProductOption[];
  chapters?: CampaignChapterOption[];
}) {
  if (readOnly) return <NewsletterCampaignPreview value={value} />;
  if (!action) return null;
  return (
    <div className={styles.studio}>
      <AdminForm
        action={action}
        fieldsKey={revision}
        submit="Enregistrer le brouillon"
      >
        <Studio initial={value} products={products} chapters={chapters} />
      </AdminForm>
    </div>
  );
}
