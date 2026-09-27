import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container/Container';
import styles from './Account.module.scss';

/** Narrow page of the account area: sign-in, sign-up and e-mail links. */
export function AccountShell({
  title,
  lead,
  notice,
  children,
}: {
  title: string;
  lead: string;
  notice?: string | null;
  children: ReactNode;
}) {
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <div className={styles.narrow}>
          <p className={styles.eyebrow}>Mon compte</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {notice && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
          {children}
        </div>
      </Container>
    </main>
  );
}
