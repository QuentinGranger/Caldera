'use client';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';

// Replaces the root layout when it fails: no global styles, fonts or header here.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const primary = {
    minHeight: '44px',
    padding: '0 1.25rem',
    border: '1px solid #173e32',
    borderRadius: '999px',
    background: '#173e32',
    color: '#fffcf5',
    font: '600 0.9rem system-ui, sans-serif',
    cursor: 'pointer',
  } as const;
  const secondary = {
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 1.25rem',
    border: '1px solid #173e32',
    borderRadius: '999px',
    color: '#173e32',
    font: '600 0.9rem system-ui, sans-serif',
    textDecoration: 'none',
  } as const;

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem 1rem',
          boxSizing: 'border-box',
          background: '#fffcf5',
          color: '#071c17',
          fontFamily: 'Georgia, serif',
          textAlign: 'center',
        }}
      >
        <title>Les Terres de Caldera</title>
        <main style={{ width: 'min(100%, 42rem)' }}>
          <p
            style={{
              margin: '0 0 0.75rem',
              color: '#0b6650',
              font: '700 0.72rem system-ui, sans-serif',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            Les Terres de Caldera
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(2rem, 6vw, 3.25rem)',
              lineHeight: 1.08,
            }}
          >
            L’exploration est momentanément interrompue.
          </h1>
          <p
            style={{
              maxWidth: '34rem',
              margin: '1rem auto 0',
              color: '#52645d',
              font: '400 1rem/1.7 system-ui, sans-serif',
            }}
          >
            Une erreur inattendue est survenue. Vous pouvez réessayer ou
            poursuivre votre visite depuis le catalogue.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem',
              marginTop: '1.75rem',
            }}
          >
            <button type="button" onClick={reset} style={primary}>
              Réessayer
            </button>
            <Link href="/catalogue" style={secondary}>
              Voir tous les produits
            </Link>
          </div>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: '44px',
              marginTop: '0.75rem',
              color: '#173e32',
              font: '600 0.86rem system-ui, sans-serif',
              textUnderlineOffset: '4px',
            }}
          >
            Retour à l’accueil
          </Link>
        </main>
      </body>
    </html>
  );
}
