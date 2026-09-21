import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyCustomerEmailAction } from '@/lib/auth/customer/actions';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Vérification email | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token;
  const verified = token ? await verifyCustomerEmailAction(token) : false;
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.auth}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>SÉCURITÉ</p>
            <h1>{verified ? 'Adresse confirmée' : 'Lien invalide'}</h1>
            <p>
              {verified
                ? 'Votre adresse email est maintenant vérifiée.'
                : 'Ce lien est invalide ou a expiré.'}
            </p>
            <Link
              className={styles.button}
              href={verified ? '/compte' : '/connexion'}
            >
              {verified ? 'Accéder à mon compte' : 'Retour à la connexion'}
            </Link>
          </section>
        </div>
      </Container>
    </main>
  );
}
