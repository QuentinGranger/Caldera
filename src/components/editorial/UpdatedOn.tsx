import { formatDateFr } from '@/lib/seo/metadata';
import { isoDay } from './editorial';

/** « Mis à jour le 26 septembre 2026 » with a machine-readable date. */
export function UpdatedOn({
  date,
  className,
  prefix = 'Mis à jour le',
}: {
  date: Date | string;
  className?: string;
  prefix?: string;
}) {
  return (
    <p className={className}>
      {prefix} <time dateTime={isoDay(date)}>{formatDateFr(date)}</time>
    </p>
  );
}
