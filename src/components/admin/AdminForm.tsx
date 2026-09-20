'use client';
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AdminAction } from '@/lib/admin/action-types';
import styles from './Admin.module.scss';
export function AdminForm({
  action,
  children,
  submit = 'Enregistrer',
  confirm,
  confirmWhen = 'always',
}: {
  action: AdminAction;
  children: ReactNode;
  submit?: string;
  confirm?: string;
  confirmWhen?: 'always' | 'inactive' | 'stockZero';
}) {
  const [state, formAction, pending] = useActionState(action, {
    success: false,
    message: '',
  });
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const approved = useRef(false);
  const headingId = useId();
  useEffect(() => {
    if (state.success && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
  return (
    <>
      <form
        ref={form}
        aria-busy={pending}
        action={formAction}
        onSubmit={(event) => {
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
        <fieldset disabled={pending}>
          {children}
          <div className={styles.actions}>
            <button type="submit">
              {pending ? 'Enregistrement…' : submit}
            </button>
          </div>
        </fieldset>
        {state.message && (
          <p
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
    </>
  );
}
