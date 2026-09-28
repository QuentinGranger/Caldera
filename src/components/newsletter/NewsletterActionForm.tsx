'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import {
  initialNewsletterState,
  type NewsletterActionState,
} from '@/lib/newsletter/validation';
import styles from './NewsletterPage.module.scss';

type Action = (
  previous: NewsletterActionState,
  form: FormData,
) => Promise<NewsletterActionState>;

export function NewsletterActionForm({
  action,
  token,
  submit,
}: {
  action: Action;
  token: string;
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialNewsletterState,
  );
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message) feedback.current?.focus();
  }, [state]);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <div
          ref={feedback}
          tabIndex={-1}
          role={state.success ? 'status' : 'alert'}
          className={state.success ? styles.success : styles.error}
        >
          {state.message}
        </div>
      )}
      {!state.success && (
        <button type="submit" disabled={pending}>
          {pending ? 'Un instant…' : submit}
        </button>
      )}
    </form>
  );
}
