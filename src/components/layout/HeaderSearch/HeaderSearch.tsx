'use client';
import { useId, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { catalogUrl, parseCatalogParams } from '@/lib/catalog/params';
import styles from './HeaderSearch.module.scss';
export function HeaderSearch() {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const router = useRouter();
  return (
    <>
      <IconButton
        ref={trigger}
        label="Rechercher dans la boutique"
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal();
          input.current?.focus();
        }}
      >
        <Search aria-hidden="true" />
      </IconButton>
      <dialog
        id={id}
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => trigger.current?.focus()}
      >
        <div className={styles.heading}>
          <h2 id={`${id}-title`}>Votre prochaine découverte</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Fermer la recherche"
          >
            <X size={20} />
          </button>
        </div>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const filters = parseCatalogParams({
              search: String(data.get('search') ?? ''),
            });
            dialog.current?.close();
            router.push(catalogUrl('/catalogue', filters));
          }}
        >
          <label htmlFor={`${id}-input`}>
            Rechercher un produit ou une extension
          </label>
          <div className={styles.field}>
            <input
              ref={input}
              id={`${id}-input`}
              name="search"
              type="search"
              maxLength={120}
              placeholder="ETB, booster, extension…"
            />
            <button type="submit" aria-label="Rechercher">
              <Search size={20} />
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
