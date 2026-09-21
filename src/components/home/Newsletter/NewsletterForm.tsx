'use client';
import { useActionState, useEffect, useRef } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import {
  subscribeNewsletterAction,
  type NewsletterActionState,
} from '@/lib/newsletter/actions';
import styles from './Newsletter.module.scss';

const initialState: NewsletterActionState = { success: false, message: '' };

export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(
    subscribeNewsletterAction,
    initialState,
  );
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={form}
      className={styles.form}
      action={formAction}
      aria-describedby="newsletter-note newsletter-feedback"
      suppressHydrationWarning
    >
      <label className={styles.emailLabel} htmlFor="newsletter-email">
        Votre adresse e-mail
      </label>
      <div className={styles.fields} suppressHydrationWarning>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
          maxLength={254}
          disabled={pending}
          suppressHydrationWarning
        />
        <Button
          variant="gold"
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          suppressHydrationWarning
        >
          {pending ? 'Inscription…' : 'Rejoindre l’expédition'}{' '}
          {pending ? (
            <LoaderCircle className={styles.spinner} aria-hidden="true" />
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
        </Button>
      </div>
      <label className={styles.consent}>
        <input name="consent" type="checkbox" required disabled={pending} />
        <span>
          J’accepte de recevoir les nouvelles, sélections et réassorts de
          Caldera. Désinscription possible à tout moment.
        </span>
      </label>
      <label className={styles.trap} aria-hidden="true">
        Site internet
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <p id="newsletter-note" className={styles.note}>
        Vos données servent uniquement à vous envoyer les nouvelles de Caldera.
      </p>
      <p
        id="newsletter-feedback"
        role="status"
        className={`${styles.feedback} ${state.message && !state.success ? styles.error : ''}`}
      >
        {state.message}
      </p>
    </form>
  );
}
