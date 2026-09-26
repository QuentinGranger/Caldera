'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Replaces the root layout when it fails: no global styles, fonts or header here.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          padding: '4rem 1rem',
          background: '#fffcf5',
          color: '#071c17',
          fontFamily: 'Georgia, serif',
          textAlign: 'center',
        }}
      >
        <title>Les Terres de Caldera</title>
        <h1>L’exploration est momentanément interrompue.</h1>
        <p>Une erreur inattendue est survenue. Veuillez réessayer.</p>
        <button type="button" onClick={() => retry()}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
