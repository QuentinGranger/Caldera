import Link from 'next/link';
import { AlertTriangle, Banknote, Boxes, Gauge, Percent, Target } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Field } from '@/components/admin/AdminFields';
import { AdminTable, PageHeader } from '@/components/admin/AdminUI';
import { saveBusinessPilotageAction } from '@/lib/admin/actions';
import { euros, label } from '@/lib/admin/format';
import { getBusinessPilotage } from '@/lib/admin/pilotage';
import styles from '@/components/admin/Admin.module.scss';

function metricPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)} %`;
}

export default async function PilotagePage() {
  const { settings, metrics, productOptions, launchProducts } =
    await getBusinessPilotage();
  const launchIds = new Set(settings.launchProductIds);
  const targetProgress = Math.min(100, Math.max(0, metrics.targetProgress));
  const budgetProgress = Math.min(100, Math.max(0, metrics.stockBudgetUsage));
  const marginKnown = metrics.coveredRevenue > 0;

  return (
    <>
      <span className={styles.eyebrow}>Modèle économique & performance</span>
      <PageHeader
        title="Pilotage économique"
        description="Fixez les règles de CALDERA puis comparez-les aux ventes et au stock réels."
      />

      <section className={styles.pilotageKpis} aria-label="Indicateurs économiques">
        <article className={styles.pilotageKpi}>
          <span>
            <Target size={18} aria-hidden="true" />
            CA produits encaissé
          </span>
          <strong>{euros(metrics.revenue)}</strong>
          <small>
            Objectif {euros(metrics.revenueTarget)} · {metrics.targetProgress.toFixed(1)} %
          </small>
          <progress
            value={targetProgress}
            max={100}
            aria-label="Progression vers l’objectif de chiffre d’affaires"
          />
        </article>

        <article className={styles.pilotageKpi}>
          <span>
            <Percent size={18} aria-hidden="true" />
            Marge brute
          </span>
          <strong>{marginKnown ? metricPercent(metrics.grossMarginRate) : '—'}</strong>
          <small>
            {marginKnown
              ? `${euros(metrics.grossMarginAmount)} · seuil ${metrics.minimumMarginRate.toFixed(1)} %`
              : 'Renseignez les coûts d’achat pour calculer la marge.'}
          </small>
        </article>

        <article className={styles.pilotageKpi}>
          <span>
            <Boxes size={18} aria-hidden="true" />
            Stock immobilisé
          </span>
          <strong>{euros(metrics.stockValue)}</strong>
          <small>
            Budget {euros(metrics.stockBudget)} · {metrics.stockBudgetUsage.toFixed(1)} %
          </small>
          <progress
            value={budgetProgress}
            max={100}
            aria-label="Part du budget maximal immobilisée en stock"
          />
        </article>

        <article className={styles.pilotageKpi}>
          <span>
            <Banknote size={18} aria-hidden="true" />
            Trésorerie
          </span>
          <strong>{euros(metrics.cashBalance)}</strong>
          <small>Solde disponible saisi manuellement.</small>
        </article>

        <article className={styles.pilotageKpi}>
          <span>
            <Gauge size={18} aria-hidden="true" />
            Rotation 30 jours
          </span>
          <strong>
            {metrics.rotation30d === null
              ? '—'
              : `${metrics.rotation30d.toFixed(2)}×`}
          </strong>
          <small>
            {metrics.soldUnits30} unité(s) vendue(s) · {metrics.stockUnits} en stock
            {metrics.stockDays !== null
              ? ` · ~${Math.round(metrics.stockDays)} j de stock`
              : ''}
          </small>
        </article>
      </section>

      <div className={styles.pilotageAlerts}>
        {settings.launchProductIds.length === 0 && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            Aucun produit de lancement n’est encore défini.
          </p>
        )}
        {metrics.marginCoverage < 99.9 && metrics.revenue > 0 && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            La marge couvre {metrics.marginCoverage.toFixed(1)} % du CA seulement :
            certaines ventes n’ont pas de coût d’achat historique.
          </p>
        )}
        {metrics.stockUnitsWithoutCost > 0 && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            {metrics.stockUnitsWithoutCost} unité(s) en stock n’ont pas de coût
            d’achat : la valorisation du stock est donc incomplète.
          </p>
        )}
        {marginKnown && metrics.grossMarginRate < metrics.minimumMarginRate && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            La marge brute connue ({metrics.grossMarginRate.toFixed(1)} %) est sous
            votre seuil de {metrics.minimumMarginRate.toFixed(1)} %.
          </p>
        )}
        {metrics.stockBudget > 0 && metrics.stockValue > metrics.stockBudget && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            Le stock valorisé dépasse le budget maximal de{' '}
            {euros(metrics.stockValue - metrics.stockBudget)}.
          </p>
        )}
      </div>

      <div className={styles.pilotageLayout}>
        <section className={styles.card}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Modèle cible</h2>
              <p className={styles.muted}>
                Ces paramètres servent de garde-fous, ils ne modifient ni les prix ni
                le stock automatiquement.
              </p>
            </div>
          </div>

          <AdminForm action={saveBusinessPilotageAction} submit="Enregistrer le modèle">
            <div className={styles.fields}>
              <Field
                label="Objectif de CA (€)"
                name="revenueTarget"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={settings.revenueTarget}
                required
              />
              <Field
                label="Marge minimale acceptée (%)"
                name="minimumMarginRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={settings.minimumMarginRate}
                required
              />
              <Field
                label="Budget maximal immobilisé en stock (€)"
                name="maxStockBudget"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.maxStockBudget}
                required
              />
              <Field
                label="Trésorerie disponible (€)"
                name="cashBalance"
                type="number"
                step="0.01"
                defaultValue={settings.cashBalance}
                required
              />
              <Field
                label="Début du suivi de l’objectif"
                name="trackingStartDate"
                type="date"
                defaultValue={settings.trackingStartDate}
              />
            </div>

            <fieldset className={styles.launchProducts}>
              <legend>Produits vendus au lancement</legend>
              <p className={styles.muted}>
                Sélectionnez les références exactes. Vous pourrez les modifier sans
                toucher au catalogue.
              </p>
              {productOptions.length ? (
                <div className={styles.launchProductGrid}>
                  {productOptions.map((product) => (
                    <label key={product.id} className={styles.launchProductOption}>
                      <input
                        type="checkbox"
                        name="launchProductId"
                        value={product.id}
                        defaultChecked={launchIds.has(product.id)}
                      />
                      <span>
                        <strong>{product.name}</strong>
                        <small>
                          {label(product.productType)} · {label(product.status)}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.muted}>
                  Créez d’abord vos produits dans le catalogue admin.
                </p>
              )}
            </fieldset>
          </AdminForm>
        </section>

        <aside className={styles.card}>
          <h2>Comment sont calculés les chiffres ?</h2>
          <dl className={styles.metricList}>
            <div>
              <dt>CA</dt>
              <dd>Produits payés</dd>
            </div>
            <div>
              <dt>Marge brute</dt>
              <dd>(vente − coût) / vente</dd>
            </div>
            <div>
              <dt>Stock immobilisé</dt>
              <dd>quantité × coût d’achat</dd>
            </div>
            <div>
              <dt>Rotation 30 j</dt>
              <dd>vendus 30 j / stock actuel</dd>
            </div>
            <div>
              <dt>Trésorerie</dt>
              <dd>Saisie manuelle</dd>
            </div>
          </dl>
          <p className={styles.pilotageNote}>
            Le CA exclut les frais de livraison. La rotation est un indicateur
            opérationnel basé sur le stock actuel, pas une rotation comptable sur
            stock moyen. La marge est une marge commerciale simplifiée sur les prix
            enregistrés, avant frais Stripe, transport, TVA et autres charges. La
            trésorerie reste manuelle tant qu’aucun compte bancaire n’est connecté.
          </p>
        </aside>
      </div>

      <section className={styles.card}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Plan de lancement</h2>
            <p className={styles.muted}>
              Performance des références que vous avez explicitement retenues pour le
              lancement.
            </p>
          </div>
          <span className={styles.badge}>
            {launchProducts.length} produit{launchProducts.length > 1 ? 's' : ''}
          </span>
        </div>

        {launchProducts.length ? (
          <AdminTable
            caption="Performance des produits du lancement"
            headings={['Produit', 'CA', 'Vendus', 'Stock', 'Valeur stock', 'Marge']}
          >
            {launchProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link href={`/admin/produits/${product.id}`}>
                    <strong>{product.name}</strong>
                  </Link>
                  <small className={styles.tableSubline}>
                    {label(product.productType)}
                  </small>
                </td>
                <td>{euros(product.revenue)}</td>
                <td>{product.soldUnits}</td>
                <td>{product.stockUnits}</td>
                <td>{euros(product.stockValue)}</td>
                <td>
                  {product.marginRate === null
                    ? '—'
                    : `${product.marginRate.toFixed(1)} %`}
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <p className={styles.muted}>
            Sélectionnez au moins un produit dans le modèle cible pour constituer le
            plan de lancement.
          </p>
        )}
      </section>
    </>
  );
}
