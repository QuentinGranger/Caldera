'use client';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CircleX, Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { catalogUrl, parseCatalogParams } from '@/lib/catalog/params';
import styles from './HeaderSearch.module.scss';
export function HeaderSearch() {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const commandK = (event.metaKey || event.ctrlKey) && event.key === 'k';

      if (isTyping || (!commandK && event.key !== '/')) return;
      event.preventDefault();
      if (!dialog.current?.open) {
        dialog.current?.showModal();
        requestAnimationFrame(() => input.current?.focus());
      }
    }

    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, []);

  function closeSearch() {
    dialog.current?.close();
    setQuery('');
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const search = query.trim();
    const filters = parseCatalogParams({ search });
    closeSearch();
    startTransition(() => router.push(catalogUrl('/catalogue', filters)));
  }

  return (
    <>
      <IconButton
        ref={trigger}
        className={styles.trigger}
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
        onClose={() => {
          setQuery('');
          trigger.current?.focus();
        }}
      >
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Recherche Caldera</p>
            <h2 id={`${id}-title`}>Quelle terre explorez-vous ?</h2>
          </div>
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Fermer la recherche"
          >
            <X size={20} />
          </button>
        </div>
        <form role="search" onSubmit={submitSearch}>
          <p className={styles.description}>
            Recherchez une carte, un coffret, une extension ou une référence.
          </p>
          <label className={styles.srOnly} htmlFor={`${id}-input`}>
            Rechercher un produit, une extension ou une référence
          </label>
          <div className={styles.field}>
            <Search className={styles.fieldIcon} size={21} aria-hidden="true" />
            <input
              ref={input}
              id={`${id}-input`}
              name="search"
              type="search"
              value={query}
              maxLength={120}
              placeholder="Ex. : Destinées de Paldea, ETB, 123456…"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
                aria-label="Effacer la recherche"
              >
                <CircleX size={18} aria-hidden="true" />
              </button>
            )}
            <button
              type="submit"
              className={styles.submit}
              disabled={!query.trim() || pending}
            >
              <span>{pending ? 'Recherche…' : 'Rechercher'}</span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </div>
          <p className={styles.hint}>
            <span>Entrée pour lancer</span>
            <kbd>⌘ K</kbd>
            <span>pour ouvrir à tout moment</span>
          </p>
        </form>
        <nav className={styles.quickLinks} aria-label="Accès rapides">
          <span>Explorer rapidement</span>
          <Link href="/nouveautes" onClick={closeSearch}>
            Nouveautés <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/categorie/scelles" onClick={closeSearch}>
            Scellés <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/categorie/cartes" onClick={closeSearch}>
            Cartes <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </dialog>
    </>
  );
}
