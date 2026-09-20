import Link from 'next/link';
import {
  ArrowUpRight,
  Boxes,
  CheckCheck,
  ClipboardList,
  PackageCheck,
  PackagePlus,
  Truck,
} from 'lucide-react';
import { getDashboard, getFulfillmentDashboard } from '@/lib/admin/queries';
import { euros, formatDate, label } from '@/lib/admin/format';
import { PageHeader, Badge, AdminTable } from '@/components/admin/AdminUI';
import styles from '@/components/admin/Admin.module.scss';
export default async function DashboardPage() {
  const [data, fulfillment] = await Promise.all([
    getDashboard(),
    getFulfillmentDashboard(),
  ]);
  const stats = [
    {
      title: 'À préparer',
      value: fulfillment.unfulfilled,
      href: '/admin/commandes?fulfillment=UNFULFILLED',
      caption: 'Commandes payées',
      icon: ClipboardList,
      tone: styles.lavender,
    },
    {
      title: 'En préparation',
      value: fulfillment.preparing,
      href: '/admin/commandes?fulfillment=PREPARING',
      caption: 'Préparations en cours',
      icon: Boxes,
      tone: styles.peach,
    },
    {
      title: 'Prêtes à expédier',
      value: fulfillment.ready,
      href: '/admin/commandes?fulfillment=READY_TO_SHIP',
      caption: 'Colis à remettre',
      icon: PackageCheck,
      tone: styles.cyan,
    },
    {
      title: 'Expédiées aujourd’hui',
      value: fulfillment.shippedToday,
      href: '/admin/commandes?sort=shipped',
      caption: 'Journée de Paris',
      icon: Truck,
      tone: styles.lime,
    },
  ];
  const attention = [
    {
      label: 'Commandes à vérifier',
      count: data.review,
      href: '/admin/commandes?status=PAYMENT_REVIEW',
    },
    {
      label: 'Emails en échec',
      count: fulfillment.failedEmails,
      href: '/admin/commandes?emails=failed',
    },
    {
      label: 'Produits en rupture',
      count: data.out,
      href: '/admin/produits?status=ACTIVE&availability=out',
    },
    {
      label: 'Produits avec stock faible',
      count: data.low,
      href: '/admin/produits?status=ACTIVE&availability=low',
    },
  ].filter((item) => item.count > 0);
  return (
    <>
      <span className={styles.eyebrow}>Votre centre de contrôle</span>
      <PageHeader
        title="Tableau de bord"
        description="Les priorités du jour. Les bonnes actions, au bon endroit."
      >
        <Link className={styles.button} href="/admin/commandes?view=todo">
          <ClipboardList size={17} aria-hidden="true" />
          Traiter les commandes
        </Link>
      </PageHeader>
      <section
        aria-label="Préparation et expédition"
        className={styles.statGrid}
      >
        {stats.map(({ title, value, href, caption, icon: Icon, tone }) => (
          <Link href={href} key={title} className={`${styles.stat} ${tone}`}>
            <span className={styles.statLabel}>
              {title}
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <strong>{value}</strong>
            <small>{caption} ↗</small>
          </Link>
        ))}
      </section>
      <nav className={styles.quickGrid} aria-label="Actions rapides">
        <Link className={styles.quickLink} href="/admin/produits/nouveau">
          <PackagePlus size={21} aria-hidden="true" />
          Créer un produit
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link className={styles.quickLink} href="/admin/stocks">
          <Boxes size={21} aria-hidden="true" />
          Mettre à jour les stocks
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link
          className={styles.quickLink}
          href="/admin/commandes?fulfillment=READY_TO_SHIP"
        >
          <Truck size={21} aria-hidden="true" />
          Préparer les expéditions
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </nav>
      <div className={styles.dashboardGrid}>
        <div>
          <section className={styles.card}>
            <div className={styles.panelHeader}>
              <h2>Dernières commandes</h2>
              <Link href="/admin/commandes">Tout voir ↗</Link>
            </div>
            {data.recentOrders.length ? (
              <AdminTable
                caption="Commandes récentes"
                headings={['Commande', 'Statut', 'Montant']}
              >
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/commandes/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      <Badge value={order.status} />
                    </td>
                    <td>
                      <strong>{euros(order.totalAmount)}</strong>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            ) : (
              <p className={styles.muted}>
                Aucune commande pour le moment. Les prochaines apparaîtront ici.
              </p>
            )}
          </section>
          <section className={styles.card}>
            <div className={styles.panelHeader}>
              <h2>Journal d’activité</h2>
              <span className={styles.badge}>20 dernières actions</span>
            </div>
            <div
              className={styles.auditScroll}
              role="region"
              aria-label="Journal d’activité administrative"
              tabIndex={0}
            >
              <ul className={styles.audit}>
                {data.logs.map((log) => (
                  <li key={log.id}>
                    <strong>{label(log.action)}</strong> · {log.adminUser.name}
                    <small>{formatDate(log.createdAt)}</small>
                    <details>
                      <summary>Détails de l’action</summary>
                      <small>
                        {log.entityType} · {log.entityId}
                      </small>
                      <code>{JSON.stringify(log.metadata)}</code>
                    </details>
                  </li>
                ))}
              </ul>
              {!data.logs.length && (
                <p className={styles.muted}>
                  Les actions de l’équipe seront enregistrées ici.
                </p>
              )}
            </div>
            <small>Dates affichées à l’heure de Paris.</small>
          </section>
        </div>
        <div>
          <section className={styles.card}>
            <div className={styles.panelHeader}>
              <h2>À surveiller</h2>
              <span className={styles.badge}>
                {attention.length} point{attention.length > 1 ? 's' : ''}
              </span>
            </div>
            {attention.length ? (
              <div className={styles.attentionList}>
                {attention.map((item) => (
                  <Link key={item.label} href={item.href}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.inline}>
                <CheckCheck size={22} aria-hidden="true" />
                Aucune alerte sur les paiements à vérifier, les emails ou le
                stock.
              </p>
            )}
            {data.failed > 0 && (
              <p className={styles.warning}>
                {data.failed} paiement(s) échoué(s) sur les 7 derniers jours.{' '}
                <Link href="/admin/commandes?payment=FAILED">
                  Consulter les échecs
                </Link>
              </p>
            )}
          </section>
          <section className={styles.card}>
            <h2>La boutique en chiffres</h2>
            <dl className={styles.metricList}>
              <div>
                <dt>
                  <Link href="/admin/produits?status=ACTIVE">
                    Produits actifs
                  </Link>
                </dt>
                <dd>{data.active}</dd>
              </div>
              <div>
                <dt>
                  <Link href="/admin/commandes">En attente de paiement</Link>
                </dt>
                <dd>{data.waiting}</dd>
              </div>
              <div>
                <dt>Commandes payées · 7 jours</dt>
                <dd>{data.recentPaid}</dd>
              </div>
              <div>
                <dt>
                  <Link href="/admin/stocks?availability=reserved">
                    Réservations actives
                  </Link>
                </dt>
                <dd>{data.reservations}</dd>
              </div>
            </dl>
          </section>
          <section className={`${styles.card} ${styles.lavender}`}>
            <h2>Total des commandes payées</h2>
            <p className={styles.total}>{euros(data.paidTotal ?? 0)}</p>
            <small>
              Cumul historique des commandes payées, hors gestion des
              remboursements.
            </small>
          </section>
        </div>
      </div>
    </>
  );
}
