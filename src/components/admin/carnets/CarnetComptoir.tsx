'use client';
import { useEffect, useState } from 'react';
import { searchCarnetProductsAction } from '@/lib/carnets/actions';
import Image from 'next/image';
import type { CarnetProduct } from '@/lib/carnets/comptoir';
import styles from './CarnetEditor.module.scss';
export function CarnetComptoir({
  ids,
  products,
  onChange,
}: {
  ids: string[];
  products: CarnetProduct[];
  onChange: (ids: string[], products?: CarnetProduct[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(products),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      const data = new FormData();
      data.set('search', search);
      searchCarnetProductsAction(data)
        .then((p) => {
          if (active) {
            setResults(p);
            setError('');
          }
        })
        .catch(() => {
          if (active) setError('Recherche indisponible. Réessayez.');
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);
  const combined = [
    ...products,
    ...results.filter((p) => !products.some((s) => s.id === p.id)),
  ];
  const selected = ids.map((id) => combined.find((p) => p.id === id));
  const options = results.filter(
    (p) =>
      p.eligible &&
      !ids.includes(p.id) &&
      p.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  );
  function move(index: number, delta: number) {
    const next = [...ids];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    onChange(next);
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
        Jusqu’à trois produits. La présentation est préparée par Caldera. Cette
        section est facultative.
      </p>
      <input type="hidden" name="productIds" value={JSON.stringify(ids)} />
      <ol className={styles.products}>
        {selected.map((p, index) => (
          <li key={ids[index]}>
            {p?.image && (
              <Image src={p.image} alt="" width={64} height={64} unoptimized />
            )}
            <div>
              <strong>{p?.name ?? 'Produit supprimé ou inaccessible'}</strong>
              <span>{p?.price}</span>
              <small>
                {p?.eligible
                  ? `${p.stock} disponibles`
                  : 'Indisponible — retirez ce produit avant de programmer'}
              </small>
            </div>
            <div className={styles.productActions}>
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Monter ${p?.name ?? 'ce produit'}`}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === ids.length - 1}
                aria-label={`Descendre ${p?.name ?? 'ce produit'}`}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(ids.filter((_, i) => i !== index))}
              >
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ol>
      <details className={styles.picker}>
        <summary>+ Ajouter un produit · {ids.length}/3</summary>
        <label>
          Rechercher un produit
          <input
            type="search"
            value={search}
            onChange={(e) => {
              e.stopPropagation();
              setSearch(e.target.value);
            }}
          />
        </label>
        {ids.length >= 3 && (
          <p role="status">
            Maximum trois produits atteint. Retirez un produit pour en ajouter
            un autre.
          </p>
        )}
        {busy && <p role="status">Recherche…</p>}
        {error && <p role="alert">{error}</p>}
        <ul>
          {options.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.price} · {p.stock} disponibles
                </small>
              </span>
              <button
                type="button"
                disabled={ids.length >= 3}
                onClick={() => {
                  if (ids.length < 3 && !ids.includes(p.id))
                    onChange([...ids, p.id], combined);
                }}
              >
                Ajouter<span className={styles.srOnly}> {p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {!options.length && (
          <p>Aucun produit disponible dans cette sélection.</p>
        )}
      </details>
    </section>
  );
}
