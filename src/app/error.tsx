'use client';
import { Container } from '@/components/ui/Container/Container';
import { Button } from '@/components/ui/Button/Button';
import styles from '@/components/catalog/Catalog.module.scss';
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
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
          </div>
        </section>
      </Container>
    </main>
  );
}
