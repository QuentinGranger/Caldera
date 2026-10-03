import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin, Package, Truck } from 'lucide-react';
import { OrderCard } from '@/components/account/AccountOrders';
import { requireCustomer } from '@/lib/account/guard';
import { isOpenOrder } from '@/lib/account/orderStatus';
import { getCustomerAddress, getCustomerOrders } from '@/lib/account/queries';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Mon compte' };

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountDashboard({ searchParams }: Props) {
  const customer = await requireCustomer('/compte');
  const [orders, address, params] = await Promise.all([
    getCustomerOrders(customer),
    getCustomerAddress(customer.id),
    searchParams,
  ]);
  const open = orders.filter((order) => isOpenOrder(order.tone));
  // The order to follow first: the latest still on its way, else the latest.
  const featured = open[0] ?? orders[0];
  const firstName = customer.name.split(/\s+/)[0] ?? customer.name;
  return (
    <>
      {params.bienvenue === '1' && (
        <p className={styles.notice} role="status">
          Adresse confirmée : bienvenue, votre compte est actif.
        </p>
      )}
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Tableau de bord</p>
        <h1 className={styles.title}>Bonjour {firstName}</h1>
        <p className={styles.lead}>
          Vos commandes, votre adresse et vos réglages, au même endroit.
        </p>
      </header>

      <ul className={styles.tiles} aria-label="En un coup d’œil">
        <li>
          <Link href="/compte/commandes" className={styles.tile}>
            <Package size={20} aria-hidden="true" />
            <span className={styles.tileLabel}>Commandes</span>
            <strong className={styles.tileValue}>{orders.length}</strong>
            <span className={styles.tileHint}>
              {orders[0]
                ? `Dernière le ${shortDate.format(orders[0].createdAt)}`
                : 'Aucune pour l’instant'}
            </span>
          </Link>
        </li>
        <li>
          <Link href="/compte/commandes" className={styles.tile}>
            <Truck size={20} aria-hidden="true" />
            <span className={styles.tileLabel}>En cours</span>
            <strong className={styles.tileValue}>{open.length}</strong>
            <span className={styles.tileHint}>
              {open.length ? 'Préparation ou livraison' : 'Rien en attente'}
            </span>
          </Link>
        </li>
        <li>
          <Link href="/compte/adresse" className={styles.tile}>
            <MapPin size={20} aria-hidden="true" />
            <span className={styles.tileLabel}>Adresse de livraison</span>
            <strong className={styles.tileValue}>
              {address ? address.city : 'À ajouter'}
            </strong>
            <span className={styles.tileHint}>
              {address
                ? 'Proposée à votre prochaine commande'
                : 'Pour commander plus vite'}
            </span>
          </Link>
        </li>
      </ul>

      {featured ? (
        <section className={styles.block} aria-labelledby="suivi">
          <div className={styles.blockHeader}>
            <h2 id="suivi">
              {isOpenOrder(featured.tone)
                ? 'Commande en cours'
                : 'Dernière commande'}
            </h2>
            <Link href="/compte/commandes" className={styles.more}>
              Toutes mes commandes
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <OrderCard order={featured} tracking />
        </section>
      ) : (
        <section className={styles.empty} aria-labelledby="vide">
          <h2 id="vide">Votre première expédition vous attend</h2>
          <p>
            Vos commandes apparaîtront ici, y compris celles passées sans compte
            avec {customer.email}.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/catalogue" className={styles.submit}>
              {ALL_PRODUCTS_LABEL}
            </Link>
            <Link href="/nouveautes" className={styles.secondary}>
              Voir les nouveautés
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
