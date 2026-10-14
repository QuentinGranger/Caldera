'use client';
import { useEffect, useId, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { searchCarnetProductsAction } from '@/lib/carnets/actions';
import {
  MAX_COMPTOIR_PRODUCTS,
  addComptoirProduct,
  replaceComptoirProduct,
  reorderComptoirProduct,
} from '@/lib/carnets/comptoir-selection';
import Image from 'next/image';
import type { CarnetProduct } from '@/lib/carnets/comptoir';
import styles from './CarnetEditor.module.scss';
export function CarnetComptoir({
  ids,
  products,
  onChange,
  onProductsChange,
}: {
  ids: string[];
  products: CarnetProduct[];
  onChange: (ids: string[], products?: CarnetProduct[]) => void;
  onProductsChange?: (products: CarnetProduct[]) => void;
}) {
  const [search, setSearch] = useState(''),
    [results, setResults] = useState(products),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false),
    [replacement, setReplacement] = useState<string | null>(null),
    [dragged, setDragged] = useState<string | null>(null),
    [announcement, setAnnouncement] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const pickerId = useId(),
    selectedKey = JSON.stringify(ids);
  useEffect(() => {
    let active = true,
      request = 0;
    async function refresh() {
      const sequence = ++request;
      if (active) setBusy(true);
      const data = new FormData();
      data.set('search', search);
      data.set('selectedIds', selectedKey);
      try {
        const rows = await searchCarnetProductsAction(data);
        if (active && sequence === request) {
          setResults(rows);
          onProductsChange?.(rows);
          setError('');
        }
      } catch {
        if (active && sequence === request)
          setError(
            'Le stock n’a pas pu être actualisé. Réessayez ; il sera revérifié côté serveur avant programmation.',
          );
      } finally {
        if (active && sequence === request) setBusy(false);
      }
    }
    const timer = setTimeout(() => void refresh(), 300),
      focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('focus', focus);
    };
  }, [search, selectedKey, onProductsChange, refreshToken]);
  // Prefer the last server response to the initial page snapshot (stock can change).
  const combined = [
    ...results,
    ...products.filter((p) => !results.some((row) => row.id === p.id)),
  ];
  const selected = ids.map((id) => combined.find((p) => p.id === id));
  const options = results.filter(
    (p) =>
      p.eligible &&
      !ids.includes(p.id) &&
      p.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  );
  const unavailable = selected.filter((p) => !p?.eligible);
  const replacingIndex = replacement ? ids.indexOf(replacement) : -1;
  function commit(next: string[], message: string) {
    onChange(next, combined);
    setAnnouncement(message);
    setError('');
  }
  function move(source: string, target: string) {
    try {
      commit(
        reorderComptoirProduct(ids, source, target),
        'Ordre du Comptoir modifié. Pensez à enregistrer.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Déplacement impossible.');
    }
  }
  function choose(product: CarnetProduct) {
    try {
      commit(
        replacement
          ? replaceComptoirProduct(ids, replacement, product.id)
          : addComptoirProduct(ids, product.id),
        `${product.name} ${replacement ? 'remplace le produit sélectionné' : 'ajouté au Comptoir'}. Pensez à enregistrer.`,
      );
      setPickerOpen(false);
      setReplacement(null);
      setSearch('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sélection impossible.');
    }
  }
  return (
    <section
      id="carnet-comptoir"
      className={styles.workflowSection}
      aria-labelledby="comptoir-title"
    >
      <span className={styles.eyebrow}>02 / LE COMPTOIR</span>
      <h2 id="comptoir-title">Les produits de cette édition</h2>
      <p>
        Une courte sélection éditoriale, jusqu’à trois produits. La présentation
        de l’email est automatique. Le Comptoir peut rester vide.
      </p>
      <input type="hidden" name="productIds" value={JSON.stringify(ids)} />
      {unavailable.length > 0 && (
        <div role="alert" className={styles.stockAlert}>
          <strong>Envoi bloqué : vérifiez le Comptoir</strong>
          <ul>
            {selected.map((p, i) =>
              !p?.eligible ? (
                <li key={ids[i]}>
                  Produit {i + 1} · {p?.name ?? 'Produit inaccessible'} :{' '}
                  {p?.unavailableReason ?? 'indisponible'}. Remplacez-le ou
                  supprimez-le avant de programmer l’email.
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}
      <ol className={styles.products}>
        {selected.map((p, index) => (
          <li
            key={ids[index]}
            data-dragging={dragged === ids[index] || undefined}
            onDragOver={(e) => {
              if (dragged && ids.includes(dragged)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const source = e.dataTransfer.getData('text/plain');
              if (dragged && source === dragged && ids.includes(source))
                move(source, ids[index]!);
              setDragged(null);
            }}
          >
            <button
              type="button"
              className={styles.dragHandle}
              draggable
              aria-label={`Déplacer le produit ${index + 1} : ${p?.name ?? 'produit inaccessible'}`}
              title="Glisser pour déplacer ; les boutons Monter et Descendre sont également disponibles"
              onDragStart={(e) => {
                setDragged(ids[index]!);
                e.dataTransfer.setData('text/plain', ids[index]!);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDragged(null)}
            >
              <GripVertical size={18} aria-hidden="true" />
            </button>
            {p?.image && (
              <Image src={p.image} alt="" width={64} height={64} unoptimized />
            )}
            <div>
              <small className={styles.productSlot}>Produit {index + 1}</small>
              <strong>{p?.name ?? 'Produit supprimé ou inaccessible'}</strong>
              <span>{p?.price}</span>
              <small>
                {p?.eligible
                  ? `${p.stock} disponibles`
                  : (p?.unavailableReason ?? 'Indisponible')}
              </small>
            </div>
            <div className={styles.productActions}>
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Monter ${p?.name ?? 'ce produit'}`}
                onClick={() => move(ids[index]!, ids[index - 1]!)}
              >
                Monter
              </button>
              <button
                type="button"
                disabled={index === ids.length - 1}
                aria-label={`Descendre ${p?.name ?? 'ce produit'}`}
                onClick={() => move(ids[index]!, ids[index + 1]!)}
              >
                Descendre
              </button>
              <button
                type="button"
                aria-label={`Remplacer ${p?.name ?? 'ce produit'}`}
                onClick={() => {
                  setReplacement(ids[index]!);
                  setSearch('');
                  setPickerOpen(true);
                }}
              >
                Remplacer
              </button>
              <button
                type="button"
                aria-label={`Supprimer ${p?.name ?? 'ce produit'}`}
                onClick={() => {
                  commit(
                    ids.filter((_, i) => i !== index),
                    'Produit supprimé du Comptoir. Pensez à enregistrer.',
                  );
                  if (replacement === ids[index]) {
                    setReplacement(null);
                    setPickerOpen(false);
                  }
                }}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!ids.length && <p>Aucun produit associé à cette édition.</p>}
      <div className={styles.comptoirToolbar}>
        <button
          type="button"
          disabled={ids.length >= MAX_COMPTOIR_PRODUCTS}
          aria-controls={pickerId}
          aria-expanded={pickerOpen && !replacement}
          onClick={() => {
            setReplacement(null);
            setSearch('');
            setPickerOpen(!pickerOpen || Boolean(replacement));
          }}
        >
          Ajouter un produit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setRefreshToken((v) => v + 1)}
        >
          Actualiser le stock
        </button>
        <small>
          {ids.length}/{MAX_COMPTOIR_PRODUCTS} produits
          {ids.length >= MAX_COMPTOIR_PRODUCTS ? ' · maximum atteint' : ''}
        </small>
      </div>
      <div
        id={pickerId}
        hidden={!pickerOpen}
        className={styles.picker}
        aria-label="Sélection d’un produit du Comptoir"
      >
        <h3>
          {replacement
            ? `Remplacer le produit ${replacingIndex + 1}`
            : 'Ajouter un produit au Comptoir'}
        </h3>
        <p>
          {replacement
            ? 'Choisissez son remplaçant. Les autres produits de la sélection seront conservés.'
            : 'Recherchez parmi les produits actifs disposant de stock.'}
        </p>
        <label>
          Rechercher un produit
          <input
            type="search"
            value={search}
            maxLength={120}
            onChange={(e) => {
              e.stopPropagation();
              setSearch(e.target.value);
            }}
          />
        </label>
        {busy && <p role="status">Actualisation des produits et du stock…</p>}
        <ul>
          {options.map((p) => (
            <li key={p.id}>
              {p.image && (
                <Image
                  src={p.image}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                />
              )}
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.price} · {p.stock} disponibles
                </small>
              </span>
              <button
                type="button"
                disabled={!replacement && ids.length >= MAX_COMPTOIR_PRODUCTS}
                onClick={() => choose(p)}
              >
                {replacement ? 'Remplacer par' : 'Ajouter'}
                <span className={styles.srOnly}> {p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {!busy && !options.length && (
          <p>Aucun produit actif disponible pour cette recherche.</p>
        )}
        <button
          type="button"
          onClick={() => {
            setPickerOpen(false);
            setReplacement(null);
          }}
        >
          Annuler la sélection
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className={styles.srOnly} role="status">
        {announcement}
      </p>
    </section>
  );
}
