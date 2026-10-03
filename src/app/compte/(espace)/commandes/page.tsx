import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderCard } from '@/components/account/AccountOrders';
import { requireCustomer } from '@/lib/account/guard';
import { getCustomerOrders } from '@/lib/account/queries';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Mes commandes' };

export default async function AccountOrders() {
  const customer = await requireCustomer('/compte/commandes');
  const orders = await getCustomerOrders(customer);
  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Mon compte</p>
        <h1 className={styles.title}>Mes commandes</h1>
        <p className={styles.lead}>
          Les commandes passées avec ce compte, et celles passées sans compte
          avec l’adresse {customer.email}.
        </p>
      </header>
      {orders.length ? (
        <ul className={styles.orderList}>
          {orders.map((order) => (
            <li key={order.orderNumber}>
              <OrderCard order={order} tracking={order.step !== 3} />
            </li>
          ))}
        </ul>
      ) : (
        <section className={styles.empty} aria-labelledby="vide">
          <h2 id="vide">Aucune commande pour l’instant</h2>
          <p>Vos prochaines commandes et leur suivi apparaîtront ici.</p>
          <div className={styles.emptyActions}>
            <Link href="/catalogue" className={styles.submit}>
              {ALL_PRODUCTS_LABEL}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
