import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ShoppingBag,
  Plus,
  Boxes,
  CheckCheck,
  ClipboardList,
  BarChart3,
  Landmark,
  PackageCheck,
  PackagePlus,
  Truck,
} from 'lucide-react';
import { getDashboard, getFulfillmentDashboard } from '@/lib/admin/queries';
import { countOpenReturns } from '@/lib/returns/admin';
import { countOpenMessages } from '@/lib/admin/messages';
import { auditLink, euros, formatDate, label } from '@/lib/admin/format';
import { PageHeader, Badge, AdminTable } from '@/components/admin/AdminUI';
import styles from '@/components/admin/Admin.module.scss';
export default async function DashboardPage() {
  const [data, fulfillment, returns, messages] = await Promise.all([
    getDashboard(),
    getFulfillmentDashboard(),
    countOpenReturns(),
    countOpenMessages(),
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
      label: 'Messages de contact à traiter',
      count: messages,
      href: '/admin/messages',
      words: ['message à traiter', 'messages à traiter'],
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
    ? `${attention.length} point${attention.length > 1 ? 's' : ''} à surveiller. Retrouvez les détails ci-dessous.`
    : 'Aucune action urgente. Vous pouvez vous concentrer sur la suite.';
  return (
    <>
      <span className={styles.dashboardDate}>
        <CalendarDays size={14} aria-hidden="true" />
        {new Intl.DateTimeFormat('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Paris',
        }).format(new Date())}
        <span>Vue d’ensemble</span>
      </span>
      <PageHeader
        title="Tableau de bord"
        description="Un point clair sur votre activité et les prochaines actions."
      >
        <Link className={styles.button} href="/admin/produits/nouveau">
          <Plus size={17} aria-hidden="true" /> Créer un produit
        </Link>
      </PageHeader>
      <section className={styles.dashboardHero} aria-label="Priorités du jour">
        <div className={styles.priorityContent}>
          <span className={styles.priorityIcon}>
            {toHandle || attention.length ? (
              <CircleAlert size={25} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={25} aria-hidden="true" />
            )}
          </span>
          <div>
            <span>VOTRE POINT DU JOUR</span>
            <h2>
              {toHandle
                ? `${toHandle} commande${toHandle > 1 ? 's' : ''} à traiter`
                : attention.length
                  ? 'Aucune commande à traiter'
                  : 'Tout est à jour'}
            </h2>
            <p>{alerts}</p>
          </div>
        </div>
        <Link
          href={toHandle ? '/admin/commandes?view=todo' : '/admin/commandes'}
        >
          {toHandle ? 'Traiter les commandes' : 'Voir les commandes'}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>
      <div className={styles.sectionHeading}>
        <h2>Préparation & expédition</h2>
        <Link href="/admin/commandes">
          Toutes les commandes <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <section
        aria-label="Préparation et expédition"
        className={styles.statGrid}
      >
        {stats.map(({ title, value, href, caption, icon: Icon, tone }) => (
          <Link href={href} key={title} className={`${styles.stat} ${tone}`}>
            <span className={styles.statLabel}>
              {title}
              <span className={styles.statIcon}>
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              </span>
            </span>
            <strong>{value}</strong>
            <small>
              {caption}
              <ArrowUpRight size={14} aria-hidden="true" />
            </small>
          </Link>
        ))}
      </section>
      <h2 className={styles.quickHeading}>Passer à l’action</h2>
      <nav className={styles.quickGrid} aria-label="Actions rapides">
        <Link className={styles.quickLink} href="/admin/produits/nouveau">
          <span className={styles.quickIcon}>
            <PackagePlus size={21} aria-hidden="true" />
          </span>
          <span>
            <strong>Enrichir le catalogue</strong>
            <small>Créer une nouvelle fiche produit</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link className={styles.quickLink} href="/admin/stocks">
          <span className={styles.quickIcon}>
            <Boxes size={21} aria-hidden="true" />
          </span>
          <span>
            <strong>Mettre à jour les stocks</strong>
            <small>Quantités, ruptures et demandes</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link
          className={styles.quickLink}
          href="/admin/commandes?fulfillment=READY_TO_SHIP"
        >
          <span className={styles.quickIcon}>
            <Truck size={21} aria-hidden="true" />
          </span>
          <span>
            <strong>Préparer les expéditions</strong>
            <small>Retrouver les colis prêts à partir</small>
          </span>
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
              <div className={styles.dashboardEmpty}>
                <span>
                  <ShoppingBag size={25} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <strong>Vos prochaines commandes, ici</strong>
                <p>
                  Montant, paiement et préparation : les dernières commandes
                  seront réunies dans cette vue.
                </p>
              </div>
            )}
          </section>
          <details className={`${styles.card} ${styles.activityDisclosure}`}>
            <summary>
              Journal d’activité{' '}
              <span>{data.logs.length} dernières actions</span>
            </summary>
            <div className={styles.panelHeader}>
              <h2 className={styles.visuallyHidden}>Journal d’activité</h2>
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
          </details>
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
              <div className={styles.allClear}>
                <CheckCheck size={21} aria-hidden="true" />
                <div>
                  <strong>Aucun point bloquant</strong>
                  <p>
                    Les paiements à vérifier, les emails et le stock ne
                    nécessitent aucune action.
                  </p>
                </div>
              </div>
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
      <section className={styles.reportLinks} aria-label="Rapports et analyses">
        <Link href="/admin/mesures">
          <span className={styles.reportIcon}>
            <BarChart3 size={21} aria-hidden="true" />
          </span>
          <span>
            <strong>Comprendre les performances</strong>
            <small>Trafic, conversions et campagnes email</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/admin/pilotage">
          <span className={styles.reportIcon}>
            <Landmark size={21} aria-hidden="true" />
          </span>
          <span>
            <strong>Piloter la rentabilité</strong>
            <small>Marge, rotation du stock et trésorerie</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
