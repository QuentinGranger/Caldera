import Link from 'next/link';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { label } from '@/lib/admin/format';
import type { SearchParams } from '@/lib/admin/queries';
import styles from './Admin.module.scss';
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
const TONES = {
  danger: styles.danger,
  success: styles.success,
  pending: styles.pending,
  info: styles.info,
  neutral: '',
} as const;
export function Badge({
  value,
  tone: explicit,
}: {
  value: string;
  /** Overrides the colour chosen from the value. */
  tone?: keyof typeof TONES;
}) {
  if (explicit)
    return (
      <span className={`${styles.badge} ${TONES[explicit]}`}>
        {label(value)}
      </span>
    );
  const tone = ['PAYMENT_FAILED', 'FAILED', 'PAYMENT_REVIEW'].includes(value)
    ? styles.danger
    : [
          'ACTIVE',
          'PAID',
          'SUCCEEDED',
          'CONSUMED',
          'DELIVERED',
          'SENT',
          'COMPLETED',
          'PROMO_ACTIVE',
          'RETURN_STATE_REFUNDED',
        ].includes(value)
      ? styles.success
      : [
            'PENDING_PAYMENT',
            'REQUIRES_PAYMENT_METHOD',
            'REQUIRES_ACTION',
            'UNFULFILLED',
            'PENDING',
            'QUEUED',
            'RESERVED',
            'PROMO_SCHEDULED',
            'RETURN_STATE_REQUESTED',
          ].includes(value)
        ? styles.pending
        : [
              'PAYMENT_PROCESSING',
              'PROCESSING',
              'PREPARING',
              'READY_TO_SHIP',
              'SHIPPED',
              'SENDING',
              'RETURN_STATE_APPROVED',
              'RETURN_STATE_RECEIVED',
            ].includes(value)
          ? styles.info
          : '';
  return <span className={`${styles.badge} ${tone}`}>{label(value)}</span>;
}
/**
 * Gives each cell its column heading (`data-label`): on phones the rows
 * become cards and every value keeps its name, without each table having
 * to repeat its headings.
 */
function labelRows(rows: ReactNode, headings: string[]) {
  return Children.map(rows, (row) => {
    if (!isValidElement<{ children?: ReactNode }>(row) || row.type !== 'tr')
      return row;
    let column = 0;
    return cloneElement(
      row,
      {},
      Children.map(row.props.children, (cell) => {
        if (!isValidElement(cell) || (cell.type !== 'td' && cell.type !== 'th'))
          return cell;
        const heading = headings[column++];
        return heading
          ? cloneElement(cell as ReactElement<Record<string, unknown>>, {
              'data-label': heading,
            })
          : cell;
      }),
    );
  });
}
export function AdminTable({
  headings,
  children,
  caption,
}: {
  headings: string[];
  children: ReactNode;
  caption: string;
}) {
  return (
    <div
      className={styles.tableWrapper}
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className={`${styles.table} ${styles.cardTable}`}>
        <caption className={styles.visuallyHidden}>{caption}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{labelRows(children, headings)}</tbody>
      </table>
    </div>
  );
}
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.card} ${styles.emptyState}`}>
      <Inbox size={30} strokeWidth={1.5} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
export function Pagination({
  page,
  total,
  params,
  path,
}: {
  page: number;
  total: number;
  params: SearchParams;
  path: string;
}) {
  const pages = Math.max(1, Math.ceil(total / 25));
  function href(next: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (typeof value === 'string' && key !== 'page') query.set(key, value);
    query.set('page', String(next));
    return `${path}?${query}`;
  }
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span>
        {total} résultat{total > 1 ? 's' : ''} · Page {page} / {pages}
      </span>
      <div className={styles.pageLinks}>
        {page > 1 ? (
          <Link href={href(page - 1)}>
            <ChevronLeft size={14} aria-hidden="true" />
            Précédente
          </Link>
        ) : (
          <span aria-disabled="true">
            <ChevronLeft size={14} aria-hidden="true" />
            Précédente
          </span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)}>
            Suivante
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span aria-disabled="true">
            Suivante
            <ChevronRight size={14} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        <option value="">Tous</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function IntegrityWarning({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className={styles.warning}>
      {children}
    </p>
  );
}
