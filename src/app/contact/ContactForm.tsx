'use client';

import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';

import styles from './contact.module.scss';

type FormState =
  | { status: 'idle'; message: '' }
  | { status: 'sending'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const initialState: FormState = { status: 'idle', message: '' };

export function ContactForm() {
  const [state, setState] = useState<FormState>(initialState);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setState({
      status: 'sending',
      message: 'Envoi de votre message…',
    });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          topic: data.get('topic'),
          orderNumber: data.get('orderNumber'),
          message: data.get('message'),
          website: data.get('website'),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setState({
          status: 'error',
          message:
            payload?.message ||
            'Votre message n’a pas pu être envoyé. Réessayez plus tard.',
        });
        return;
      }

      form.reset();
      setState({
        status: 'success',
        message: payload?.message || 'Votre message a bien été envoyé.',
      });
    } catch {
      setState({
        status: 'error',
        message:
          'Impossible de joindre le service de contact pour le moment. Réessayez plus tard.',
      });
    }
  }

  const sending = state.status === 'sending';
  const feedbackClassName = [
    styles.feedback,
    state.status === 'error' ? styles.feedbackError : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.formPanel}>
      <p className={styles.eyebrow}>Écrire à Caldera</p>
      <h2>Formulaire de contact</h2>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.twoColumns}>
          <label>
            <span>Nom</span>
            <input
              type="text"
              name="name"
              minLength={2}
              maxLength={80}
              autoComplete="name"
              required
            />
          </label>

          <label>
            <span>Adresse e-mail</span>
            <input
              type="email"
              name="email"
              maxLength={254}
              autoComplete="email"
              required
            />
          </label>
        </div>

        <label>
          <span>Votre demande concerne</span>
          <select name="topic" defaultValue="commande" required>
            <option value="commande">Une commande</option>
            <option value="produit">Un produit ou le stock</option>
            <option value="precommande">Une précommande</option>
            <option value="livraison">La livraison</option>
            <option value="autre">Autre demande</option>
          </select>
        </label>

        <label>
          <span>
            Numéro de commande <small>facultatif</small>
          </span>
          <input
            type="text"
            name="orderNumber"
            maxLength={50}
            autoComplete="off"
            placeholder="Ex. CAL-…"
          />
        </label>

        <label>
          <span>Message</span>
          <textarea
            name="message"
            minLength={10}
            maxLength={5000}
            rows={8}
            required
          />
        </label>

        <div className={styles.honeypot} aria-hidden="true">
          <label>
            Site web
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button type="submit" disabled={sending}>
            {sending ? 'Envoi…' : 'Envoyer le message'}
            {!sending && <ArrowUpRight size={16} aria-hidden="true" />}
          </button>
          <p>
            Les informations saisies sont utilisées uniquement pour traiter
            votre demande.
          </p>
        </div>

        {state.message && (
          <p
            className={feedbackClassName}
            role={state.status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
