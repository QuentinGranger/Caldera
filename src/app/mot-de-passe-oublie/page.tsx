import type { Metadata } from 'next';
import Link from 'next/link';
import { CustomerAuthForm } from '@/components/account/CustomerForm';
import { requestPasswordResetAction } from '@/lib/auth/customer/actions';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Mot de passe oublié | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default function ForgotPasswordPage() {
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.auth}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>SÉCURITÉ</p>
            <h1>Mot de passe oublié</h1>
            <p>
              Indiquez votre adresse email. Si un compte existe, vous recevrez
              un lien de réinitialisation.
            </p>
            <CustomerAuthForm
              action={requestPasswordResetAction}
              mode="reset-request"
            />
            <div className={styles.authLinks}>
              <Link href="/connexion">Retour à la connexion</Link>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
