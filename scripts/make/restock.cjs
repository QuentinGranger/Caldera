// The Make Code module receives a saved register and one operation.
// The caller persists the returned register only after validation succeeds.
function manageRestock(input, now = new Date()) {
  const parse = (value) =>
    typeof value === 'string' ? JSON.parse(value) : value;
  const ledger = structuredClone(parse(input.ledger));
  if (
    ledger?.schema !== 1 ||
    !Array.isArray(ledger.cases) ||
    !Number.isInteger(ledger.cycle)
  )
    throw Error('Registre de réassort invalide.');
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  const iso = now.toISOString();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const buying = (c) => ['Commandé', 'Partiellement reçu'].includes(c.stage);
  function log(c, event, at, detail = '') {
    c.version++;
    c.history.push({ at, event, detail });
    if (c.history.length > 25) c.history.shift();
  }
  function proposal(c) {
    if (
      c.signal === 'Normal' ||
      c.discrepancy ||
      c.leadTimeDays === null ||
      !c.unitsSold28d ||
      c.unseen
    )
      return null;
    // The effective threshold already covers supplier lead time.
    return Math.max(
      0,
      c.threshold +
        Math.ceil(c.unitsSold28d / 4) -
        c.available -
        (buying(c) ? c.ordered - c.received : 0),
    );
  }
  function open(c, at) {
    c.stage = 'À étudier';
    c.approved = 0;
    c.ordered = 0;
    c.received = 0;
    c.po = '';
    c.due = '';
    c.closedAt = null;
    log(c, 'Ouverture du dossier', at);
  }
  function close(c, at) {
    c.stage = 'Clos';
    c.closedAt = at;
    log(c, 'Clôture sur stock constaté au-dessus du seuil', at);
  }
  const action = input.action;
  let focus;
  let message = '';
  if (action === 'synchroniser') {
    const page = parse(input.page);
    if (
      page?.schema !== 1 ||
      page.scope !== 'reassort' ||
      !Array.isArray(page.variants) ||
      page.variants.length > 250 ||
      typeof page.after !== 'string' ||
      typeof page.next !== 'string' ||
      (page.next && !uuid.test(page.next)) ||
      !Number.isFinite(Date.parse(page.generatedAt)) ||
      Date.parse(page.generatedAt) > now.getTime() + 300000
    )
      throw Error('Page de stock invalide.');
    if (
      page.generatedAt === ledger.lastPageAt &&
      page.after === ledger.lastAfter
    )
      message = 'Page déjà enregistrée.';
    else {
      if (
        page.after !== ledger.after ||
        (ledger.lastPageAt &&
          Date.parse(page.generatedAt) <= Date.parse(ledger.lastPageAt))
      )
        throw Error('Page périmée. Relire le curseur du registre.');
      if (
        page.next &&
        (page.next <= page.after || page.variants.some((x) => x.id > page.next))
      )
        throw Error('Curseur de stock incohérent.');
      const seen = new Set();
      const byId = new Map(ledger.cases.map((c) => [c.id, c]));
      for (const v of page.variants) {
        if (
          !uuid.test(v.id) ||
          v.id <= page.after ||
          seen.has(v.id) ||
          typeof v.sku !== 'string' ||
          !v.sku ||
          typeof v.name !== 'string' ||
          ![v.available, v.reserved, v.threshold, v.unitsSold28d].every(
            (n) => Number.isSafeInteger(n) && n >= 0,
          ) ||
          !(
            v.leadTimeDays === null ||
            (Number.isInteger(v.leadTimeDays) && v.leadTimeDays > 0)
          ) ||
          typeof v.discrepancy !== 'boolean'
        )
          throw Error('Observation de stock invalide.');
        seen.add(v.id);
        const signal =
          v.available === 0
            ? 'Rupture'
            : v.available <= v.threshold
              ? 'Seuil atteint'
              : 'Normal';
        let c = byId.get(v.id);
        if (!c && signal === 'Normal') continue;
        if (!c) {
          c = {
            id: v.id,
            version: 0,
            history: [],
            signal: null,
            stage: 'Clos',
          };
          ledger.cases.push(c);
          byId.set(c.id, c);
        }
        const previous = c.signal;
        const changed =
          c.available !== v.available ||
          c.threshold !== v.threshold ||
          c.discrepancy !== v.discrepancy ||
          c.leadTimeDays !== v.leadTimeDays ||
          c.unitsSold28d !== v.unitsSold28d ||
          c.unseen;
        const verifiedLater =
          c.stage === 'Réception à vérifier' &&
          Date.parse(page.generatedAt) > Date.parse(c.lastReceiptAt);
        Object.assign(c, v, {
          signal,
          seenCycle: ledger.cycle,
          observedAt: page.generatedAt,
          unseen: false,
        });
        if (signal !== 'Normal' && (c.stage === 'Clos' || verifiedLater))
          open(c, page.generatedAt);
        if (previous !== signal)
          log(
            c,
            signal,
            page.generatedAt,
            v.available + ' disponible(s), seuil ' + v.threshold,
          );
        else if (changed) c.version++;
        if (
          signal === 'Normal' &&
          (['À étudier', 'Validé'].includes(c.stage) || verifiedLater)
        )
          close(c, page.generatedAt);
      }
      ledger.lastAfter = page.after;
      ledger.lastPageAt = page.generatedAt;
      ledger.after = page.next;
      if (!page.next) {
        for (const c of ledger.cases)
          if (c.seenCycle !== ledger.cycle && !c.unseen && c.stage !== 'Clos') {
            c.unseen = true;
            log(c, 'Référence absente du relevé complet', page.generatedAt);
          }
        ledger.completedAt = page.generatedAt;
        ledger.cycle++;
        ledger.cases = ledger.cases.filter(
          (c) =>
            c.stage !== 'Clos' ||
            now.getTime() - Date.parse(c.closedAt) < 90 * 86400000,
        );
      }
      message =
        page.variants.length +
        ' référence(s) observée(s). ' +
        (page.next
          ? 'Suite du catalogue au prochain passage.'
          : 'Tour du catalogue terminé.');
    }
  } else if (action !== 'consulter') {
    const c = ledger.cases.find((c) => c.id === input.dossier);
    if (!c)
      throw Error(
        'Dossier introuvable. Consulter le registre pour obtenir son identifiant.',
      );
    focus = c;
    const version = Number(input.version);
    const quantity = Number(input.quantite);
    const po = String(input.reference || '').trim();
    const due = String(input.echeance || '').trim();
    const reason = String(input.motif || '').trim();
    const signature = JSON.stringify([
      action,
      version,
      quantity,
      po,
      due,
      reason,
    ]);
    if (c.lastCommand === signature) message = 'Action déjà enregistrée.';
    else {
      if (!Number.isSafeInteger(version) || version !== c.version)
        throw Error(
          'Le dossier a changé. Relire sa version avant de confirmer.',
        );
      if (
        action !== 'annuler' &&
        (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000)
      )
        throw Error('Quantité entière positive requise.');
      if (action === 'valider' || action === 'commander') {
        if (
          c.unseen ||
          c.discrepancy ||
          c.signal === 'Normal' ||
          now.getTime() - Date.parse(c.observedAt) > 86400000
        )
          throw Error('Vérifier le stock et le comptage avant de poursuivre.');
      }
      if (action === 'valider' && c.stage === 'À étudier') {
        c.stage = 'Validé';
        c.approved = quantity;
        log(c, 'Quantité validée', iso, String(quantity));
      } else if (action === 'commander' && c.stage === 'Validé') {
        if (
          quantity > c.approved ||
          !po ||
          po.length > 100 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
          !Number.isFinite(Date.parse(due)) ||
          new Date(due).toISOString().slice(0, 10) !== due
        )
          throw Error(
            'Quantité supérieure à la validation, référence ou date prévue invalide.',
          );
        c.stage = 'Commandé';
        c.ordered = quantity;
        c.po = po;
        c.due = due;
        log(
          c,
          'Commande fournisseur enregistrée',
          iso,
          po + ' · ' + quantity + ' unité(s) · ' + due,
        );
      } else if (action === 'recevoir' && buying(c)) {
        if (quantity <= c.received || quantity > c.ordered)
          throw Error(
            'Indiquer le cumul reçu, supérieur au précédent et limité à la commande.',
          );
        c.received = quantity;
        c.lastReceiptAt = iso;
        c.stage =
          quantity === c.ordered
            ? 'Réception à vérifier'
            : 'Partiellement reçu';
        log(c, c.stage, iso, quantity + '/' + c.ordered + ' reçu(s) · ' + c.po);
      } else if (action === 'annuler' && (buying(c) || c.stage === 'Validé')) {
        if (!reason || reason.length > 250)
          throw Error('Motif d’annulation requis (250 caractères maximum).');
        log(
          c,
          'Annulation du solde',
          iso,
          [c.po, c.received + '/' + c.ordered + ' reçu(s)', reason]
            .filter(Boolean)
            .join(' · '),
        );
        open(c, iso);
        if (c.signal === 'Normal' && !c.unseen) close(c, iso);
      } else throw Error('Action incompatible avec l’étape du dossier.');
      c.lastCommand = signature;
      message = c.sku + ' · ' + c.stage;
    }
  }
  function view(c) {
    const remaining = buying(c) ? c.ordered - c.received : 0;
    const late = remaining > 0 && c.due < today;
    const next = buying(c)
      ? late
        ? 'Relancer le fournisseur'
        : 'Suivre la livraison'
      : c.stage === 'Réception à vérifier'
        ? 'Vérifier l’entrée en stock dans Caldera'
        : c.stage === 'Clos'
          ? 'Dossier clos'
          : c.unseen
            ? 'Vérifier si la référence est toujours suivie'
            : c.discrepancy
              ? 'Recompter avant validation'
              : c.stage === 'Validé'
                ? 'Enregistrer la commande fournisseur'
                : c.leadTimeDays === null
                  ? 'Confirmer le délai fournisseur'
                  : !c.unitsSold28d
                    ? 'Évaluer la demande avant achat'
                    : 'Valider une quantité';
    return {
      dossier: c.id,
      sku: c.sku,
      produit: c.name,
      version: c.version,
      stock: c.unseen ? 'Non observé' : c.signal,
      etape: c.stage,
      disponible: c.available,
      reserve: c.reserved,
      seuil: c.threshold,
      proposition: proposal(c),
      valide: c.approved,
      commande: c.ordered,
      recu: c.received,
      reste: remaining,
      reference: c.po,
      echeance: c.due,
      retard: late,
      action: next,
      observeLe: c.observedAt,
      absentDuReleve: c.unseen,
    };
  }
  if (input.dossier && action === 'consulter') {
    focus = ledger.cases.find(
      (c) => c.id === input.dossier || c.sku === input.dossier,
    );
    if (!focus) throw Error('Référence introuvable.');
  }
  const active = ledger.cases.filter((c) => c.stage !== 'Clos').map(view);
  active.sort(
    (a, b) =>
      Number(b.retard) - Number(a.retard) ||
      Number(b.stock === 'Rupture') - Number(a.stock === 'Rupture') ||
      a.sku.localeCompare(b.sku),
  );
  const offset = Number(input.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw Error('Position de lecture invalide.');
  const selected = focus ? [view(focus)] : active.slice(offset, offset + 25);
  const rupture = active.filter(
    (c) => c.stock === 'Rupture' && !c.absentDuReleve,
  ).length;
  const late = active.filter((c) => c.retard).length;
  const freshness = !ledger.completedAt
    ? 'Premier tour du catalogue en attente'
    : now.getTime() - Date.parse(ledger.completedAt) > 86400000
      ? 'Relevé complet ancien (> 24 h)'
      : 'Dernier tour complet : ' + ledger.completedAt;
  const summary = [
    message,
    active.length +
      ' dossier(s) ouvert(s), ' +
      rupture +
      ' rupture(s), ' +
      late +
      ' livraison(s) en retard.',
    freshness,
    ...selected
      .slice(0, 5)
      .map((c) =>
        [
          c.sku,
          c.stock,
          c.etape,
          c.absentDuReleve
            ? 'Dernier disponible constaté : ' + c.disponible
            : c.disponible + ' disponible(s) / seuil ' + c.seuil,
          c.reste
            ? c.reste + ' à recevoir au ' + c.echeance
            : c.proposition
              ? c.proposition + ' unité(s) proposées'
              : '',
          c.action,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    focus ? 'Dossier ' + focus.id + ' · version ' + focus.version : '',
  ]
    .filter(Boolean)
    .join('\n');
  const payload = JSON.stringify(ledger);
  if (new TextEncoder().encode(payload).length > 650000)
    throw Error(
      'Capacité du registre atteinte. Archiver ou migrer le registre avant de reprendre.',
    );
  return {
    payload,
    summary,
    details: JSON.stringify({
      total: active.length,
      suite: !focus && offset + 25 < active.length ? offset + 25 : null,
      dossiers: selected,
      historique: focus?.history,
    }),
    cursor: ledger.after || 'START',
    at: iso,
  };
}
module.exports = { manageRestock };
