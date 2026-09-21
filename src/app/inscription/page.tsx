import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { registerCustomerAction } from '@/lib/auth/customer/actions';
import { getCurrentCustomer } from '@/lib/auth/customer/session';
import { CustomerAuthForm } from '@/components/account/CustomerForm';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Créer un compte | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function RegisterPage() {
  if (await getCurrentCustomer()) redirect('/compte');
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.auth}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>ESPACE COLLECTIONNEUR</p>
            <h1>Créer un compte</h1>
            <p>
              Suivez vos commandes et retrouvez vos informations plus
              facilement. L’achat invité reste toujours disponible.
            </p>
            <CustomerAuthForm action={registerCustomerAction} mode="register" />
            <div className={styles.authLinks}>
              <Link href="/connexion">J’ai déjà un compte</Link>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
