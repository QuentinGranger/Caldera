import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container/Container';
import { AccountShell } from '@/components/account/AccountShell';
import { requireCustomer } from '@/lib/auth/customer/session';
import styles from '@/components/account/Account.module.scss';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const customer = await requireCustomer();
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <AccountShell customer={customer}>{children}</AccountShell>
      </Container>
    </main>
  );
}
