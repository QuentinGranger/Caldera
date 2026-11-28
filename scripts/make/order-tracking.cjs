function buildOrderTrackingBatch(input) {
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

  const page = parsed(input.page),
    ranges = parsed(input.book).valueRanges;
  const [cursor, nextLine, capacity] = ranges[0].values[0];
  let journal = Number(nextLine) - 1;
  if (
    page.schema !== 1 ||
    page.after !== cursor ||
    !Array.isArray(page.events) ||
    page.events.length > 100 ||
    typeof page.hasMore !== 'boolean' ||
    !Number.isSafeInteger(journal) ||
    journal < 1 ||
    !Number.isSafeInteger(Number(capacity)) ||
    Number(capacity) < 1000
  )
    throw Error('Position du journal incohérente');
  const statuses = {
    PENDING_PAYMENT: 'En attente de paiement',
    PAYMENT_PROCESSING: 'Paiement en cours',
    PAID: 'Payée',
    PAYMENT_FAILED: 'Échec de paiement',
    PAYMENT_REVIEW: 'Paiement à vérifier',
    CANCELLED: 'Annulée',
    EXPIRED: 'Expirée',
  };
  const stages = {
    UNFULFILLED: 'Non préparée',
    PREPARING: 'En préparation',
    READY_TO_SHIP: 'Prête à expédier',
    SHIPPED: 'Expédiée',
    DELIVERED: 'Livrée',
  };
  const events = {
    BASELINE: 'Reprise initiale',
    CREATED: 'Création',
    CHANGED: 'Changement de statut',
  };
  const lineByRef = new Map();
  for (const [i, row] of (ranges[1].values || []).entries()) {
    if (!row[0] || lineByRef.has(row[0]))
      throw Error('Référence vide ou dupliquée dans Commandes');
    const version = ranges[2].values?.[i]?.[0];
    if (!/^\d+$/.test(version)) throw Error('Version de commande manquante');
    lineByRef.set(row[0], { line: i + 1, version: BigInt(version) });
  }
  const req = [],
    latest = new Map();
  const shortDate = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'short',
    timeStyle: 'medium',
  });
  let last = cursor;
  const pair = (s) => {
    if (!/^\d+:\d+$/.test(s)) throw Error('Curseur invalide');
    return s.split(':').map(BigInt);
  };
  for (const e of page.events) {
    const [x, id] = pair(e.cursor),
      [oldX, oldId] = pair(last);
    if (
      x < oldX ||
      (x === oldX && id <= oldId) ||
      !events[e.kind] ||
      !statuses[e.status] ||
      !stages[e.fulfillment] ||
      !e.reference ||
      !Number.isFinite(Date.parse(e.at))
    )
      throw Error('Événement invalide ou désordonné');
    const at = shortDate.format(new Date(e.at)),
      s = statuses[e.status],
      f = stages[e.fulfillment];
    const oldS = statuses[e.previousStatus] || '',
      oldF = stages[e.previousFulfillment] || '';
    req.push(
      write(12, journal++, [
        e.reference,
        events[e.kind],
        at,
        oldS,
        s,
        oldF,
        f,
        e.cursor,
      ]),
    );
    const record = lineByRef.get(e.reference) || {
      line: lineByRef.size + 1,
      version: 0n,
    };
    if (id > record.version) {
      record.version = id;
      lineByRef.set(e.reference, record);
      const action =
        e.status === 'PAID'
          ? {
              UNFULFILLED: 'Vérifier la file de préparation',
              PREPARING: 'Terminer le prélèvement',
              READY_TO_SHIP: 'Vérifier la remise au transporteur',
              SHIPPED: 'Suivre la livraison',
              DELIVERED: 'Aucune action logistique',
            }[e.fulfillment]
          : {
              PAYMENT_REVIEW: 'Vérifier le paiement dans Caldera',
              PAYMENT_PROCESSING: 'Attendre la confirmation du paiement',
              PENDING_PAYMENT: 'Attendre le paiement',
              PAYMENT_FAILED: 'Consulter le détail du paiement',
              EXPIRED: 'Dossier expiré',
              CANCELLED: 'Dossier clôturé',
            }[e.status];
      latest.set(
        e.reference,
        write(1752596731, record.line, [
          e.reference,
          s,
          f,
          at,
          events[e.kind],
          [oldS, oldF].filter(Boolean).join(' · '),
          action,
          String(id),
        ]),
      );
    }
    last = e.cursor;
  }
  req.push(...latest.values());
  const cap = Number(capacity),
    needed = Math.max(journal, lineByRef.size + 1);
  const newCap = Math.max(cap, Math.ceil(needed / 1000) * 1000);
  if (newCap > cap)
    for (const sheetId of [12, 1752596731])
      req.unshift({
        appendDimension: { sheetId, dimension: 'ROWS', length: newCap - cap },
      });
  req.push(
    write(14, 1, [
      last,
      journal + 1,
      newCap,
      page.asOf,
      page.hasMore ? 'Oui' : 'Non',
    ]),
  );
  return {
    body: JSON.stringify({ requests: req }),
    processed: page.events.length,
    more: page.hasMore,
  };
}
module.exports = { buildOrderTrackingBatch };
