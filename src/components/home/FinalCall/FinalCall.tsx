import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NewsletterForm } from '@/components/home/Newsletter/NewsletterForm';
import styles from './FinalCall.module.scss';

/**
 * The last word of the page, over the Route des Cinq at dusk: the invitation
 * to come back, through the newsletter, and to the catalogue when it is open.
 */
export function FinalCall({ catalogue }: { catalogue?: string }) {
  return (
    <section
      id="newsletter"
      className={styles.section}
      aria-labelledby="newsletter-title"
    >
      <div className={styles.media} aria-hidden="true">
        <Image src="/assets/images/RouteCinq.png" alt="" fill sizes="100vw" />
      </div>
      <div className={styles.inner}>
        <div className={styles.copy} data-reveal="">
          <p className={styles.eyebrow}>Gardons le cap ensemble</p>
          <h2 id="newsletter-title">
            Votre prochaine découverte <em>commence ici.</em>
          </h2>
          <p className={styles.lead}>
            Réassorts, nouvelles extensions et sélections, directement dans
            votre boîte mail.
          </p>
          {catalogue && (
            <Link href={catalogue} className={styles.catalogue}>
              Ou parcourez le catalogue dès maintenant{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className={styles.form} data-reveal="">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
