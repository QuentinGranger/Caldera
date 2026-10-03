import Link from 'next/link';
import type { ReactNode } from 'react';
import { BellRing } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import styles from '@/components/newsletter/NewsletterPage.module.scss';

/** Pages opened from an alert e-mail (confirmation, removal). */
export function StockAlertPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <section className={styles.card} aria-labelledby="alerte-titre">
          <BellRing size={38} strokeWidth={1.5} aria-hidden="true" />
          <p className={styles.eyebrow}>Alertes de retour en stock</p>
          <h1 id="alerte-titre">{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {children}
          <p className={styles.back}>
            <Link href="/catalogue">{ALL_PRODUCTS_LABEL}</Link>
          </p>
        </section>
      </Container>
    </main>
  );
}
