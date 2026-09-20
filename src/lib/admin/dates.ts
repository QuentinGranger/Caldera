export function parisDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  if (end) parsed.setUTCDate(parsed.getUTCDate() + 1);
  const utc = parsed.getTime();
  let instant = utc;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  });
  // Recompute at the target instant: the offset can change later on a DST transition day.
  for (let pass = 0; pass < 2; pass++) {
    const offset = formatter
      .formatToParts(new Date(instant))
      .find((part) => part.type === 'timeZoneName')?.value;
    const hours = Number(/^GMT([+-]\d+)$/.exec(offset ?? '')?.[1] ?? 0);
    instant = utc - hours * 3600000;
  }
  return new Date(instant);
}
