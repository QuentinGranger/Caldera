function buildOrderHandover(input) {
  const parsed = (value) =>
    typeof value === 'string' ? JSON.parse(value) : value;
  function write(sheetId, index, values) {
    return {
      updateCells: {
        start: { sheetId, rowIndex: index, columnIndex: 0 },
        rows: [
          {
            values: values.map((v) => ({
              userEnteredValue:
                typeof v === 'number'
                  ? { numberValue: v }
                  : { stringValue: String(v ?? '') },
            })),
          },
        ],
        fields: 'userEnteredValue',
      },
    };
  }

  const r = parsed(input.report),
    ranges = parsed(input.book).valueRanges;
  const keys = [
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
  if (
    r.schema !== 1 ||
    !Number.isFinite(Date.parse(r.asOf)) ||
    keys.some((k) => !Number.isSafeInteger(r[k]) || r[k] < 0)
  )
    throw Error('Relevé des commandes incomplet');
  const checkpoint = ranges[0].values?.[0] || [],
    last = Date.parse(checkpoint[3] || '');
  const health = !Number.isFinite(last)
    ? 'Première synchronisation en attente'
    : Date.parse(r.asOf) - last > 2 * 3600000
      ? 'Synchronisation en retard (> 2 h)'
      : checkpoint[4] === 'Oui'
        ? 'Rattrapage en cours'
        : 'À jour';
  const tasks = [];
  if (r.inconsistentPaidOrders)
    tasks.push(
      'Contrôler les commandes payées incohérentes avant préparation.',
    );
  if (r.paymentReview || r.paymentProcessing1h)
    tasks.push('Vérifier les paiements signalés.');
  if (r.refundActionRequired || r.refundPending24h)
    tasks.push('Examiner les remboursements en attente ou bloqués.');
  if (r.awaitingShipment48h)
    tasks.push('Traiter les commandes payées depuis 48 h encore à expédier.');
  if (r.readyToShip) tasks.push('Organiser la remise au transporteur.');
  if (r.toPrepare || r.preparing) tasks.push('Ouvrir la file de préparation.');
  if (r.waitingPreorder) tasks.push('Suivre les sorties des précommandes.');
  if (health !== 'À jour')
    tasks.push('Contrôler le scénario de synchronisation du registre.');
  const priority =
    r.inconsistentPaidOrders || r.refundActionRequired || r.paymentReview
      ? 'Prioritaire'
      : r.awaitingShipment48h ||
          r.refundPending24h ||
          r.paymentProcessing1h ||
          health !== 'À jour'
        ? 'À surveiller'
        : tasks.length
          ? 'Traitement courant'
          : 'Aucune action';
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(r.asOf));
  const days = (ranges[1].values || []).map((v) => v[0]);
  const existing = days.indexOf(day),
    row = existing < 0 ? days.length + 1 : existing + 1;
  const requests = [
    write(13, row, [
      day,
      priority,
      ...keys.map((k) => r[k]),
      health,
      tasks.join(' ') || 'Aucune intervention requise.',
    ]),
  ];
  if (row >= 1000 && row % 1000 === 0 && existing < 0)
    requests.unshift({
      appendDimension: { sheetId: 13, dimension: 'ROWS', length: 1000 },
    });
  return { body: JSON.stringify({ requests }), day, priority };
}
module.exports = { buildOrderHandover };
