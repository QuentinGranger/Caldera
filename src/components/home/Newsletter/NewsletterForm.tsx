'use client';
import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { subscribeNewsletterAction } from '@/lib/newsletter/actions';
import { initialNewsletterState } from '@/lib/newsletter/validation';
import styles from './Newsletter.module.scss';
export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(
    subscribeNewsletterAction,
    initialNewsletterState,
  );
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.success) form.current?.reset();
    if (state.message) feedback.current?.focus();
  }, [state]);
  const errors = state.errors ?? {};
  return (
    <form
      ref={form}
      className={styles.form}
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      aria-describedby="newsletter-note newsletter-feedback"
      noValidate
    >
      <fieldset disabled={pending}>
        <label htmlFor="newsletter-email">Votre adresse e-mail</label>
        <div className={styles.fields}>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.fr"
            required
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={
              errors.email ? 'newsletter-email-error' : undefined
            }
          />
          <Button variant="gold" type="submit">
            {pending ? 'Un instant…' : 'Rejoindre l’expédition'}{' '}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        {errors.email && (
          <p id="newsletter-email-error" className={styles.fieldError}>
            {errors.email}
          </p>
        )}
        <label className={styles.consent}>
          <input
            name="consent"
            type="checkbox"
            required
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={
              errors.consent ? 'newsletter-consent-error' : undefined
            }
          />
          <span>
            J’accepte de recevoir par e-mail les nouvelles et offres des Terres
            de Caldera. Je peux me désinscrire à tout moment.{' '}
            <Link href="/confidentialite">Politique de confidentialité</Link>
          </span>
        </label>
        {errors.consent && (
          <p id="newsletter-consent-error" className={styles.fieldError}>
            {errors.consent}
          </p>
        )}
        <label className={styles.honeypot} aria-hidden="true">
          Votre site internet
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </fieldset>
      <p id="newsletter-note" className={styles.note}>
        Un e-mail de confirmation vous sera envoyé. L’inscription ne devient
        active qu’après votre clic.
      </p>
      <p
        ref={feedback}
        id="newsletter-feedback"
        tabIndex={-1}
        role={state.success ? 'status' : 'alert'}
        className={`${styles.feedback} ${state.message && !state.success ? styles.feedbackError : ''}`}
      >
        {state.message}
      </p>
    </form>
  );
}
