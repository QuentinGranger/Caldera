'use client';
import {
  createContext,
  useContext,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AdminAction } from '@/lib/admin/action-types';
import styles from './Admin.module.scss';

const LEAVE_WARNING =
  'Des modifications ne sont pas enregistrées. Quitter cette page sans les enregistrer ?';
/** The forms of the page holding changes not saved yet. */
const unsaved = new Set<symbol>();
const FormChangeContext = createContext<(() => void) | null>(null);

/** Editors with buttons that change form data must mark those changes too. */
export function useAdminFormChange() {
  return useContext(FormChangeContext);
}

export function confirmAdminNavigation() {
  if (!unsaved.size) return true;
  if (!window.confirm(LEAVE_WARNING)) return false;
  unsaved.clear();
  return true;
}
let guards = 0;
function warnOnUnload(event: BeforeUnloadEvent) {
  if (unsaved.size) event.preventDefault();
}
/** Links inside the admin navigate without unloading: asked here. */
function warnOnLink(event: MouseEvent) {
  if (!unsaved.size || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;
  if (link.target === '_blank' || link.hasAttribute('download')) return;
  const url = new URL(link.href);
  // Another site unloads the page (warnOnUnload); an anchor stays on it.
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search)
    return;
  if (!confirmAdminNavigation()) {
    event.preventDefault();
    event.stopPropagation();
  }
}

export function AdminForm({
  action,
  children,
  submit = 'Enregistrer',
  pendingLabel = submit.startsWith('Enregistrer')
    ? 'Enregistrement…'
    : 'En cours…',
  guard = true,
  confirm,
  confirmWhen = 'always',
  tone,
  fieldsKey,
  requireSaved = false,
  submitDisabled = false,
}: {
  action: AdminAction;
  /** Test/queue actions must not use an older draft while another form is edited. */
  requireSaved?: boolean;
  submitDisabled?: boolean;
  /** Refresh saved field values without discarding the action feedback. */
  fieldsKey?: string;
  children: ReactNode;
  submit?: string;
  /** The button's words while the action runs. */
  pendingLabel?: string;
  /** Warns before leaving the page with changes not saved (not for sign-in). */
  guard?: boolean;
  confirm?: string;
  confirmWhen?: 'always' | 'inactive' | 'stockZero';
  /** `danger`: an irreversible way out (refund, cancellation). */
  tone?: 'danger';
}) {
  const [saveWarning, setSaveWarning] = useState('');
  const [state, formAction, pending] = useActionState(action, {
    success: false,
    message: '',
  });
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const approved = useRef(false);
  const headingId = useId();
  const [key] = useState(() => Symbol('form'));
  // The action state current when the form was last edited: changes stay
  // unsaved until an action succeeds after them.
  const [editedAt, setEditedAt] = useState<typeof state | null>(null);
  const dirty = editedAt !== null && (editedAt === state || !state.success);
  useEffect(() => {
    if (!guard) return;
    if (guards++ === 0) {
      window.addEventListener('beforeunload', warnOnUnload);
      document.addEventListener('click', warnOnLink, true);
    }
    return () => {
      unsaved.delete(key);
      if (--guards === 0) {
        window.removeEventListener('beforeunload', warnOnUnload);
        document.removeEventListener('click', warnOnLink, true);
      }
    };
  }, [guard, key]);
  useEffect(() => {
    if (!guard) return;
    if (dirty) unsaved.add(key);
    else unsaved.delete(key);
  }, [guard, dirty, key]);
  useEffect(() => {
    if (state.success && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
  useEffect(() => {
    if (state.message && !state.success) feedback.current?.focus();
  }, [state]);
  return (
    <FormChangeContext.Provider value={guard ? () => setEditedAt(state) : null}>
      <form
        ref={form}
        aria-busy={pending}
        action={formAction}
        onChange={guard ? () => setEditedAt(state) : undefined}
        onSubmit={(event) => {
          if (requireSaved && [...unsaved].some((item) => item !== key)) {
            event.preventDefault();
            setSaveWarning(
              'Enregistrez les modifications du brouillon avant de tester ou de programmer son envoi.',
            );
            return;
          }
          setSaveWarning('');
          const data = new FormData(event.currentTarget);
          const needsConfirmation =
            confirm &&
            (confirmWhen === 'always' ||
              (confirmWhen === 'inactive' && !data.has('isActive')) ||
              (confirmWhen === 'stockZero' && data.get('quantity') === '0'));
          if (needsConfirmation && !approved.current) {
            event.preventDefault();
            dialog.current?.showModal();
          } else approved.current = false;
        }}
      >
        {saveWarning && (
          <p role="alert" className={`${styles.message} ${styles.error}`}>
            {saveWarning}
          </p>
        )}
        {state.message && (
          <p
            ref={feedback}
            tabIndex={-1}
            role={state.success ? 'status' : 'alert'}
            className={`${styles.message} ${state.success ? '' : styles.error}`}
          >
            {state.success ? (
              <CheckCircle2 size={17} aria-hidden="true" />
            ) : (
              <CircleAlert size={17} aria-hidden="true" />
            )}
            {state.message}
          </p>
        )}
        <fieldset key={fieldsKey} disabled={pending}>
          {children}
          <div className={styles.formActions}>
            {dirty && !pending && (
              <span className={styles.unsaved}>
                Modifications non enregistrées
              </span>
            )}
            <button
              type="submit"
              disabled={submitDisabled}
              className={tone === 'danger' ? styles.dangerButton : undefined}
            >
              {pending ? pendingLabel : submit}
            </button>
          </div>
        </fieldset>
      </form>
      {confirm && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-labelledby={headingId}
        >
          <h2 id={headingId}>Confirmer cette action</h2>
          <p>{confirm}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => dialog.current?.close()}
              autoFocus
            >
              Revenir
            </button>
            <button
              type="button"
              onClick={() => {
                approved.current = true;
                dialog.current?.close();
                form.current?.requestSubmit();
              }}
            >
              Confirmer
            </button>
          </div>
        </dialog>
      )}
    </FormChangeContext.Provider>
  );
}
