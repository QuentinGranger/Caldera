import Link from 'next/link';
import {
  ArrowUpRight,
  Boxes,
  CheckCheck,
  ClipboardList,
  FolderTree,
  MessageCircleQuestion,
  PackageCheck,
  PackagePlus,
  Truck,
} from 'lucide-react';
import { getDashboard, getFulfillmentDashboard } from '@/lib/admin/queries';
import { countOpenReturns } from '@/lib/returns/admin';
import { auditLink, euros, formatDate, label } from '@/lib/admin/format';
import { PageHeader, Badge, AdminTable } from '@/components/admin/AdminUI';
import styles from '@/components/admin/Admin.module.scss';
export default async function DashboardPage() {
  const [data, fulfillment, returns] = await Promise.all([
    getDashboard(),
    getFulfillmentDashboard(),
    countOpenReturns(),
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
      words: ['commande à vérifier', 'commandes à vérifier'],
    },
    {
      label: 'Retours à examiner ou à rembourser',
      count: returns,
      href: '/admin/retours?open=1',
      words: ['retour ouvert', 'retours ouverts'],
    },
    {
      label: 'Emails en échec',
      count: fulfillment.failedEmails,
      href: '/admin/commandes?emails=failed',
      words: ['email en échec', 'emails en échec'],
    },
    {
      label: 'Produits publiés mais invisibles en boutique',
      count: data.hidden,
      href: '/admin/produits?visibility=hidden',
      words: [
        'produit publié invisible en boutique',
        'produits publiés invisibles en boutique',
      ],
    },
    {
      label: 'Produits en rupture',
      count: data.out,
      href: '/admin/produits?status=ACTIVE&availability=out',
      words: ['produit en rupture', 'produits en rupture'],
    },
    {
      label: 'Produits avec stock faible',
      count: data.low,
      href: '/admin/produits?status=ACTIVE&availability=low',
      words: ['produit en stock faible', 'produits en stock faible'],
    },
  ].filter((item) => item.count > 0);
  // The day starts with the parcels: paid orders not shipped yet.
  const toHandle =
    fulfillment.unfulfilled + fulfillment.preparing + fulfillment.ready;
  const alerts = attention.length
    ? `${attention.length} alerte${attention.length > 1 ? 's' : ''} à surveiller : ${attention
        .map(({ count, words }) => `${count} ${words[count > 1 ? 1 : 0]}`)
        .join(', ')}.`
    : 'Aucune alerte sur les paiements, les retours, les emails ou le stock.';
  return (
    <>
      <span className={styles.eyebrow}>Votre centre de contrôle</span>
      <PageHeader
        title="Tableau de bord"
        description="Un aperçu clair des commandes, du stock et des actions à mener."
      />
      <section className={styles.dashboardHero} aria-label="Priorités du jour">
        <div>
          <span>AUJOURD’HUI SUR CALDERA</span>
          <h2>
            {toHandle
              ? `${toHandle} commande${toHandle > 1 ? 's' : ''} à traiter`
              : attention.length
                ? 'Aucune commande à traiter'
                : 'Tout est à jour'}
          </h2>
          <p>{alerts}</p>
        </div>
        <Link
          href={toHandle ? '/admin/commandes?view=todo' : '/admin/commandes'}
        >
          {toHandle ? 'Traiter les commandes' : 'Voir les commandes'}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>
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
      <h2 className={styles.quickHeading}>Accès rapides</h2>
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
        <Link className={styles.quickLink} href="/admin/jeux">
          <MessageCircleQuestion size={21} aria-hidden="true" />
          Modifier les FAQ des jeux
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link className={styles.quickLink} href="/admin/categories">
          <FolderTree size={21} aria-hidden="true" />
          Gérer les familles
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
              {data.logs.length > 1 && (
                <span className={styles.badge}>
                  {data.logs.length} dernières actions
                </span>
              )}
            </div>
            <div
              className={styles.auditScroll}
              role="region"
              aria-label="Journal d’activité administrative"
              tabIndex={0}
            >
              <ul className={styles.audit}>
                {data.logs.map((log) => {
                  const link = auditLink(
                    log.action,
                    log.entityType,
                    log.entityId,
                  );
                  return (
                    <li key={log.id}>
                      <strong>{label(log.action)}</strong> ·{' '}
                      {log.adminUser.name}
                      <small>{formatDate(log.createdAt)}</small>
                      {link && (
                        <Link href={link.href} className={styles.auditLink}>
                          {link.label} ↗
                        </Link>
                      )}
                      <details>
                        <summary>Détails techniques</summary>
                        <small>
                          {log.entityType} · {log.entityId}
                        </small>
                        <code>{JSON.stringify(log.metadata)}</code>
                      </details>
                    </li>
                  );
                })}
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
                {attention.length} alerte{attention.length > 1 ? 's' : ''}
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
                {data.failed > 1
                  ? `${data.failed} paiements échoués`
                  : '1 paiement échoué'}{' '}
                sur les 7 derniers jours.{' '}
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
                    Produits publiés
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
