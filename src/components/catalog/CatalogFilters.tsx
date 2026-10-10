'use client';
import { useId, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import {
  activeFilterCount,
  catalogUrl,
  type CatalogFilters as Filters,
  type CatalogScope,
} from '@/lib/catalog/params';
import type { CatalogFacets } from '@/lib/catalog/facets';
import styles from './Catalog.module.scss';
import {
  catalogFilterSections,
  hasPriceFilter,
} from '@/lib/catalog/filterOptions';

type Props = {
  filters: Filters;
  facets: CatalogFacets;
  scope: CatalogScope;
  path: string;
  /** Products matching the current filters. */
  total: number;
};
/** Everything but the search, which has its own field. */
const NO_FILTERS = {
  category: [],
  type: [],
  set: [],
  language: [],
  availability: [],
  minPrice: undefined,
  maxPrice: undefined,
} satisfies Partial<Filters>;

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
  const shown = catalogFilterSections(facets, filters, scope);
  const price = hasPriceFilter(facets, filters);
  return (
    <div className={styles.filterBody} aria-busy={pending}>
      {shown.map((section, index) => (
        // The first two sections, and any in use, open from the start.
        <details
          key={section.key}
          open={index < 2 || filters[section.key].length > 0}
          className={styles.filterSection}
        >
          <summary>
            {section.label}
            {filters[section.key].length > 0 && (
              <span className={styles.selected}>
                {filters[section.key].length}
                <span className={styles.srOnly}> sélectionné(s)</span>
              </span>
            )}
            <ChevronDown size={16} aria-hidden="true" />
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
      {price && (
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
      )}
    </div>
  );
}

/**
 * The filters in a drawer: from the side on wide screens, from the bottom on
 * phones. Each choice updates the listing behind at once; the footer tells
 * how many products remain.
 */
export function CatalogFilters({ filters, facets, scope, path, total }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  // The search has its own field: it is not counted as a filter here.
  const count = activeFilterCount(filters) - Number(Boolean(filters.search));
  const change = (patch: Partial<Filters>) =>
    startTransition(() =>
      router.push(catalogUrl(path, filters, patch), { scroll: false }),
    );
  if (
    !count &&
    !catalogFilterSections(facets, filters, scope).length &&
    !hasPriceFilter(facets, filters)
  )
    return null;
  return (
    <>
      <button
        ref={trigger}
        className={styles.filtersTrigger}
        type="button"
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => dialog.current?.showModal()}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span className={styles.triggerLabel}>Filtres</span>
        {count > 0 && (
          <span className={styles.selected}>
            {count}
            <span className={styles.srOnly}> actif(s)</span>
          </span>
        )}
      </button>
      <dialog
        id={id}
        ref={dialog}
        className={styles.drawer}
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
        <div className={styles.drawerHeading}>
          <h2 id={`${id}-title`}>Affiner l’exploration</h2>
          <button
            type="button"
            aria-label="Fermer les filtres"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <FilterForm
          filters={filters}
          facets={facets}
          scope={scope}
          onChange={change}
          pending={pending}
        />
        <div className={styles.drawerFooter}>
          <button
            type="button"
            className={styles.textButton}
            disabled={pending || count === 0}
            onClick={() => change(NO_FILTERS)}
          >
            Effacer les filtres
          </button>
          <Button disabled={pending} onClick={() => dialog.current?.close()}>
            {pending
              ? 'Mise à jour…'
              : `Voir ${total} ${total > 1 ? 'produits' : 'produit'}`}
          </Button>
        </div>
      </dialog>
    </>
  );
}
