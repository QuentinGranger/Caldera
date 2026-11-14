import { type ForecastMovement, type forecastCash } from './cashForecast';

type Forecast = ReturnType<typeof forecastCash>;

export type DailyRiskMetrics = {
  date: string;
  paid_orders: number;
  product_revenue_net_ht: number | null;
  gross_margin_ht: number | null;
  margin_available: boolean;
  missing_unit_cost_lines: number;
  collected_orders_ttc: number;
};

export type AnomalySettings = {
  minimum_margin_rate_pct: number | null;
  payment_fee_rate_pct: number | null;
  payment_fixed_fee_eur: number | null;
};

export type FinancialAnomaly = {
  code: 'LOW_MARGIN' | 'MARGIN_MISSING_COST' | 'ESTIMATED_PAYMENT_FEES_HIGH' |
    'LARGE_PLANNED_EXPENSE' | 'CASH_NEGATIVE' | 'CASH_BELOW_RESERVE';
  severity: 'warning' | 'critical';
  label: string;
  explanation: string;
};

/**
 * Advisory, deterministic risk detection; never a transaction trigger.
 * No actual bank or Stripe balance-transaction fees are available in Caldera.
 */
export function detectFinancialAnomalies(input: {
  daily: DailyRiskMetrics;
  forecast: Forecast;
  settings: AnomalySettings;
  movements: ForecastMovement[];
}) {
  const { daily, forecast, settings, movements } = input;
  const anomalies: FinancialAnomaly[] = [];
  const gaps: string[] = [];
  const checked: string[] = [];

  // Only compare margin if the order-time acquisition costs and refunds are complete.
  if (daily.paid_orders === 0 && daily.product_revenue_net_ht === 0) {
    gaps.push('Pas de ventes ce jour : aucune marge journalière à contrôler.');
  } else if (
    !daily.margin_available ||
    daily.product_revenue_net_ht === null ||
    daily.gross_margin_ht === null ||
    daily.product_revenue_net_ht <= 0
  ) {
    if (daily.paid_orders > 0) {
      anomalies.push({
        code: 'MARGIN_MISSING_COST', severity: 'warning',
        label: 'Marge impossible à vérifier',
        explanation: 'Des coûts d’achat historiques ou remboursements HT manquent ; vérifier le coût des produits vendus avant toute décision.',
      });
    } else {
      gaps.push('Marge non comparable : remboursements ou base HT incomplets.');
    }
  } else if (settings.minimum_margin_rate_pct === null) {
    gaps.push('Seuil de marge minimale non configuré dans le pilotage LTC.');
  } else {
    checked.push('marge');
    const rate = daily.gross_margin_ht / daily.product_revenue_net_ht * 100;
    if (rate < settings.minimum_margin_rate_pct) {
      anomalies.push({
        code: 'LOW_MARGIN',
        severity: rate < 0 ? 'critical' : 'warning',
        label: 'Marge brute sous le seuil LTC',
        explanation: 'Marge produits HT ' + rate.toFixed(1) + ' % (minimum fixé : ' +
          settings.minimum_margin_rate_pct.toFixed(1) + ' %), sur ' +
          daily.paid_orders + ' commande(s) payée(s).',
      });
    }
  }

  // Estimated payment fees only: the Payment model has no settled Stripe fee amount.
  if (daily.paid_orders < 3 || daily.collected_orders_ttc <= 0) {
    gaps.push('Frais de paiement : volume insuffisant pour évaluer le poids estimé.');
  } else if (settings.payment_fee_rate_pct === null ||
             settings.payment_fixed_fee_eur === null) {
    gaps.push('Paramètres de frais de paiement absents.');
  } else {
    checked.push('frais_paiement_estimes');
    const estimated = daily.collected_orders_ttc * settings.payment_fee_rate_pct / 100 +
      daily.paid_orders * settings.payment_fixed_fee_eur;
    const effective = 100 * estimated / daily.collected_orders_ttc;
    const warningRate = Math.max(5, settings.payment_fee_rate_pct + 2);
    if (estimated >= 2 && effective > warningRate) {
      anomalies.push({
        code: 'ESTIMATED_PAYMENT_FEES_HIGH', severity: 'warning',
        label: 'Poids estimé des frais de paiement élevé',
        explanation: 'Frais THÉORIQUES ' + estimated.toFixed(2) + ' € soit ' +
          effective.toFixed(1) + ' % des commandes encaissées TTC (seuil de vigilance : ' +
          warningRate.toFixed(1) + ' %). Les frais réels Stripe ne sont pas synchronisés.',
      });
    }
  }
  gaps.push('Les frais Stripe réellement débités ne sont pas synchronisés : aucune anomalie de frais réels ne peut être certifiée.');

  // Known one-off outlays relative to recurring monthly expense budget.
  if (forecast.monthly_budget_eur === null || forecast.monthly_budget_eur <= 0) {
    gaps.push('Dépenses ponctuelles : budget mensuel de référence absent ou nul.');
  } else {
    checked.push('depenses_exceptionnelles_prevues');
    const boundary = forecast.horizons.find(h => h.days === 30)?.date;
    const large = movements
      .filter(m => m.kind === 'other_expense' &&
        (m.status === 'committed' || m.status === 'proposed') &&
        !!boundary && m.date <= boundary)
      .filter(m => m.amount_eur >= Math.max(100, forecast.monthly_budget_eur! * 0.75))
      .sort((a,b) => b.amount_eur - a.amount_eur)[0];
    if (large) {
      anomalies.push({
        code: 'LARGE_PLANNED_EXPENSE', severity: 'warning',
        label: 'Dépense exceptionnelle importante à vérifier',
        explanation: 'Sortie prévue : ' + large.amount_eur.toFixed(2) + ' € TTC (' +
          (large.status === 'committed' ? 'engagée' : 'envisagée') + ', échéance ' +
          large.date + '). Vérifier le budget et éviter de la compter deux fois.',
      });
    }
  }

  const available = forecast.horizons
    .filter(h => h.cash_with_proposals_eur !== null)
    .sort((a,b) => a.days - b.days);
  if (forecast.opening_cash_eur === null || available.length === 0) {
    gaps.push('Trésorerie : solde manuel de départ ou budget non renseigné. Aucune alerte de solde ne peut être conclue.');
  } else {
    checked.push('risque_tresorerie_manuelle');
    const negative = available.find(h => h.cash_with_proposals_eur! < 0);
    if (negative) {
      anomalies.push({
        code: 'CASH_NEGATIVE', severity: 'critical',
        label: 'Risque de trésorerie négative',
        explanation: 'Projection prudente à J+' + negative.days + ' : ' +
          negative.cash_with_proposals_eur!.toFixed(2) +
          ' € TTC, sur solde MANUEL non synchronisé avec la banque. Vérifier les échéances et les achats.',
      });
    } else if (forecast.reserve_target_eur !== null && forecast.reserve_target_eur > 0) {
      const reserve = available.find(h => h.cash_with_proposals_eur! < forecast.reserve_target_eur!);
      if (reserve) {
        anomalies.push({
          code: 'CASH_BELOW_RESERVE', severity: 'warning',
          label: 'Réserve de trésorerie menacée',
          explanation: 'Projection prudente à J+' + reserve.days + ' : ' +
            reserve.cash_with_proposals_eur!.toFixed(2) + ' €, sous la réserve cible de ' +
            forecast.reserve_target_eur.toFixed(2) + ' €. Solde bancaire NON synchronisé.',
        });
      }
    }
  }

  const alerts = anomalies.sort((a,b) =>
    (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
  const status = alerts.length ? 'ALERTS' : checked.length ? 'NO_ALERTS_WITH_LIMITATIONS' : 'NOT_READY';
  const message = [
    '🚨 **LTC — DÉTECTEUR D’ANOMALIES FINANCIÈRES**',
    '📅 **Contrôle :** ' + forecast.as_of + ' | Ventes analysées : ' + daily.date,
    '',
    ...alerts.map(a => (a.severity === 'critical' ? '🔴' : '🟠') +
      ' **' + a.label + '**\n' + a.explanation),
    '',
    '🔍 Contrôles actifs : ' + (checked.join(', ') || 'aucun'),
    '⚠️ **Limites :** solde de trésorerie manuel, frais Stripe réels et comptabilité non synchronisés.',
    '🔒 Alerte interne STAFF — décision humaine requise, aucune action financière automatique.',
  ].join('\n');
  return {
    status,
    alerts,
    alert_count: alerts.length,
    critical_count: alerts.filter(a => a.severity === 'critical').length,
    checked_signals: checked,
    data_gaps: gaps,
    discord_message: message,
  };
}
