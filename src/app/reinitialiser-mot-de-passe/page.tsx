import type { Metadata } from 'next';
import Link from 'next/link';
import { CustomerAuthForm } from '@/components/account/CustomerForm';
import { resetPasswordAction } from '@/lib/auth/customer/actions';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Réinitialiser le mot de passe | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token;
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.auth}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>SÉCURITÉ</p>
            <h1>Nouveau mot de passe</h1>
            {token ? (
              <CustomerAuthForm
                action={resetPasswordAction}
                mode="reset"
                token={token}
              />
            ) : (
              <p className={`${styles.message} ${styles.error}`} role="alert">
                Ce lien de réinitialisation est incomplet.
              </p>
            )}
            <div className={styles.authLinks}>
              <Link href="/connexion">Retour à la connexion</Link>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
