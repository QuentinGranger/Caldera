import Link from 'next/link';
import type { ReactNode } from 'react';
import { MailCheck } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import styles from './NewsletterPage.module.scss';

export function NewsletterPage({
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
        <section
          className={styles.card}
          aria-labelledby="newsletter-page-title"
        >
          <MailCheck size={38} strokeWidth={1.5} aria-hidden="true" />
          <p className={styles.eyebrow}>Les nouvelles de Caldera</p>
          <h1 id="newsletter-page-title">{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {children}
          <p className={styles.back}>
            <Link href="/">Retour à l’accueil</Link>
          </p>
        </section>
      </Container>
    </main>
  );
}
