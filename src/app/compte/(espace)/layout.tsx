import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/AccountNav';
import { Container } from '@/components/ui/Container/Container';
import { currentCustomer } from '@/lib/account/auth';
import styles from '@/components/account/Account.module.scss';

// Signed-in area. Each page calls requireCustomer with its own path, so a
// visitor who is not signed in comes back to the page asked for.
export default async function AccountAreaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const customer = await currentCustomer();
  if (!customer) return children;
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <div className={styles.area}>
          <AccountNav name={customer.name} email={customer.email} />
          <div className={styles.content}>{children}</div>
        </div>
      </Container>
    </main>
  );
}
