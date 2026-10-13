import { AdminError } from '@/lib/admin/validation';
const parisFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatCarnetDate(value: Date | string | null | undefined) {
  if (!value) return '';
  return parisFormatter.format(new Date(value)).replace(' ', 'T');
}
/** Paris civil time, never the server's timezone. Reject DST gaps and ambiguous times. */
export function parseCarnetDate(value: string, label: string) {
  if (!value) return null;
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new AdminError(`${label} : date et heure invalides (2000–2099).`);
  const utc = new Date(`${value}:00Z`);
  if (
    !Number.isFinite(utc.getTime()) ||
    utc.toISOString().slice(0, 16) !== value
  )
    throw new AdminError(`${label} : date invalide.`);
  // Discover both offsets around a clock change from the runtime timezone data.
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const probe = new Date(utc.getTime() + hours * 3600000);
      return (
        new Date(`${formatCarnetDate(probe)}:00Z`).getTime() - probe.getTime()
      );
    }),
  );
  const candidates = [...offsets]
    .map((offset) => new Date(utc.getTime() - offset))
    .filter((date) => formatCarnetDate(date) === value);
  if (candidates.length !== 1)
    throw new AdminError(
      `${label} : cette heure est inexistante ou ambiguë lors du changement d’heure à Paris. Choisissez une autre heure.`,
    );
  return candidates[0];
}
export function assertCarnetCalendar(
  early: Date | null,
  publicAt: Date | null,
) {
  if (early && publicAt && publicAt <= early)
    throw new AdminError(
      'La publication publique doit être postérieure à l’accès anticipé.',
    );
}
