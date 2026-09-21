import type { Metadata } from 'next';
import Link from 'next/link';
import { getCustomerAddresses, getCustomerOrders } from '@/lib/customer/data';
import { requireCustomer } from '@/lib/auth/customer/session';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = {
  title: 'Mon compte | Les Terres de Caldera',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const customer = await requireCustomer();
  const [orders, addresses] = await Promise.all([
    getCustomerOrders(customer.id, 1, 3),
    getCustomerAddresses(customer.id),
  ]);
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>LES TERRES DE CALDERA</p>
        <h1>Mon compte</h1>
        <p>
          Gérez vos informations, vos commandes et vos adresses depuis un seul
          espace.
        </p>
      </header>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Mes commandes</h2>
          <p>
            {orders.total
              ? `Retrouvez vos ${orders.total} commande${orders.total > 1 ? 's' : ''} les plus récentes.`
              : 'Vous n’avez pas encore passé de commande.'}
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} href="/compte/commandes">
              Voir mes commandes
            </Link>
          </div>
        </section>
        <section className={styles.card}>
          <h2>Mes adresses</h2>
          <p>
            {addresses.length
              ? `${addresses.length} adresse${addresses.length > 1 ? 's' : ''} enregistrée${addresses.length > 1 ? 's' : ''}.`
              : 'Ajoutez une adresse pour accélérer vos prochaines commandes.'}
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} href="/compte/adresses">
              Gérer mes adresses
            </Link>
          </div>
        </section>
        <section className={styles.card}>
          <h2>Informations du compte</h2>
          <p>{customer.email}</p>
          <p className={styles.muted}>
            {customer.emailVerifiedAt
              ? 'Adresse email vérifiée.'
              : 'Adresse email à vérifier.'}
          </p>
          <div className={styles.actions}>
            <Link
              className={`${styles.button} ${styles.buttonOutline}`}
              href="/compte/profil"
            >
              Modifier mon profil
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
