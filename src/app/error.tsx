'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import { Button } from '@/components/ui/Button/Button';
import styles from '@/components/catalog/Catalog.module.scss';
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // Browser-side render errors; server ones already arrive through onRequestError.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <section className={styles.empty}>
          <h1>L’exploration est momentanément interrompue.</h1>
          <p>
            Nous n’avons pas pu charger le catalogue. Veuillez réessayer dans un
            instant.
          </p>
          <div>
            <Button onClick={() => retry()}>Réessayer</Button>
            <Button href="/catalogue" variant="outline">
              Voir tous les produits
            </Button>
            <Link href="/" className={styles.errorHome}>Retour à l’accueil</Link>
          </div>
        </section>
      </Container>
    </main>
  );
}
