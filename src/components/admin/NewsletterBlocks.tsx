'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ImagePlus, Search } from 'lucide-react';
import { renderMarkdown } from '@/lib/content/markdown';
import {
  parseNewsletterDocument,
  serializeNewsletterDocument,
  renderNewsletterBlocks,
  TONES,
  BLOCK_LABELS,
  type NewsletterBlock,
  type NewsletterBlockStyle,
  type NewsletterDocument,
} from '@/lib/newsletter/document';
import type { NewsletterProductOption } from '@/lib/newsletter/studio';
import { uploadNewsletterImageAction } from '@/lib/newsletter/admin-actions';
import { useAdminFormChange } from './AdminForm';
import styles from './NewsletterCampaignEditor.module.scss';
const RichText = dynamic(() => import('./NewsletterRichText'), {
  ssr: false,
  loading: () => <p>Chargement de l’éditeur visuel…</p>,
});

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
  const [search, setSearch] = useState('');
  const mark = useAdminFormChange();
  const patch = (values: Record<string, unknown>) =>
    onChange({ ...block, ...values } as NewsletterBlock);
  if (block.type === 'text')
    return <RichText value={block.text} onChange={(text) => patch({ text })} />;
  if (block.type === 'heading')
    return (
      <div className={styles.fields}>
        <label>
          Titre
          <input
            value={block.text}
            maxLength={160}
            onChange={(e) => patch({ text: e.target.value })}
          />
        </label>
        <label>
          Niveau
          <select
            value={block.level}
            onChange={(e) => patch({ level: Number(e.target.value) })}
          >
            <option value={2}>Titre de section (H2)</option>
            <option value={3}>Sous-titre (H3)</option>
          </select>
        </label>
      </div>
    );
  if (block.type === 'feature')
    return (
      <div className={styles.settingsFields}>
        <ImageUpload onUpload={(src) => patch({ src })} />
        <label>
          Chemin de l’image
          <input
            value={block.src}
            maxLength={500}
            placeholder="/media/… ou /assets/…"
            onChange={(e) => patch({ src: e.target.value })}
          />
        </label>
        <label>
          Texte alternatif
          <input
            value={block.alt}
            maxLength={300}
            onChange={(e) => patch({ alt: e.target.value })}
          />
        </label>
        <label>
          Titre de la mise en avant
          <input
            value={block.title}
            maxLength={160}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <RichText
          label="Texte de la mise en avant"
          value={block.text}
          maxLength={10000}
          onChange={(text) => patch({ text })}
        />
        <label>
          Disposition sur ordinateur
          <select
            value={block.placement}
            onChange={(e) => patch({ placement: e.target.value })}
          >
            <option value="left">Image à gauche</option>
            <option value="right">Image à droite</option>
            <option value="top">Image au-dessus</option>
          </select>
          <small>
            Sur mobile, les colonnes sont empilées dans l’ordre de lecture.
          </small>
        </label>
        <div className={styles.fields}>
          <label>
            Bouton facultatif
            <input
              value={block.label}
              maxLength={80}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </label>
          <label>
            Destination du bouton
            <input
              value={block.href}
              maxLength={500}
              onChange={(e) => patch({ href: e.target.value })}
              placeholder="/catalogue"
            />
          </label>
        </div>
      </div>
    );
  if (block.type === 'columns')
    return (
      <div className={styles.columnEditors}>
        {block.columns.map((column, index) => (
          <section key={index}>
            <h4>Colonne {index + 1}</h4>
            <label>
              Titre de la colonne {index + 1}
              <input
                value={column.title}
                maxLength={160}
                onChange={(e) =>
                  patch({
                    columns: block.columns.map((c, i) =>
                      i === index ? { ...c, title: e.target.value } : c,
                    ),
                  })
                }
              />
            </label>
            <RichText
              label={`Texte de la colonne ${index + 1}`}
              maxLength={5000}
              value={column.text}
              onChange={(text) =>
                patch({
                  columns: block.columns.map((c, i) =>
                    i === index ? { ...c, text } : c,
                  ),
                })
              }
            />
            <label>
              Texte du lien (facultatif)
              <input
                value={column.label}
                maxLength={80}
                onChange={(e) =>
                  patch({
                    columns: block.columns.map((c, i) =>
                      i === index ? { ...c, label: e.target.value } : c,
                    ),
                  })
                }
              />
            </label>
            <label>
              Destination du lien
              <input
                value={column.href}
                maxLength={500}
                onChange={(e) =>
                  patch({
                    columns: block.columns.map((c, i) =>
                      i === index ? { ...c, href: e.target.value } : c,
                    ),
                  })
                }
              />
            </label>
          </section>
        ))}
      </div>
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
export function BlockInspector({
  block,
  products,
  onChange,
}: {
  block: NewsletterBlock;
  products: NewsletterProductOption[];
  onChange: (b: NewsletterBlock) => void;
}) {
  const [tab, setTab] = useState<'content' | 'style'>('content');
  const mark = useAdminFormChange();
  const style = block.style ?? {
    align: 'left',
    tone: 'plain',
    padding: 0,
    radius: 0,
  };
  function patch(values: Partial<NewsletterBlockStyle>) {
    onChange({ ...block, style: { ...style, ...values } });
    mark?.();
  }
  return (
    <>
      <div
        className={styles.inspectorTabs}
        role="group"
        aria-label="Réglages du bloc"
      >
        <button
          type="button"
          aria-pressed={tab === 'content'}
          onClick={() => setTab('content')}
        >
          Contenu
        </button>
        <button
          type="button"
          aria-pressed={tab === 'style'}
          onClick={() => setTab('style')}
        >
          Apparence
        </button>
      </div>
      {tab === 'content' ? (
        <BlockFields block={block} products={products} onChange={onChange} />
      ) : (
        <div className={styles.fields}>
          <label>
            Alignement
            <select
              value={style.align}
              onChange={(e) =>
                patch({
                  align: e.target.value as NewsletterBlockStyle['align'],
                })
              }
            >
              <option value="left">Gauche</option>
              <option value="center">Centré</option>
              <option value="right">Droite</option>
            </select>
          </label>
          <label>
            Fond du bloc
            <select
              value={style.tone}
              onChange={(e) =>
                patch({ tone: e.target.value as NewsletterBlockStyle['tone'] })
              }
            >
              <option value="plain">Transparent</option>
              <option value="paper">Blanc</option>
              <option value="cream">Crème</option>
              <option value="sage">Sauge</option>
            </select>
          </label>
          <label>
            Marge intérieure
            <select
              value={style.padding}
              onChange={(e) =>
                patch({
                  padding: Number(
                    e.target.value,
                  ) as NewsletterBlockStyle['padding'],
                })
              }
            >
              {[0, 16, 24, 32].map((n) => (
                <option key={n} value={n}>
                  {n} px
                </option>
              ))}
            </select>
          </label>
          <label>
            Arrondi
            <select
              value={style.radius}
              onChange={(e) =>
                patch({
                  radius: Number(
                    e.target.value,
                  ) as NewsletterBlockStyle['radius'],
                })
              }
            >
              {[0, 8, 16].map((n) => (
                <option key={n} value={n}>
                  {n} px
                </option>
              ))}
            </select>
          </label>
          <div
            className={styles.styleSample}
            style={{
              textAlign: style.align,
              background: TONES[style.tone],
              padding: style.padding,
              borderRadius: style.radius,
            }}
          >
            Votre contenu, à votre image.
          </div>
          <small className={styles.full}>
            Palettes à contraste lisible. Les clients e-mail peuvent simplifier
            les arrondis.
          </small>
        </div>
      )}
    </>
  );
}
export function BlockMiniPreview({
  block,
  doc,
  onEdit,
}: {
  block: NewsletterBlock;
  doc: NewsletterDocument;
  onEdit: () => void;
}) {
  let html = '';
  try {
    const safe = parseNewsletterDocument(
      serializeNewsletterDocument({ ...doc, blocks: [block] }),
      true,
    )!;
    html = renderNewsletterBlocks(
      safe,
      (source) => renderMarkdown(source, { headingLevel: 2 }),
      (href) => href,
      '',
    )
      .replace(/<a\b[^>]*>/g, '<span>')
      .replace(/<\/a>/g, '</span>');
  } catch {
    html = '<p>Complétez ce bloc pour afficher son aperçu.</p>';
  }
  return (
    <div
      className={styles.blockMini}
      role="button"
      tabIndex={0}
      aria-label={`Modifier le bloc ${BLOCK_LABELS[block.type]}`}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
    >
      <div
        dangerouslySetInnerHTML={{
          __html: html || '<p>Votre contenu apparaîtra ici.</p>',
        }}
      />
      <span className={styles.editHint}>Cliquer pour modifier</span>
    </div>
  );
}
