import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginCustomerAction } from '@/lib/auth/customer/actions';
import { getCurrentCustomer } from '@/lib/auth/customer/session';
import { CustomerAuthForm } from '@/components/account/CustomerForm';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Connexion | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  if (await getCurrentCustomer()) redirect('/compte');
  const params = await searchParams;
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.auth}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>ESPACE COLLECTIONNEUR</p>
            <h1>Connexion</h1>
            {params.reset && (
              <p className={styles.message} role="status">
                Votre mot de passe a été modifié. Vous pouvez vous connecter.
              </p>
            )}
            <CustomerAuthForm
              action={loginCustomerAction}
              mode="login"
              next={params.next}
            />
            <div className={styles.authLinks}>
              <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
              <Link href="/inscription">Créer un compte</Link>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
