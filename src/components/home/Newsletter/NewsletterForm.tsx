'use client';
import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { subscribeNewsletterAction } from '@/lib/newsletter/actions';
import { initialNewsletterState } from '@/lib/newsletter/validation';
import styles from './Newsletter.module.scss';
import { newsletterChannelFromUrl } from '@/lib/newsletter/acquisition';
import { analyticsAllowed, trackNewsletterLead } from '@/lib/analytics/client';
import { newsletterCopy } from '@/lib/newsletter/copy';
export function NewsletterForm({ preparing }: { preparing: boolean }) {
  const copy = newsletterCopy(preparing);
  const [state, formAction, pending] = useActionState(
    subscribeNewsletterAction,
    initialNewsletterState,
  );
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const measuredState = useRef<typeof state>(null);
  useEffect(() => {
    if (state.success && measuredState.current !== state) {
      measuredState.current = state;
      trackNewsletterLead();
    }
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
        if (analyticsAllowed()) {
          data.set(
            'acquisitionChannel',
            newsletterChannelFromUrl(
              new URLSearchParams(location.search),
              document.referrer,
              location.origin,
            ),
          );
        }
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
          <span>{copy.consent}</span>
        </label>
        {errors.consent && (
          <p id="newsletter-consent-error" className={styles.fieldError}>
            {errors.consent}
          </p>
        )}
        <Button variant="gold" type="submit" className={styles.submit}>
          {pending ? 'Un instant…' : copy.button}{' '}
          <ArrowRight aria-hidden="true" />
        </Button>
        <details className={styles.preferences}>
          <summary>
            Préférences facultatives{' '}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className={styles.optionalBody}>
            <p className={styles.note}>
              Ces choix ne sont pas nécessaires pour recevoir la lettre.
            </p>
            <label className={styles.consent}>
              <input name="personalized" type="checkbox" />
              <span>
                Je souhaite aussi recevoir des rappels de panier, des nouvelles
                de mes favoris et des recommandations liées à mes achats.
                Facultatif ; désactivable à tout moment dans mon compte.
              </span>
            </label>
            <label className={styles.consent}>
              <input name="emailTracking" type="checkbox" />
              <span>
                J’autorise la mesure des ouvertures et clics dans les e-mails
                commerciaux pour aider Caldera à améliorer ses contenus.
                Facultatif ; les e-mails restent disponibles sans ce suivi.
                Retrait dans mon compte ou par désinscription.
              </span>
            </label>
          </div>
        </details>
        <label className={styles.honeypot} aria-hidden="true">
          Votre site internet
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </fieldset>
      <p id="newsletter-note" className={styles.note}>
        Confirmez votre inscription via l’e-mail reçu. Désinscription à tout
        moment. <Link href="/confidentialite">Confidentialité</Link>
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
