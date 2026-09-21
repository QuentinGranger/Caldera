import type { Metadata } from 'next';
import { updateProfileAction } from '@/lib/auth/customer/actions';
import { requireCustomer } from '@/lib/auth/customer/session';
import { ProfileForm } from '@/components/account/CustomerForm';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Mon profil | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default async function ProfilePage() {
  const customer = await requireCustomer();
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MON COMPTE</p>
        <h1>Mon profil</h1>
        <p>
          Gardez vos coordonnées à jour. Votre adresse email ne change qu’après
          confirmation.
        </p>
      </header>
      <section className={styles.card}>
        <ProfileForm action={updateProfileAction} customer={customer} />
      </section>
    </>
  );
}
