'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { adminNavGroups } from './AdminNavigation';
import styles from './Admin.module.scss';

const entries = adminNavGroups.flatMap((group) =>
  group.links.map((link) => ({ ...link, group: group.label })),
);
const shortcuts = new Set([
  '/admin',
  '/admin/commandes',
  '/admin/produits',
  '/admin/stocks',
  '/admin/jeux',
  '/admin/categories',
  '/admin/fournisseurs',
  '/admin/securite',
]);
const aliases: Record<string, string> = {
  '/admin/jeux': 'pokemon faq questions jeux',
  '/admin/categories': 'familles faq questions',
  '/admin/produits': 'catalogue articles fiches',
  '/admin/commandes': 'ventes colis expédition',
  '/admin/livraison': 'frais de port tarifs transporteur pays gratuité',
  '/admin/clients': 'comptes acheteurs inscrits',
  '/admin/messages': 'contact formulaire questions réclamations',
  '/admin/securite': 'compte mot de passe double authentification',
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');

export function AdminQuickAccess() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const term = normalize(query.trim());
  const results = term
    ? entries.filter(({ href, label, group }) =>
        normalize(`${label} ${group} ${aliases[href] ?? ''}`).includes(term),
      )
    : entries.filter(({ href }) => shortcuts.has(href));

  function show() {
    if (dialog.current?.open) return;
    setQuery('');
    setSelected(0);
    dialog.current?.showModal();
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else show();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (dialog.current?.open) dialog.current.close();
  }, [pathname]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`${styles.secondaryButton} ${styles.quickAccessTrigger}`}
        aria-label="Rechercher une page de l’administration"
        aria-keyshortcuts="Meta+K Control+K"
        aria-expanded={open}
        onClick={show}
      >
        <Search size={17} aria-hidden="true" />
        <span>Rechercher une page</span>
        <kbd>⌘ K</kbd>
      </button>
      <dialog
        ref={dialog}
        className={`${styles.dialog} ${styles.quickAccessDialog}`}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        <div className={styles.quickAccessHeader}>
          <div>
            <span className={styles.eyebrow}>Navigation</span>
            <h2 id={`${id}-title`}>Où souhaitez-vous aller ?</h2>
          </div>
          <button
            type="button"
            className={styles.quietButton}
            aria-label="Fermer la recherche"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <label className={styles.quickAccessField}>
          Rechercher une section
          <span>
            <Search size={18} aria-hidden="true" />
            <input
              ref={input}
              type="search"
              value={query}
              autoComplete="off"
              placeholder="Produits, FAQ, commandes…"
              aria-controls={`${id}-results`}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && results.length) {
                  event.preventDefault();
                  setSelected((value) => (value + 1) % results.length);
                } else if (event.key === 'ArrowUp' && results.length) {
                  event.preventDefault();
                  setSelected(
                    (value) => (value - 1 + results.length) % results.length,
                  );
                } else if (event.key === 'Enter' && results[selected]) {
                  event.preventDefault();
                  dialog.current?.close();
                  router.push(results[selected].href);
                }
              }}
            />
          </span>
        </label>
        <div id={`${id}-results`} className={styles.quickAccessResults}>
          <p>
            {term
              ? `${results.length} résultat${results.length > 1 ? 's' : ''}`
              : 'Accès fréquents'}
          </p>
          {results.length ? (
            results.map(({ href, label, group, icon: Icon }, index) => (
              <Link
                key={href}
                href={href}
                className={index === selected ? styles.quickAccessSelected : ''}
                onMouseEnter={() => setSelected(index)}
                onClick={() => dialog.current?.close()}
              >
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{group}</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))
          ) : (
            <div className={styles.quickAccessEmpty}>
              Aucune section trouvée. Essayez « catalogue », « FAQ » ou «
              commandes ».
            </div>
          )}
        </div>
        <small className={styles.quickAccessHelp}>
          Flèches pour choisir · Entrée pour ouvrir · Échap pour fermer
        </small>
      </dialog>
    </>
  );
}
