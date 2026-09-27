'use client';
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
 * the action runs. Typed values stay after an error (React would clear a form
 * given to `action`). `done` replaces the form once the action succeeds,
 * `resetOnSuccess` empties it (passwords), `id` prefixes field ids when a page
 * holds several forms.
 */
export function AccountForm({
  action,
  submit,
  children,
  danger = false,
  done = false,
  resetOnSuccess = false,
  wide = false,
  id,
}: {
  action: Action;
  submit: string;
  children: ReactNode;
  danger?: boolean;
  done?: boolean;
  resetOnSuccess?: boolean;
  /** Full-width submit button (sign-in and sign-up cards). */
  wide?: boolean;
  id?: string;
}) {
  const prefix = id ? `${id}-` : '';
  const [state, formAction, pending] = useActionState(
    action,
    initialAccountState,
  );
  const form = useRef<HTMLFormElement>(null);
  const message = useRef<HTMLDivElement>(null);
  const errors = state.errors ?? {};
  useEffect(() => {
    if (state.success && resetOnSuccess) form.current?.reset();
    if (state.message) message.current?.focus();
  }, [state, resetOnSuccess]);
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
    <form
      ref={form}
      // Without JavaScript the browser posts to the action; with it, the
      // action runs from here so React does not clear the fields.
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      noValidate
      className={styles.form}
    >
      {feedback}
      <FormContext value={{ errors, prefix }}>
        <fieldset disabled={pending} className={styles.fieldset}>
          {children}
          <button
            type="submit"
            className={`${danger ? styles.dangerButton : styles.submit} ${
              wide ? styles.wide : ''
            }`}
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
  const [visible, setVisible] = useState(false);
  const error = errors[name];
  const id = `${prefix}${name}`;
  const described = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  const password = type === 'password';
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      <div className={password ? styles.passwordInput : undefined}>
        <input
          id={id}
          name={name}
          type={password && visible ? 'text' : type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          minLength={minLength}
          maxLength={maxLength}
          required
          autoCapitalize={type === 'text' ? undefined : 'none'}
          spellCheck={type === 'text' ? undefined : false}
          aria-invalid={Boolean(error)}
          aria-describedby={described || undefined}
        />
        {password && (
          <button
            type="button"
            className={styles.reveal}
            aria-controls={id}
            aria-pressed={visible}
            aria-label={
              visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
            }
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
