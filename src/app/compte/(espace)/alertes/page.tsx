import type { Metadata } from 'next';
import Link from 'next/link';
import { StockAlertRemoveButton } from '@/components/account/StockAlertRemoveButton';
import { requireCustomer } from '@/lib/account/guard';
import { getCustomerStockAlerts } from '@/lib/stock-alerts/service';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Mes alertes de stock' };

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

export default async function AccountStockAlerts() {
  const customer = await requireCustomer('/compte/alertes');
  const alerts = await getCustomerStockAlerts(customer);
  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Mon compte</p>
        <h1 className={styles.title}>Alertes de retour en stock</h1>
        <p className={styles.lead}>
          Un e-mail vous est envoyé à {customer.email}, une seule fois, dès
          qu’une version épuisée est de nouveau disponible. L’alerte s’arrête
          ensuite d’elle-même.
        </p>
      </header>
      {alerts.length ? (
        <ul className={styles.alertList}>
          {alerts.map((alert) => (
            <li key={alert.id} className={styles.alertItem}>
              <div>
                <Link href={alert.href} className={styles.alertName}>
                  {alert.name}
                </Link>
                <p className={styles.alertMeta}>
                  {alert.language} · demandée le{' '}
                  {dateFormat.format(alert.createdAt)}
                </p>
                <p className={styles.alertMeta}>
                  {alert.pending
                    ? 'En attente de confirmation par e-mail.'
                    : alert.backInStock
                      ? 'De retour : l’e-mail part dans quelques minutes.'
                      : 'Toujours épuisée : nous surveillons.'}
                </p>
              </div>
              <StockAlertRemoveButton
                alertId={alert.id}
                label={`${alert.name}, version ${alert.language}`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <section className={styles.empty} aria-labelledby="vide">
          <h2 id="vide">Aucune alerte en cours</h2>
          <p>
            Sur la page d’un produit épuisé, choisissez « M’avertir du retour »
            : l’alerte apparaîtra ici.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/catalogue" className={styles.submit}>
              Parcourir le catalogue
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
