'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import styles from './Newsletter.module.scss';
export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }
  return (
    <form
      className={styles.form}
      onSubmit={submit}
      aria-describedby="newsletter-note"
    >
      <label htmlFor="newsletter-email">Votre adresse e-mail</label>
      <div className={styles.fields}>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
          maxLength={254}
          onChange={() => setSubmitted(false)}
        />
        <Button variant="gold" type="submit">
          Rejoindre l’expédition <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <p id="newsletter-note" className={styles.note}>
        Bientôt disponible. Aucune adresse n’est enregistrée dans cette version.
      </p>
      <p role="status" className={styles.feedback}>
        {submitted
          ? 'Merci pour votre intérêt ! Les inscriptions ouvriront prochainement. Votre adresse n’a pas été enregistrée.'
          : ''}
      </p>
    </form>
  );
}
