import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Admin.module.scss';

/** Native disclosures keep reports usable before hydration and with the keyboard. */
export function AdminReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.reportSection}>
      <summary>
        <h2>
          {title}
          <small>{description}</small>
        </h2>
        <ChevronDown size={20} aria-hidden="true" />
      </summary>
      <div className={styles.reportBody}>{children}</div>
    </details>
  );
}
