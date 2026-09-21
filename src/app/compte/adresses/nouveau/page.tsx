import type { Metadata } from 'next';
import Link from 'next/link';
import { AddressForm } from '@/components/account/CustomerForm';
import { createAddressAction } from '@/lib/customer/actions';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Nouvelle adresse | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default function NewAddressPage() {
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MON COMPTE</p>
        <h1>Nouvelle adresse</h1>
        <p>Cette adresse sera disponible lors de vos prochaines commandes.</p>
      </header>
      <section className={styles.card}>
        <AddressForm action={createAddressAction} />
        <div className={styles.actions}>
          <Link className={styles.textLink} href="/compte/adresses">
            Retour aux adresses
          </Link>
        </div>
      </section>
    </>
  );
}
