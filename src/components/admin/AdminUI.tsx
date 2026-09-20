import Link from 'next/link';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
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
export function Badge({ value }: { value: string }) {
  const tone = ['PAYMENT_FAILED', 'FAILED', 'PAYMENT_REVIEW'].includes(value)
    ? styles.danger
    : ['ACTIVE', 'PAID', 'SUCCEEDED', 'CONSUMED', 'DELIVERED', 'SENT'].includes(
          value,
        )
      ? styles.success
      : [
            'PENDING_PAYMENT',
            'REQUIRES_PAYMENT_METHOD',
            'REQUIRES_ACTION',
            'UNFULFILLED',
            'PENDING',
          ].includes(value)
        ? styles.pending
        : [
              'PAYMENT_PROCESSING',
              'PROCESSING',
              'PREPARING',
              'READY_TO_SHIP',
              'SHIPPED',
              'SENDING',
            ].includes(value)
          ? styles.info
          : '';
  return <span className={`${styles.badge} ${tone}`}>{label(value)}</span>;
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
      <table className={styles.table}>
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
        <tbody>{children}</tbody>
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
