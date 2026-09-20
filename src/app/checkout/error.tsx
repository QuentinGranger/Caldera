'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/checkout/Checkout.module.scss';
export default function CheckoutError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main id="contenu">
      <Container>
        <div className={styles.notice}>
          <h1>Votre préparation est momentanément indisponible.</h1>
          <p>
            Nous n’avons pas pu charger votre session. Vos informations déjà
            enregistrées restent conservées.
          </p>
          <div className={styles.actions}>
            <Button onClick={retry}>Réessayer</Button>
            <Link href="/panier">Retour au panier</Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
