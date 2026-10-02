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
  const resultKnown = marginKnown && metrics.marginCoverage >= 99.9;

  return (
    <>
      <span className={styles.eyebrow}>Modèle économique & performance</span>
      <PageHeader
        title="Pilotage économique"
        description="Suivez en continu la rentabilité, le stock, les charges, la trésorerie et la capacité de réinvestissement de CALDERA."
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
            {metrics.refunded > 0 &&
              ` · remboursements : ${euros(metrics.refunded)}`}
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
              : 'Renseignez les coûts rendus pour calculer la marge.'}
          </small>
        </article>

        <article className={styles.pilotageKpi}>
          <span>
            <Banknote size={18} aria-hidden="true" />
            Résultat mensuel estimé
          </span>
          <strong>
            {resultKnown ? euros(metrics.estimatedMonthlyResult) : '—'}
          </strong>
          <small>
            {resultKnown
              ? `Marge nette estimée ${metrics.estimatedNetMarginRate.toFixed(1)} % · après frais de paiement et budgets d’exploitation`
              : 'Disponible quand les coûts rendus couvrent toutes les ventes.'}
          </small>
        </article>

        <article className={styles.pilotageKpi}>
          <span>
            <Target size={18} aria-hidden="true" />
            Seuil de rentabilité
          </span>
          <strong>
            {metrics.breakEvenRevenue === null
              ? '—'
              : euros(metrics.breakEvenRevenue)}
          </strong>
          <small>
            CA mensuel estimé nécessaire pour couvrir le budget d’exploitation.
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
            Trésorerie libre
          </span>
          <strong>{euros(metrics.cashAboveReserve)}</strong>
          <small>
            Solde {euros(metrics.cashBalance)} · réserve cible{' '}
            {euros(metrics.cashReserveTarget)}
          </small>
        </article>

        <article className={styles.pilotageKpi}>
          <span>
            <Boxes size={18} aria-hidden="true" />
            Capacité de réinvestissement
          </span>
          <strong>{euros(metrics.reinvestmentCapacity)}</strong>
          <small>
            Plafonnée par la trésorerie libre, le taux de réinvestissement et le
            budget stock restant.
          </small>
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
            Aucune référence stratégique n’est encore suivie.
          </p>
        )}
        {metrics.marginCoverage < 99.9 && metrics.revenue > 0 && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            La marge couvre {metrics.marginCoverage.toFixed(1)} % du CA seulement :
            certaines ventes n’ont pas de coût rendu historique.
          </p>
        )}
        {metrics.stockUnitsWithoutCost > 0 && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            {metrics.stockUnitsWithoutCost} unité(s) en stock n’ont pas de coût
            rendu : la valorisation du stock est donc incomplète.
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
        {metrics.reserveGap > 0 && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            Il manque {euros(metrics.reserveGap)} pour atteindre la réserve de
            trésorerie cible.
          </p>
        )}
        {resultKnown && metrics.estimatedMonthlyResult < 0 && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            Le résultat mensuel estimé est négatif de{' '}
            {euros(Math.abs(metrics.estimatedMonthlyResult))}. Réduisez les charges,
            améliorez la marge ou augmentez le volume rentable.
          </p>
        )}
        {marginKnown && metrics.breakEvenRevenue === null && (
          <p className={styles.warning}>
            <AlertTriangle size={18} aria-hidden="true" />
            Le seuil de rentabilité ne peut pas être calculé : la marge contributive
            après frais de paiement est nulle ou négative.
          </p>
        )}
      </div>

      <div className={styles.pilotageLayout}>
        <section className={styles.card}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Paramètres permanents</h2>
              <p className={styles.muted}>
                Ces paramètres servent au pilotage quotidien et mensuel. Ils ne
                modifient ni les prix ni le stock automatiquement.
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
                label="Budget maximal de stock (€)"
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
                label="Réserve de trésorerie cible (€)"
                name="cashReserveTarget"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.cashReserveTarget}
                required
              />
              <Field
                label="Taux de réinvestissement de la trésorerie libre (%)"
                name="reinvestmentRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={settings.reinvestmentRate}
                required
              />
              <Field
                label="Début du suivi de l’objectif"
                name="trackingStartDate"
                type="date"
                defaultValue={settings.trackingStartDate}
              />
            </div>

            <h3>Frais de paiement</h3>
            <div className={styles.fields}>
              <Field
                label="Frais variables (%)"
                name="paymentFeeRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={settings.paymentFeeRate}
                required
              />
              <Field
                label="Frais fixes par paiement (€)"
                name="paymentFixedFee"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.paymentFixedFee}
                required
              />
            </div>

            <h3>Budget d’exploitation mensuel</h3>
            <div className={styles.fields}>
              <Field
                label="Charges fixes (€ / mois)"
                name="monthlyFixedCosts"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.monthlyFixedCosts}
                required
              />
              <Field
                label="Cartons & consommables (€ / mois)"
                name="monthlyPackagingBudget"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.monthlyPackagingBudget}
                required
              />
              <Field
                label="Transport client à votre charge (€ / mois)"
                name="monthlyShippingBudget"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.monthlyShippingBudget}
                required
              />
              <Field
                label="Marketing (€ / mois)"
                name="monthlyMarketingBudget"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.monthlyMarketingBudget}
                required
              />
              <Field
                label="Autres charges (€ / mois)"
                name="monthlyOtherCosts"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.monthlyOtherCosts}
                required
              />
            </div>
            <p className={styles.muted}>
              Le budget stock reste séparé des charges d’exploitation. Le coût rendu
              des produits inclut uniquement achat, transport fournisseur et frais
              d’approvisionnement. Ces paramètres mesurent ce qu’il reste réellement
              après fonctionnement de la boutique.
            </p>

            <fieldset className={styles.launchProducts}>
              <legend>Références stratégiques suivies</legend>
              <p className={styles.muted}>
                Sélectionnez les références à surveiller dans la durée pour comparer
                leur CA, rotation, stock immobilisé et marge.
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
          <h2>Synthèse mensuelle</h2>
          <dl className={styles.metricList}>
            <div>
              <dt>CA mensuel observé</dt>
              <dd>{euros(metrics.monthlyRevenue)}</dd>
            </div>
            <div>
              <dt>Marge brute mensuelle</dt>
              <dd>{marginKnown ? euros(metrics.monthlyGrossMargin) : '—'}</dd>
            </div>
            <div>
              <dt>Frais de paiement estimés</dt>
              <dd>{euros(metrics.monthlyPaymentFees)}</dd>
            </div>
            <div>
              <dt>Budget d’exploitation</dt>
              <dd>{euros(metrics.monthlyOperatingBudget)}</dd>
            </div>
            <div>
              <dt>Résultat mensuel estimé</dt>
              <dd>{resultKnown ? euros(metrics.estimatedMonthlyResult) : '—'}</dd>
            </div>
            <div>
              <dt>Panier moyen encaissé</dt>
              <dd>
                {metrics.averageOrderValue === null
                  ? '—'
                  : euros(metrics.averageOrderValue)}
              </dd>
            </div>
          </dl>
          <p className={styles.pilotageNote}>
            Le rythme mensuel est calculé sur la période suivie, avec au minimum un
            mois pour éviter de surinterpréter quelques jours d’activité.
          </p>

          <h2>Comment sont calculés les chiffres ?</h2>
          <dl className={styles.metricList}>
            <div>
              <dt>CA</dt>
              <dd>Produits payés</dd>
            </div>
            <div>
              <dt>Marge brute</dt>
              <dd>(vente − coût rendu) / vente</dd>
            </div>
            <div>
              <dt>Stock immobilisé</dt>
              <dd>quantité × coût rendu</dd>
            </div>
            <div>
              <dt>Rotation 30 j</dt>
              <dd>vendus 30 j / stock actuel</dd>
            </div>
            <div>
              <dt>Résultat estimé</dt>
              <dd>marge brute − frais paiement − budget d’exploitation</dd>
            </div>
            <div>
              <dt>Réinvestissement</dt>
              <dd>trésorerie libre × taux, plafonné par le budget stock</dd>
            </div>
          </dl>
          <p className={styles.pilotageNote}>
            Le CA exclut les frais de livraison. La rotation est un indicateur
            opérationnel basé sur le stock actuel, pas une rotation comptable sur
            stock moyen. La marge est une marge commerciale simplifiée sur les prix
            enregistrés, hors charges d’exploitation et sans retraitement comptable
            de TVA. Le coût rendu correspond au coût d’achat + transport fournisseur
            par unité + autres frais d’approvisionnement. Les frais de paiement sont
            estimés à partir du taux et du montant fixe saisis ; le budget
            d’exploitation est mensuel. La trésorerie reste saisie manuellement tant
            qu’aucun compte bancaire n’est connecté.
          </p>
        </aside>
      </div>

      <section className={styles.card}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Références stratégiques</h2>
            <p className={styles.muted}>
              Performance continue des références que vous avez choisi de suivre.
            </p>
          </div>
          <span className={styles.badge}>
            {launchProducts.length} produit{launchProducts.length > 1 ? 's' : ''}
          </span>
        </div>

        {launchProducts.length ? (
          <AdminTable
            caption="Performance des références stratégiques suivies"
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
            Sélectionnez au moins un produit dans les paramètres permanents pour
            constituer votre suivi stratégique.
          </p>
        )}
      </section>
    </>
  );
}
