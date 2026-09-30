// VAT franchise (art. 293 B du CGI), sales of goods: where the year's turnover
// stands against the thresholds. Pure module: the dashboard and the tests.
// The thresholds are settings (the law changes them); the text points to the
// accountant for any decision.

export type FranchiseLevel = 'OK' | 'NEAR' | 'BASE' | 'MAJORED';

export type FranchiseStatus = {
  level: FranchiseLevel;
  title: string;
  message: string;
};

/** Warned from 80 % of the base threshold. */
export const NEAR_RATIO = 0.8;

export function franchiseStatus({
  currentCents,
  previousCents,
  baseCents,
  majoredCents,
}: {
  currentCents: number;
  previousCents: number;
  baseCents: number;
  majoredCents: number;
}): FranchiseStatus {
  if (currentCents > majoredCents || previousCents > majoredCents)
    return {
      level: 'MAJORED',
      title: 'Seuil majoré dépassé',
      message:
        currentCents > majoredCents
          ? 'La TVA est due sur les ventes dès le jour du dépassement du seuil majoré. Passez au régime assujetti (Mentions des factures) et voyez votre expert-comptable.'
          : 'Le chiffre d’affaires de l’an dernier dépasse le seuil majoré : la franchise ne s’applique plus. Passez au régime assujetti et voyez votre expert-comptable.',
    };
  if (currentCents > baseCents || previousCents > baseCents)
    return {
      level: 'BASE',
      title: 'Seuil de base dépassé',
      message:
        'Tant que le seuil majoré n’est pas atteint, la franchise peut encore s’appliquer, au plus pour l’année qui suit le premier dépassement. Préparez le passage à la TVA avec votre expert-comptable.',
    };
  if (currentCents >= baseCents * NEAR_RATIO)
    return {
      level: 'NEAR',
      title: 'Seuil de base bientôt atteint',
      message:
        'Le chiffre d’affaires de l’année approche du seuil de la franchise. Surveillez-le et anticipez le passage à la TVA.',
    };
  return {
    level: 'OK',
    title: 'Franchise en base applicable',
    message:
      'Le chiffre d’affaires reste sous le seuil de base : aucune TVA à facturer.',
  };
}

/** Straight-line projection of the year's turnover from the days elapsed. */
export function projectYear(currentCents: number, now: Date) {
  const year = now.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  const elapsed = Math.max(1, (now.getTime() - start) / 86400000);
  return Math.round((currentCents * days) / elapsed);
}
