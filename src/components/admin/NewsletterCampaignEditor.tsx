'use client';
import {
  useEffect,
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Download,
  GripVertical,
  ImagePlus,
  LayoutTemplate,
  Mail,
  Monitor,
  Plus,
  Redo2,
  Search,
  Smartphone,
  Trash2,
  Undo2,
} from 'lucide-react';
import { AdminForm, useAdminFormChange } from './AdminForm';
import type { AdminAction } from '@/lib/admin/action-types';
import { renderNewsletterCampaignEmail } from '@/emails/newsletter-campaign';
import {
  BLOCK_LABELS,
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
import { uploadNewsletterImageAction } from '@/lib/newsletter/admin-actions';
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(640);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCanvasWidth(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'text'>(
    'desktop',
  );
  const deferred = useDeferredValue(value);
  const rendered = useMemo(() => renderPreview(deferred), [deferred]);
  // Preview uses the production renderer. Relative image URLs let local QA use its own media.
  const html = rendered.html
    .replaceAll('src="https://lesterresdecaldera.fr/', 'src="/')
    .replace('<head>', '<head><base target="_blank">');
  const frameWidth = device === 'mobile' ? 375 : 640;
  const frameScale = Math.min(1, canvasWidth / frameWidth);
  function download() {
    const url = URL.createObjectURL(
      new Blob([rendered.html], { type: 'text/html;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'caldera-newsletter.html';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <aside className={styles.previewPanel} aria-label="Aperçu de la campagne">
      <div className={styles.previewTop}>
        <div>
          <span className={styles.eyebrow}>EN DIRECT</span>
          <h2>Aperçu de l’e-mail</h2>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Télécharger l’e-mail HTML"
          title="Télécharger le HTML"
          onClick={download}
        >
          <Download size={17} />
        </button>
      </div>
      <div
        className={styles.devices}
        role="group"
        aria-label="Format de l’aperçu"
      >
        <button
          type="button"
          aria-pressed={device === 'desktop'}
          onClick={() => setDevice('desktop')}
        >
          <Monitor size={16} /> Ordinateur
        </button>
        <button
          type="button"
          aria-pressed={device === 'mobile'}
          onClick={() => setDevice('mobile')}
        >
          <Smartphone size={16} /> Mobile
        </button>
        <button
          type="button"
          aria-pressed={device === 'text'}
          onClick={() => setDevice('text')}
        >
          Texte
        </button>
      </div>
      <div className={styles.inbox}>
        <span className={styles.avatar}>
          <Mail size={18} />
        </span>
        <div>
          <strong>Les Terres de Caldera</strong>
          <b>{value.subject || 'L’objet apparaîtra ici'}</b>
          <span>
            {value.preheader || 'Ajoutez un aperçu pour donner envie d’ouvrir.'}
          </span>
        </div>
      </div>
      <div className={styles.previewCanvas} ref={canvasRef}>
        {device === 'text' ? (
          <pre className={styles.plainText}>{rendered.text}</pre>
        ) : (
          <div
            className={styles.frameShell}
            style={{ width: frameWidth * frameScale, height: 900 * frameScale }}
          >
            <iframe
              className={`${styles.emailFrame} ${device === 'mobile' ? styles.mobileFrame : ''}`}
              style={{
                width: frameWidth,
                height: 900,
                transform: `scale(${frameScale})`,
                transformOrigin: 'top left',
              }}
              title={`Aperçu e-mail ${device === 'mobile' ? 'mobile' : 'ordinateur'}`}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={html}
            />
          </div>
        )}
      </div>
      <p className={styles.previewNote}>
        Même modèle que l’envoi réel. Le pied de page inclut vos réseaux et la
        désinscription ; un test en boîte mail reste recommandé.
      </p>
    </aside>
  );
}
function ImageUpload({ onUpload }: { onUpload: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mark = useAdminFormChange();
  async function upload(file?: File) {
    if (!file || busy) return;
    if (
      file.size > 4 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ) {
      setError('JPEG, PNG ou WebP · 4 Mo maximum.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.set('file', file);
      const result = await uploadNewsletterImageAction(data);
      if (result.url) {
        onUpload(result.url);
        mark?.();
      } else setError(result.error ?? 'Téléversement impossible.');
    } catch {
      setError('Téléversement impossible. Réessayez.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={styles.dropzone}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files[0]);
      }}
      aria-busy={busy}
    >
      <ImagePlus size={22} />
      <strong>{busy ? 'Téléversement…' : 'Déposez votre image ici'}</strong>
      <label>
        Ou choisir un fichier
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.currentTarget.value = '';
          }}
        />
      </label>
      <small>JPEG, PNG ou WebP · 4 Mo · optimisée en WebP</small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function BlockFields({
  block,
  onChange,
  products,
}: {
  block: NewsletterBlock;
  onChange: (block: NewsletterBlock) => void;
  products: NewsletterProductOption[];
}) {
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const [search, setSearch] = useState('');
  const mark = useAdminFormChange();
  const patch = (values: Record<string, string | number>) =>
    onChange({ ...block, ...values } as NewsletterBlock);
  function insert(before: string, after = '', placeholder = 'texte') {
    if (block.type !== 'text' || !area.current) return;
    const start = area.current.selectionStart,
      end = area.current.selectionEnd;
    const selected = block.text.slice(start, end) || placeholder;
    patch({
      text:
        block.text.slice(0, start) +
        before +
        selected +
        after +
        block.text.slice(end),
    });
    mark?.();
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  }
  if (block.type === 'text')
    return (
      <>
        <label htmlFor={id}>Message</label>
        <div
          className={styles.toolbar}
          role="group"
          aria-label="Mise en forme du message"
        >
          <button
            type="button"
            onClick={() => insert('**', '**', 'texte en gras')}
          >
            <b>Gras</b>
          </button>
          <button
            type="button"
            onClick={() => insert('*', '*', 'texte en italique')}
          >
            <i>Italique</i>
          </button>
          <button
            type="button"
            onClick={() => insert('\n\n## ', '', 'Intertitre')}
          >
            Titre
          </button>
          <button type="button" onClick={() => insert('\n- ', '', 'Élément')}>
            Liste
          </button>
          <button
            type="button"
            onClick={() => insert('[', '](/catalogue)', 'texte du lien')}
          >
            Lien
          </button>
        </div>
        <textarea
          id={id}
          ref={area}
          value={block.text}
          maxLength={20000}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder="Votre message. Sélectionnez du texte pour le mettre en forme."
          rows={8}
        />
        <small>
          Gras, italique, titres, listes et liens. Le HTML brut est neutralisé.
        </small>
      </>
    );
  if (block.type === 'image')
    return (
      <div className={styles.fields}>
        <div className={styles.full}>
          <ImageUpload onUpload={(src) => patch({ src })} />
        </div>
        <label className={styles.full}>
          Chemin de l’image
          <input
            value={block.src}
            maxLength={500}
            placeholder="/media/… ou /assets/…"
            onChange={(e) => patch({ src: e.target.value })}
          />
        </label>
        <label className={styles.full}>
          Texte alternatif
          <input
            value={block.alt}
            maxLength={300}
            onChange={(e) => patch({ alt: e.target.value })}
            placeholder="Décrivez l’image pour les lecteurs d’écran"
          />
        </label>
        <label>
          Légende
          <input
            value={block.caption}
            maxLength={500}
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </label>
        <label>
          Lien au clic (facultatif)
          <input
            value={block.href}
            maxLength={500}
            onChange={(e) => patch({ href: e.target.value })}
            placeholder="/catalogue"
          />
        </label>
      </div>
    );
  if (block.type === 'button')
    return (
      <div className={styles.fields}>
        <label>
          Texte du bouton
          <input
            value={block.label}
            maxLength={80}
            onChange={(e) => patch({ label: e.target.value })}
          />
        </label>
        <label>
          Lien du bouton
          <input
            value={block.href}
            maxLength={500}
            onChange={(e) => patch({ href: e.target.value })}
            placeholder="/catalogue ou https://…"
          />
        </label>
      </div>
    );
  if (block.type === 'product') {
    const filtered = products.filter((p) =>
      p.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
    );
    return (
      <>
        <label>
          Rechercher un produit
          <div className={styles.search}>
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom du produit"
            />
          </div>
        </label>
        <label>
          Produit du catalogue
          <select
            value={block.productId}
            onChange={(e) => {
              const p = products.find((p) => p.id === e.target.value);
              if (p) {
                onChange({
                  ...block,
                  productId: p.id,
                  name: p.name,
                  image: p.image,
                  price: p.price,
                  href: p.href,
                  description: p.description,
                });
                mark?.();
              }
            }}
          >
            <option value="">Choisir un produit publié</option>
            {block.productId &&
              !filtered.some((p) => p.id === block.productId) && (
                <option value={block.productId}>
                  {block.name} — sélection actuelle
                </option>
              )}
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {!products.length && (
          <p className={styles.notice}>
            Aucun produit réel publié. Les produits de démonstration sont exclus
            des campagnes.
          </p>
        )}
        {block.productId && (
          <div className={styles.productSummary}>
            <strong>{block.name}</strong>
            <span>{block.price}</span>
            <small>
              Prix copié lors de la sélection. Vérifiez-le avant l’envoi.
            </small>
          </div>
        )}
        <label>
          Conseil ou description
          <textarea
            rows={3}
            maxLength={500}
            value={block.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
      </>
    );
  }
  if (block.type === 'spacer')
    return (
      <label>
        Hauteur
        <select
          value={block.height}
          onChange={(e) => patch({ height: Number(e.target.value) })}
        >
          <option value={16}>16 px — léger</option>
          <option value={32}>32 px — standard</option>
          <option value={48}>48 px — aéré</option>
        </select>
      </label>
    );
  return (
    <p className={styles.muted}>
      Une ligne discrète sépare deux parties de votre message.
    </p>
  );
}
function Studio({
  initial,
  products,
}: {
  initial: CampaignEditorValue;
  products: NewsletterProductOption[];
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
  const [step, setStep] = useState(0);
  const [active, setActive] = useState<string | null>(
    doc.blocks[0]?.id ?? null,
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
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
    change({ ...doc, blocks: [...doc.blocks, b] });
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
      setTemplate(t);
      templateDialog.current?.showModal();
    } else applyTemplate(t);
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
      <nav className={styles.steps} aria-label="Étapes de création">
        {STEP_LABELS.map((label, index) => (
          <button
            type="button"
            key={label}
            aria-current={step === index ? 'step' : undefined}
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
                  maxLength={160}
                  value={value.heading}
                  onChange={(e) => field('heading', e.target.value)}
                  placeholder="Votre prochaine exploration"
                />
              </label>
            </div>
            <button
              type="button"
              className={styles.continueButton}
              onClick={() => setStep(1)}
            >
              Composer le message <ChevronRight size={16} />
            </button>
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
                  <div
                    id={`${prefix}-${block.id}`}
                    hidden={active !== block.id}
                    className={styles.blockBody}
                  >
                    <BlockFields
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
            <p className={styles.notice}>
              Les modèles contiennent des indications à personnaliser. Relisez
              les faits, prix et disponibilités : aucun envoi ne part depuis cet
              éditeur.
            </p>
          </section>
        </div>
        <NewsletterCampaignPreview value={previewValue} />
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
              if (template) applyTemplate(template);
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
  revision,
}: {
  value: CampaignEditorValue;
  revision?: string;
  action?: AdminAction;
  readOnly?: boolean;
  products?: NewsletterProductOption[];
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
        <Studio initial={value} products={products} />
      </AdminForm>
    </div>
  );
}
