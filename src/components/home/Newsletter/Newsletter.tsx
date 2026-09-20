import { Compass } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { NewsletterForm } from './NewsletterForm';
import styles from './Newsletter.module.scss';
export function Newsletter() {
  return (
    <section
      id="newsletter"
      className={styles.section}
      aria-labelledby="newsletter-title"
    >
      <Container className={styles.grid}>
        <div>
          <p className={styles.eyebrow}>Gardons le cap ensemble</p>
          <h2 id="newsletter-title">Les nouvelles de Caldera</h2>
          <p className={styles.description}>
            Réassorts, nouvelles extensions et sélections
            <br />
            directement dans votre boîte mail.
          </p>
        </div>
        <NewsletterForm />
        <Compass
          className={styles.compass}
          size={260}
          strokeWidth={0.5}
          aria-hidden="true"
        />
      </Container>
    </section>
  );
}
