import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NewsletterForm } from '@/components/home/Newsletter/NewsletterForm';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import { DiscordInviteLink } from '@/components/discord/DiscordInviteLink';
import { getUpdateLinks } from '@/lib/community/updates';
import styles from './FinalCall.module.scss';
import { newsletterCopy } from '@/lib/newsletter/copy';

/**
 * The last word of the page, over the Route des Cinq at dusk: the letter
 * that brings the Pokémon releases, and the shop when it is open.
 */
export async function FinalCall({ catalogue }: { catalogue?: string }) {
  const links = await getUpdateLinks();
  const preparing =
    process.env.CATALOG_DEMO_MODE === '1' || process.env.STORE_OPEN !== '1';
  const copy = newsletterCopy(preparing);
  return (
    <section
      id="newsletter"
      data-scroll-scene="outro"
      className={styles.section}
      aria-labelledby="newsletter-title"
    >
      <div
        className={styles.media}
        aria-hidden="true"
        data-journey-landscape
        data-depth-landscape
      >
        <Image src="/assets/images/RouteCinq.png" alt="" fill sizes="100vw" />
      </div>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>La lettre de Caldera</p>
          <h2 id="newsletter-title">
            {copy.headingStart} <em>{copy.headingEnd}</em>
          </h2>
          <p className={styles.lead}>{copy.lead}</p>
          {links.length > 0 && (
            <nav
              className={styles.updates}
              aria-label="Suivre les nouveautés de Caldera"
            >
              {links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
          {catalogue && (
            <Link href={catalogue} className={styles.catalogue}>
              {ALL_PRODUCTS_LABEL} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
          <div className={styles.community}>
            <h3>La communauté Caldera</h3>
            <p>
              Échangez autour du JCC Pokémon, partagez vos pulls et discutez de
              vos decks sur notre serveur officiel.
            </p>
            <DiscordInviteLink className={styles.catalogue} />
          </div>
        </div>
        <div className={styles.form}>
          <NewsletterForm preparing={preparing} />
        </div>
      </div>
    </section>
  );
}
