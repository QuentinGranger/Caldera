'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

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
        <main>
          <h1>L’exploration est momentanément interrompue.</h1>
          <p>Une erreur inattendue est survenue. Veuillez réessayer.</p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem',
              marginTop: '1.5rem',
            }}
          >
            <button
              type="button"
              onClick={() => retry()}
              style={{
                minHeight: 44,
                padding: '0 1.25rem',
                border: 0,
                borderRadius: 999,
                background: '#173e32',
                color: '#fffaf0',
                font: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
            <Link
              href="/catalogue"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 1.25rem',
                border: '1px solid #173e32',
                borderRadius: 999,
                color: '#173e32',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Voir tous les produits
            </Link>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 0.75rem',
                color: '#173e32',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: 4,
              }}
            >
              Retour à l’accueil
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
