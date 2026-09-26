'use client';
import { useEffect, useId, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import {
  activeFilterCount,
  catalogUrl,
  languageLabels,
  typeLabels,
  stockLabels,
  type CatalogFilters as Filters,
  type CatalogScope,
  type MultiFilter,
  type StockFilter,
} from '@/lib/catalog/params';
import type { CatalogFacets } from '@/lib/catalog/facets';
import styles from './Catalog.module.scss';

/** Stock options that can still narrow the scope. */
function availabilityOptions(scope: CatalogScope): StockFilter[] {
  if (scope.preorder || scope.status === 'precommandes') return [];
  if (scope.status === 'en-stock') return ['low-stock'];
  return Object.keys(stockLabels) as StockFilter[];
}
type Props = {
  filters: Filters;
  facets: CatalogFacets;
  scope: CatalogScope;
  path: string;
};
function FilterForm({
  filters,
  facets,
  scope,
  onChange,
  pending,
}: {
  filters: Filters;
  facets: CatalogFacets;
  scope: CatalogScope;
  onChange: (patch: Partial<Filters>) => void;
  pending: boolean;
}) {
  const id = useId();
  const stock = availabilityOptions(scope);
  const sections: {
    key: MultiFilter;
    label: string;
    options: { value: string; label: string; count?: number }[];
  }[] = [
    {
      key: 'category',
      label: 'Catégorie',
      options: facets.categories.map((c) => ({
        value: c.slug,
        label: c.name,
        count: c.count,
      })),
    },
    {
      key: 'type',
      label: 'Type de produit',
      options: facets.types.map((value) => ({
        value,
        label: typeLabels[value],
        count: facets.counts.types[value],
      })),
    },
    ...(!scope.set
      ? [
          {
            key: 'set' as const,
            label: 'Extension',
            options: facets.sets.map((s) => ({
              value: s.slug,
              label: s.name,
              count: s.count,
            })),
          },
        ]
      : []),
    // A language scope already restricts every price and stock to its variants.
    ...(!scope.language
      ? [
          {
            key: 'language' as const,
            label: 'Langue',
            options: facets.languages.map((value) => ({
              value,
              label: languageLabels[value],
              count: facets.counts.languages[value],
            })),
          },
        ]
      : []),
    ...(stock.length
      ? [
          {
            key: 'availability' as const,
            label: 'Disponibilité',
            options: stock.map((value) => ({
              value,
              label: stockLabels[value],
            })),
          },
        ]
      : []),
  ];
  return (
    <div aria-busy={pending}>
      {sections
        .filter((section) => section.options.length)
        .map((section) => (
          <details key={section.key} open className={styles.filterSection}>
            <summary>
              {section.label}
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <fieldset aria-disabled={pending}>
              <legend className={styles.srOnly}>{section.label}</legend>
              {section.options.map((option) => (
                <label key={option.value} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={(filters[section.key] as string[]).includes(
                      option.value,
                    )}
                    onChange={(event) =>
                      !pending &&
                      onChange({
                        [section.key]: event.target.checked
                          ? [...filters[section.key], option.value]
                          : filters[section.key].filter(
                              (v) => v !== option.value,
                            ),
                      })
                    }
                  />
                  <span>
                    {option.label}
                    {option.count !== undefined && (
                      <span className={styles.optionCount}>
                        {' '}
                        ({option.count})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          </details>
        ))}
      <form
        className={styles.filterSection}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          onChange({
            minPrice: String(data.get('minPrice') ?? '') || undefined,
            maxPrice: String(data.get('maxPrice') ?? '') || undefined,
          });
        }}
      >
        <fieldset aria-disabled={pending}>
          <legend>Prix en euros</legend>
          <div className={styles.prices}>
            <label htmlFor={`${id}-min`}>
              Minimum
              <input
                key={`min-${filters.minPrice}`}
                id={`${id}-min`}
                name="minPrice"
                type="number"
                inputMode="decimal"
                min="0"
                max="99999999.99"
                step="0.01"
                placeholder="0"
                defaultValue={filters.minPrice ?? ''}
              />
            </label>
            <label htmlFor={`${id}-max`}>
              Maximum
              <input
                key={`max-${filters.maxPrice}`}
                id={`${id}-max`}
                name="maxPrice"
                type="number"
                inputMode="decimal"
                min="0"
                max="99999999.99"
                step="0.01"
                placeholder="Sans limite"
                defaultValue={filters.maxPrice ?? ''}
              />
            </label>
          </div>
          <button type="submit" className={styles.textButton}>
            Appliquer le prix
          </button>
        </fieldset>
      </form>
    </div>
  );
}
export function CatalogFilters({ filters, facets, scope, path }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const count = activeFilterCount(filters);
  const change = (patch: Partial<Filters>) =>
    startTransition(() =>
      router.push(catalogUrl(path, filters, patch), { scroll: false }),
    );
  useEffect(() => {
    const media = window.matchMedia('(min-width: 75rem)');
    const close = () => {
      if (media.matches) dialog.current?.close();
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);
  const form = (
    <FilterForm
      filters={filters}
      facets={facets}
      scope={scope}
      onChange={change}
      pending={pending}
    />
  );
  return (
    <>
      <aside className={styles.sidebar} aria-label="Filtres du catalogue">
        <h2>Affiner l’exploration</h2>
        {form}
      </aside>
      <button
        ref={trigger}
        className={styles.mobileTrigger}
        type="button"
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => dialog.current?.showModal()}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filtres{count ? ` (${count})` : ''}
      </button>
      <dialog
        id={id}
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          if (trigger.current?.getClientRects().length) trigger.current.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              event.currentTarget.close();
          }
        }}
      >
        <div className={styles.dialogHeading}>
          <h2 id={`${id}-title`}>Affiner l’exploration</h2>
          <button
            type="button"
            aria-label="Fermer les filtres"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        {form}
        <div className={styles.dialogFooter}>
          <Button disabled={pending} onClick={() => dialog.current?.close()}>
            Voir les résultats
          </Button>
        </div>
      </dialog>
    </>
  );
}
