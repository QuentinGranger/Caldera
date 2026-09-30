import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NewsletterForm } from '@/components/home/Newsletter/NewsletterForm';
import styles from './FinalCall.module.scss';

/**
 * The last word of the page, over the Route des Cinq at dusk: the letter
 * that brings the Pokémon releases, and the shop when it is open.
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
          <p className={styles.eyebrow}>La lettre de Caldera</p>
          <h2 id="newsletter-title">
            Les sorties Pokémon, <em>sans avoir à les guetter.</em>
          </h2>
          <p className={styles.lead}>
            Nouvelles extensions, réassorts et sélections de la boutique, par
            e-mail.
          </p>
          {catalogue && (
            <Link href={catalogue} className={styles.catalogue}>
              Explorer la boutique <ArrowRight size={16} aria-hidden="true" />
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
