'use client';
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  initialAccountState,
  type AccountActionState,
} from '@/lib/account/validation';
import styles from './Account.module.scss';

type Action = (
  previous: AccountActionState,
  form: FormData,
) => Promise<AccountActionState>;

const FormContext = createContext<{
  errors: Record<string, string>;
  prefix: string;
}>({ errors: {}, prefix: '' });

/**
 * Server-action form of the account pages: one message zone announced to
 * screen readers, field errors linked to their inputs, fields locked while
 * the action runs. `done` replaces the form once the action succeeds; `id`
 * prefixes field ids when a page holds several forms.
 */
export function AccountForm({
  action,
  submit,
  children,
  danger = false,
  done = false,
  id,
}: {
  action: Action;
  submit: string;
  children: ReactNode;
  danger?: boolean;
  done?: boolean;
  id?: string;
}) {
  const prefix = id ? `${id}-` : '';
  const [state, formAction, pending] = useActionState(
    action,
    initialAccountState,
  );
  const message = useRef<HTMLDivElement>(null);
  const errors = state.errors ?? {};
  useEffect(() => {
    if (state.message) message.current?.focus();
  }, [state]);
  const feedback = state.message && (
    <div
      ref={message}
      tabIndex={-1}
      role={state.success ? 'status' : 'alert'}
      className={state.success ? styles.success : styles.error}
    >
      <p>{state.message}</p>
      {Object.keys(errors).length > 0 && (
        <ul>
          {Object.entries(errors).map(([field, text]) => (
            <li key={field}>
              <a href={`#${prefix}${field}`}>{text}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  if (done && state.success) return feedback;
  return (
    <form action={formAction} noValidate className={styles.form}>
      {feedback}
      <FormContext value={{ errors, prefix }}>
        <fieldset disabled={pending} className={styles.fieldset}>
          {children}
          <button
            type="submit"
            className={danger ? styles.dangerButton : styles.submit}
          >
            {pending ? 'Un instant…' : submit}
          </button>
        </fieldset>
      </FormContext>
    </form>
  );
}

export function AccountField({
  label,
  name,
  type = 'text',
  autoComplete,
  hint,
  defaultValue,
  minLength,
  maxLength,
}: {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  autoComplete: string;
  hint?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength: number;
}) {
  const { errors, prefix } = useContext(FormContext);
  const error = errors[name];
  const id = `${prefix}${name}`;
  const described = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        minLength={minLength}
        maxLength={maxLength}
        required
        spellCheck={type === 'text' ? undefined : false}
        aria-invalid={Boolean(error)}
        aria-describedby={described || undefined}
      />
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
