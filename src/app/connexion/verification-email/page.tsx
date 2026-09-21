import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmEmailChangeAction } from '@/lib/auth/customer/actions';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Confirmation email | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default async function VerifyEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token;
  const verified = token ? await confirmEmailChangeAction(token) : false;
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.auth}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>SÉCURITÉ</p>
            <h1>{verified ? 'Adresse mise à jour' : 'Lien invalide'}</h1>
            <p>
              {verified
                ? 'Votre nouvelle adresse email est confirmée.'
                : 'Ce lien est invalide ou a expiré.'}
            </p>
            <Link
              className={styles.button}
              href={verified ? '/compte/profil' : '/compte'}
            >
              Continuer
            </Link>
          </section>
        </div>
      </Container>
    </main>
  );
}
