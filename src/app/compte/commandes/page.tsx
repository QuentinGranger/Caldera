import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCustomer } from '@/lib/auth/customer/session';
import { getCustomerOrders } from '@/lib/customer/data';
import { formatPrice } from '@/utils/formatPrice';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Mes commandes | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
const labels: Record<string, string> = {
  PENDING_PAYMENT: 'Paiement en attente',
  PAYMENT_PROCESSING: 'Paiement en cours',
  PAID: 'Payée',
  PAYMENT_FAILED: 'Paiement échoué',
  PAYMENT_REVIEW: 'En vérification',
  CANCELLED: 'Annulée',
  EXPIRED: 'Expirée',
};
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const customer = await requireCustomer();
  const raw = Number((await searchParams).page ?? 1);
  const result = await getCustomerOrders(
    customer.id,
    Number.isFinite(raw) ? raw : 1,
  );
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MON COMPTE</p>
        <h1>Mes commandes</h1>
        <p>Retrouvez vos commandes et leur suivi.</p>
      </header>
      {result.rows.length ? (
        <section className={styles.card}>
          <div className={styles.tableWrap}>
            <table className={styles.orders}>
              <caption className="visually-hidden">
                Historique de mes commandes
              </caption>
              <thead>
                <tr>
                  <th>Commande</th>
                  <th>Date</th>
                  <th>Articles</th>
                  <th>Statut</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((order) => (
                  <tr key={order.publicId}>
                    <td>
                      <Link href={`/compte/commandes/${order.publicId}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>{order.createdAt.toLocaleDateString('fr-FR')}</td>
                    <td>{order._count.items}</td>
                    <td className={styles.status}>
                      {labels[order.status] ?? order.status}
                    </td>
                    <td>{formatPrice(order.totalAmount.toFixed(2))}</td>
                    <td>
                      <Link href={`/compte/commandes/${order.publicId}`}>
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.pageCount > 1 && (
            <div className={styles.actions}>
              {result.page > 1 && (
                <Link
                  className={styles.textLink}
                  href={`/compte/commandes?page=${result.page - 1}`}
                >
                  Précédente
                </Link>
              )}
              {result.page < result.pageCount && (
                <Link
                  className={styles.textLink}
                  href={`/compte/commandes?page=${result.page + 1}`}
                >
                  Suivante
                </Link>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className={styles.card}>
          <h2>Pas encore de commande</h2>
          <p>Vous n’avez pas encore passé de commande.</p>
          <Link className={styles.button} href="/catalogue">
            Découvrir la boutique
          </Link>
        </section>
      )}
    </>
  );
}
