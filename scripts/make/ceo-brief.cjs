// Upload this function as the Code module of CALDERA CEO, returning buildCeoBrief(input).
function buildCeoBrief(input, now = new Date()) {
  const zone = 'Europe/Paris';
  const localDate = (date) => {
    const entries = new Intl.DateTimeFormat('fr-FR', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type) => entries.find((entry) => entry.type === type).value;
    return [get('year'), get('month'), get('day')].join('-');
  };
  const date = localDate(now);
  const yesterday = new Date(date + 'T00:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const salesDate = yesterday.toISOString().slice(0, 10);
  const generatedAt = now.toISOString();
  const shortDate = (value) => value.split('-').reverse().join('/');
  const object = (value) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  };
  const list = (value) => {
    const entries = object(value);
    return Array.isArray(entries)
      ? entries.filter((entry) => entry && typeof entry === 'object')
      : [];
  };
  const number = (value) =>
    (typeof value === 'number' ||
      (typeof value === 'string' && value.trim() !== '')) &&
    Number.isFinite(Number(value))
      ? Number(value)
      : null;
  const n = (value) => number(value) ?? 0;
  const money = (value) =>
    number(value) === null
      ? 'non dispo.'
      : new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 2,
        }).format(number(value));
  const age = (stamp) => {
    const t = Date.parse(stamp);
    return Number.isFinite(t) && t <= now.getTime() + 5 * 60_000
      ? (now.getTime() - t) / 86_400_000
      : Infinity;
  };
  const edition = (value) =>
    list(value).find((row) => row.date === date) ?? null;
  const current = (rows, kind, maxAge) =>
    list(rows)
      .filter((row) => row.kind === kind && age(row.generatedAt) <= maxAge)
      .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
      .map((row) => object(row.payload))
      .find((report) => report?.schema === 1) ?? null;
  const literal = (text, max) =>
    String(text ?? '')
      .replace(/[<>@*_~`|\[\]\r\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  const missing = [];
  const urgencies = [];
  const daily = object(input.finance);
  const finance =
    daily?.sales_source_connected === true && daily.date === salesDate
      ? daily
      : null;
  const anomaly = edition(input.anomalies);
  const forecast = edition(input.forecast);
  const ops = object(input.orders);
  const orderKeys = [
    'toPrepare',
    'preparing',
    'readyToShip',
    'waitingPreorder',
    'awaitingShipment48h',
    'paymentReview',
    'paymentProcessing1h',
    'inconsistentPaidOrders',
    'refundActionRequired',
    'refundPending24h',
  ];
  const orders =
    ops?.schema === 1 &&
    age(ops.asOf) < 0.1 &&
    orderKeys.every((key) => Number.isInteger(ops[key]))
      ? ops
      : null;

  if (!orders && !finance)
    urgencies.push(
      'Données Caldera indisponibles pour les commandes et les ventes. Vérifier l’accès à la base de la boutique.',
    );

  if (orders) {
    if (
      orders.paymentReview ||
      orders.inconsistentPaidOrders ||
      orders.paymentProcessing1h
    )
      urgencies.push(
        'Paiements : ' +
          orders.paymentReview +
          ' à vérifier, ' +
          orders.inconsistentPaidOrders +
          ' commandes incohérentes, ' +
          orders.paymentProcessing1h +
          ' en traitement depuis ≥ 1 h.',
      );
    if (orders.awaitingShipment48h)
      urgencies.push(
        'Expédier : ' +
          orders.awaitingShipment48h +
          ' commande(s) payée(s) depuis ≥ 48 h.',
      );
    if (orders.refundActionRequired || orders.refundPending24h)
      urgencies.push(
        'Remboursements : ' +
          orders.refundActionRequired +
          ' action(s) requise(s), ' +
          orders.refundPending24h +
          ' en attente depuis ≥ 24 h.',
      );
  } else missing.push('commandes');

  if (n(anomaly?.critical_count))
    urgencies.push(
      'Finance : ' +
        n(anomaly.critical_count) +
        ' alerte(s) critique(s) à vérifier dans le rapport financier.',
    );
  if (!anomaly?.status || anomaly.status === 'NOT_READY')
    missing.push('contrôle financier incomplet');
  if (!forecast?.status) missing.push('projection du jour');
  if (!finance) missing.push('ventes de la veille');

  const thresholds = current(input.inventory, 'thresholds', 1.5);
  const counts = current(input.inventory, 'counts', 1.5);
  const dormant = current(input.inventory, 'dormant', 9);
  if (!thresholds || !counts || !dormant) missing.push('stocks partiels');
  const zeroStock = list(thresholds?.alerts).filter(
    (row) => row.reason === 'rupture',
  );
  const blocked = list(counts?.proposals).filter(
    (row) => row.blockedByReservations === true,
  );
  if (zeroStock.length)
    urgencies.push(
      'Stock : rupture signalée (' +
        zeroStock
          .slice(0, 2)
          .map((row) => literal(row.sku, 24))
          .join(', ') +
        ').',
    );
  if (blocked.length)
    urgencies.push(
      'Inventaire : écart sous les réservations, correction bloquée (' +
        literal(blocked[0].sku, 24) +
        ').',
    );

  const watch = current(input.procurement, 'watch', 1.5);
  const comparison = current(input.procurement, 'comparison', 1.5);
  const drafts = current(input.procurement, 'drafts', 9);
  if (!watch || !comparison || !drafts) missing.push('achats partiels');
  const review = current(input.strategy, 'review', 40);
  const categories = current(input.strategy, 'categories', 40);
  const market = current(input.strategy, 'competition', 3);
  if (!review || !categories || !market) missing.push('stratégie partielle');

  const financeSales = finance
    ? n(finance.paid_orders) +
      ' payée(s) · CA produits net HT ' +
      money(finance.product_revenue_net_ht) +
      ' · remboursements TTC ' +
      money(finance.refunded_total_ttc) +
      (finance.margin_available === true
        ? ' · marge brute HT ' + money(finance.gross_margin_ht)
        : '')
    : 'données de vente indisponibles';
  const manualCash =
    number(forecast?.cash_start_eur) ??
    number(finance?.cash_balance_manual_eur);
  const cash =
    manualCash === null
      ? 'Trésorerie bancaire non connectée ; base manuelle indisponible.'
      : 'Trésorerie manuelle ' +
        money(manualCash) +
        (number(forecast?.conservative_30_eur) === null
          ? '.'
          : ' · projection prudente J+30 ' +
            money(forecast.conservative_30_eur) +
            '.');
  const alertLine =
    n(anomaly?.alert_count) && !n(anomaly?.critical_count)
      ? ' · ' + n(anomaly.alert_count) + ' signal(aux) financier(s) à examiner'
      : '';
  const stockText =
    thresholds?.status === 'aucun_produit'
      ? 'aucun produit réel'
      : [
          thresholds && n(thresholds.total) + ' seuil(s) atteint(s)',
          counts && n(counts.total) + ' écart(s) à valider',
          dormant && n(dormant.total) + ' dormant(s)',
        ]
          .filter(Boolean)
          .join(' · ') || 'indisponible';
  const buyText =
    watch?.status === 'aucun_fournisseur'
      ? 'aucun fournisseur'
      : [
          watch && n(watch.changeCount) + ' changement(s)',
          comparison && n(comparison.comparisonCount) + ' comparaison(s)',
          drafts &&
            drafts.status !== 'aucun_fournisseur' &&
            list(drafts.templates).length + ' brouillon(s)',
        ]
          .filter(Boolean)
          .join(' · ') || 'indisponible';
  const businessText =
    [
      review && 'revue ' + literal(review.period, 12),
      categories &&
        list(categories.categories).length + ' catégorie(s) analysée(s)',
      market && n(market.changeCount) + ' changement(s) concurrentiels',
    ]
      .filter(Boolean)
      .join(' · ') || 'données récentes indisponibles';
  const proposed = list(review?.priorities).find((entry) => entry.title)?.title;
  const decisive = urgencies.length
    ? 'Traiter d’abord le premier point ci-dessus.'
    : orders && orders.toPrepare
      ? 'Préparer les commandes déjà payées.'
      : proposed
        ? 'À examiner : ' + literal(proposed, 96) + '.'
        : 'Aucune décision immédiate identifiée.';
  const sections = [
    '**Briefing CEO · Caldera · ' + shortDate(date) + '**',
    '**Urgences** — ' +
      (urgencies.length
        ? '\n• ' +
          urgencies.slice(0, 5).join('\n• ') +
          (urgencies.length > 5
            ? '\n• Voir aussi les autres signaux dans les rapports sources.'
            : '')
        : orders && anomaly?.status && anomaly.status !== 'NOT_READY'
          ? 'aucune urgence détectée.'
          : 'aucune urgence détectée dans les sources disponibles ; vérification partielle.'),
    '**Commandes** — ' +
      (orders
        ? orders.toPrepare +
          ' à préparer · ' +
          orders.preparing +
          ' en préparation · ' +
          orders.readyToShip +
          ' prêtes à expédier' +
          (orders.waitingPreorder
            ? ' · ' + orders.waitingPreorder + ' en attente de précommande'
            : '')
        : 'état indisponible') +
      '.',
    '**Finance · ' +
      shortDate(salesDate) +
      '** — ' +
      financeSales +
      '.\n' +
      cash +
      alertLine,
    '**Stocks** — ' +
      stockText +
      '.\n**Achats** — ' +
      buyText +
      '.\n**Stratégie** — ' +
      businessText +
      '.',
    '**Priorité du jour** — ' + decisive,
    ...(missing.length
      ? ['Sources à compléter : ' + missing.join(' · ') + '.']
      : []),
    '[Commandes](<https://lesterresdecaldera.fr/admin/commandes>) · [Stocks](<https://lesterresdecaldera.fr/admin/stocks/inventaire?vue=alertes>) · [Pilotage](<https://lesterresdecaldera.fr/admin/pilotage>)',
  ];
  const status = urgencies.length
    ? 'urgence'
    : missing.length
      ? 'partiel'
      : 'complet';
  const message = sections.join('\n\n');
  // Discord allows at most 2,000 characters. The archive keeps the full text.
  const content =
    message.length <= 1950 ? message : message.slice(0, 1947) + '…';
  const digest = {
    schema: 1,
    date,
    salesDate,
    status,
    urgencies,
    missing,
    message,
  };
  return {
    date,
    archiveKey: 'daily:' + date.slice(-2),
    generatedAt,
    status,
    content,
    payload: JSON.stringify(digest),
  };
}

module.exports = { buildCeoBrief };
