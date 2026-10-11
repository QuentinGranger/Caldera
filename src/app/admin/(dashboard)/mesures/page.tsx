import Link from 'next/link';
import { PageHeader } from '@/components/admin/AdminUI';
import { euros } from '@/lib/admin/format';
import { getMeasurementOverview } from '@/lib/admin/measurement';
import styles from '@/components/admin/Admin.module.scss';
const percent = (n: number, d: number) =>
  d ? `${((100 * n) / d).toFixed(1)} %` : '—';
export default async function MeasurementPage() {
  const data = await getMeasurementOverview();
  const gross = Number(data.sales._sum.totalAmount ?? 0);
  const refunded = Number(data.refunds._sum.amount ?? 0);
  return (
    <>
      <PageHeader
        title="Mesures & acquisition"
        description="30 derniers jours · données de ventes confirmées et rapports marketing. Aucun chiffre n’est simulé."
      />
      <section
        className={styles.pilotageKpis}
        aria-label="Indicateurs de vente"
      >
        {[
          ['Encaissements confirmés', euros(gross)],
          ['Remboursements confirmés', euros(refunded)],
          ['Encaissements nets', euros(gross - refunded)],
          [
            'Panier moyen payé',
            data.sales._count ? euros(gross / data.sales._count) : '—',
          ],
          ['Commandes payées', String(data.sales._count)],
          [
            'Achats répétés',
            percent(Number(data.repeat?.repeat ?? 0), data.sales._count),
          ],
          [
            'Checkout sans paiement après 24 h',
            percent(data.checkouts - data.completed, data.checkouts),
          ],
        ].map(([name, value]) => (
          <article className={styles.pilotageKpi} key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <p>
        Encaissements TTC, livraison incluse ; le panier moyen correspond au
        montant payé avant remboursements. Le taux d’abandon checkout porte sur
        les sessions créées depuis 30 jours et âgées d’au moins 24 h. Il peut
        évoluer si un client reprend sa commande. Un achat répété est identifié
        par une précédente commande payée avec la même adresse e-mail
        normalisée.
      </p>
      <p>
        <Link href="/admin/pilotage">
          Marge globale, rotation, charges et trésorerie → pilotage économique
        </Link>
      </p>
      <h2>Trafic, parcours et acquisition</h2>
      <p>
        GA4 :{' '}
        {process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
          ? 'flux configuré, collecte après consentement'
          : 'configuration requise'}
        . Les visiteurs ayant refusé ou bloqué les traceurs ne figurent pas dans
        les rapports. Les revenus GA4 sont attribués et partiels ; la base de
        commandes reste la source financière.
      </p>
      <ul>
        <li>
          <a
            href="https://analytics.google.com/analytics/web/#/a411500978p558382032/reports/intelligenthome"
            target="_blank"
            rel="noreferrer"
          >
            Google Analytics : visiteurs, canaux, parcours et conversions
          </a>
        </li>
        <li>
          <a
            href="https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Alesterresdecaldera.fr"
            target="_blank"
            rel="noreferrer"
          >
            Search Console : requêtes, clics, impressions et positions
          </a>
        </li>
        <li>
          <a
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noreferrer"
          >
            Stripe : paiements, remboursements et versements
          </a>
        </li>
      </ul>
      <p>
        Funnel instrumenté : produit vu → ajout panier → début checkout → accès
        paiement → achat confirmé. Le taux de conversion visiteurs est calculé
        dans GA4 avec les achats mesurés ÷ utilisateurs mesurés, et non avec le
        mélange des commandes totales et d’un trafic partiel. Les taux d’abandon
        du parcours se lisent dans l’exploration d’entonnoir sur une même
        cohorte.
      </p>
      <h2>Parcours & canaux consentis</h2>
      <p>
        {data.visitors} visiteurs mesurés sur 30 jours. Conversion :{' '}
        {percent(data.attributedOrders, data.visitors)} (commandes attribuées à
        ces visites ÷ visiteurs distincts consentants). Les canaux d’un même
        visiteur peuvent se recouper ; le total visiteurs est dédupliqué.
      </p>
      <div
        className={styles.tableWrapper}
        tabIndex={0}
        role="region"
        aria-label="Données de mesure"
      >
        <table className={styles.table}>
          <caption>
            Cohorte de sessions commencées sur les 30 derniers jours ·
            attribution à la session ayant préparé la commande
          </caption>
          <thead>
            <tr>
              {[
                'Canal / source',
                'Campagne',
                'Visiteurs',
                'Sessions',
                'Produit vu',
                'Ajout panier',
                'Checkout',
                'Paiement',
                'Commandes',
                'CA TTC',
                'Abandon panier',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.measurement.map((row, index) => (
              <tr key={index}>
                <td>
                  {row.channel} / {row.source}
                </td>
                <td>{row.campaign ?? '—'}</td>
                {[
                  row.visitors,
                  row.sessions,
                  row.product,
                  row.cart,
                  row.checkout,
                  row.payment,
                  row.orders,
                ].map((value, i) => (
                  <td key={i}>{String(value)}</td>
                ))}
                <td>{euros(row.revenue)}</td>
                <td>
                  {percent(Number(row.cartAbandoned), Number(row.cartMature))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Les étapes indiquent les sessions ayant atteint chaque action, sans
        imposer un ordre : ce tableau n’est pas un entonnoir séquentiel.
        L’abandon panier signifie aucune commande payée dans la session après au
        moins 24 h d’inactivité ; une reprise dans une nouvelle session peut ne
        pas être rapprochée. Les refuser ne bloque jamais l’achat. Les revenus
        non attribués restent inclus dans les encaissements globaux.
      </p>
      <h2>Performance produit</h2>
      <div
        className={styles.tableWrapper}
        tabIndex={0}
        role="region"
        aria-label="Données de mesure"
      >
        <table className={styles.table}>
          <caption>Ventes sur 30 jours, stock disponible actuel</caption>
          <thead>
            <tr>
              {[
                'Produit',
                'Unités nettes',
                'CA net estimé HT',
                'Marge brute',
                'Ventes/jour',
                'Stock',
                'Couverture stock',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.units}</td>
                <td>{euros(p.revenue)}</td>
                <td>
                  {p.knownUnits === p.units && p.units > 0
                    ? euros(p.revenue - p.cost)
                    : 'Coûts incomplets'}
                </td>
                <td>{(p.units / 30).toFixed(2)}</td>
                <td>{p.stock}</td>
                <td>
                  {p.units > 0
                    ? `${Math.round(p.stock / (p.units / 30))} jours`
                    : 'Pas de ventes'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        La marge exclut livraison, frais Stripe et charges. Les remboursements
        de lignes sont déduits ; les montants remboursés étant TTC, le CA HT et
        la marge sont estimatifs en présence de TVA et de retours.
      </p>
      <h2>Paiements Stripe enregistrés</h2>
      <ul>
        {data.payments.map((p) => (
          <li key={p.status}>
            {p.status} : {p._count} · {euros(p._sum.amount ?? '0')}
          </li>
        ))}
      </ul>
      <p>
        États des tentatives créées sur la période, synchronisés par les
        webhooks Stripe. Le solde Stripe ne représente pas la trésorerie
        bancaire.
      </p>
      <h2>Emails & campagnes</h2>
      <div
        className={styles.tableWrapper}
        tabIndex={0}
        role="region"
        aria-label="Données de mesure"
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Campagne</th>
              <th>Destinataires</th>
              <th>Envoyés (total)</th>
              <th>Suivis / délivrés (30 j)</th>
              <th>Ouverture unique</th>
              <th>Clic unique</th>
              <th>Sessions sur 30 jours</th>
              <th>Achats attribués</th>
              <th>CA attribué TTC</th>
              <th>Code d’attribution</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((c) => {
              const e = data.engagement.find(
                (r) => r.campaignId === c.id,
              )?._count;
              return (
                <tr key={c.id}>
                  <td>{c.internalName}</td>
                  <td>{c._count.deliveries}</td>
                  <td>{c.sent}</td>
                  <td>{e ? `${e._all} / ${e.deliveredAt}` : '—'}</td>
                  <td>
                    {e
                      ? `${e.openedAt} · ${percent(e.openedAt, e.deliveredAt)}`
                      : '—'}
                  </td>
                  <td>
                    {e
                      ? `${e.clickedAt} · ${percent(e.clickedAt, e.deliveredAt)}`
                      : '—'}
                  </td>
                  <td>
                    {data.measurement
                      .filter(
                        (r) =>
                          r.channel === 'newsletter' &&
                          r.campaign === `campaign_${c.id}`,
                      )
                      .reduce((n, r) => n + Number(r.sessions), 0)}
                  </td>
                  <td>
                    {data.measurement
                      .filter(
                        (r) =>
                          r.channel === 'newsletter' &&
                          r.campaign === `campaign_${c.id}`,
                      )
                      .reduce((n, r) => n + Number(r.orders), 0)}
                  </td>
                  <td>
                    {euros(
                      data.measurement
                        .filter(
                          (r) =>
                            r.channel === 'newsletter' &&
                            r.campaign === `campaign_${c.id}`,
                        )
                        .reduce((n, r) => n + Number(r.revenue), 0),
                    )}
                  </td>
                  <td>
                    <code>campaign_{c.id}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul>
        {data.lifecycle.map((r) => (
          <li key={r.kind + r.status}>
            {r.kind} · {r.status} : {r._count}
          </li>
        ))}
      </ul>
      <h3>Mesure des e-mails automatiques · 30 jours</h3>
      <ul>
        {data.lifecycleEngagement.map((r) => (
          <li key={r.kind}>
            {r.kind} : {r._count._all} suivis, {r._count.deliveredAt} délivrés ·
            ouvertures {r._count.openedAt} (
            {percent(r._count.openedAt, r._count.deliveredAt)}) · clics{' '}
            {r._count.clickedAt} (
            {percent(r._count.clickedAt, r._count.deliveredAt)})
          </li>
        ))}
      </ul>
      <p>
        {process.env.EMAIL_ENGAGEMENT_ENABLED === 'true' &&
        process.env.RESEND_WEBHOOK_SECRET
          ? 'Réception Resend configurée.'
          : 'Réception Resend à configurer.'}{' '}
        Les taux portent uniquement sur les messages commerciaux avec accord de
        suivi, parmi ceux délivrés sur 30 jours. Un message compte au maximum
        une fois par événement. « — » signifie aucune base de mesure disponible.
        Les pixels, caches et robots de messagerie peuvent fausser ouvertures et
        clics ; ils ne prouvent pas une lecture humaine.
      </p>
      <p>
        Les liens de campagne portent des UTM sans identifiant de destinataire.
        Dans GA4, filtrez « source = newsletter », « support = email » puis la
        campagne pour consulter visites, achats et revenu attribué. Les
        ouvertures et clics sont remontés par des webhooks signés, uniquement
        avec un accord de suivi distinct et encore valable. Une visite GA4 après
        clic est mesurée uniquement avec consentement.
      </p>
    </>
  );
}
