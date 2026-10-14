import { formatCarnetDate, parseCarnetDate } from './dates';

/** Stable month URLs, Paris civil boundaries, bounded navigation across years. */
export function carnetMonth(raw: unknown, now = new Date()) {
  const current = formatCarnetDate(now).slice(0, 7);
  const value =
    typeof raw === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw)
      ? raw
      : current;
  const [year, month] = value.split('-').map(Number) as [number, number];
  const shift = (offset: number) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    const result = date.toISOString().slice(0, 7);
    return /^20\d{2}-/.test(result) ? result : null;
  };
  const start = parseCarnetDate(`${value}-01T00:00`, 'Mois')!;
  const end = shift(1)
    ? parseCarnetDate(`${shift(1)}-01T00:00`, 'Mois')!
    : new Date('2100-01-01T00:00:00+01:00');
  return {
    value,
    current,
    previous: shift(-1),
    next: shift(1),
    start,
    end,
    label: new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    }).format(start),
  };
}
