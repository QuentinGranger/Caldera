import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsletterForm } from '@/components/home/Newsletter/NewsletterForm';
import { DiscordInviteLink } from '@/components/discord/DiscordInviteLink';
import { Container } from '@/components/ui/Container/Container';
import { getUpdateLinks } from '@/lib/community/updates';
import styles from './updates.module.scss';
import { newsletterCopy } from '@/lib/newsletter/copy';

const preparing =
  process.env.CATALOG_DEMO_MODE === '1' || process.env.STORE_OPEN !== '1';
const copy = newsletterCopy(preparing);

export const metadata: Metadata = {
  title: copy.title,
  description: copy.lead,
};

export default async function UpdatesPage() {
  const links = await getUpdateLinks();
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <header className={styles.header}>
          <p>RESTER INFORMÉ</p>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
        </header>
        <div className={styles.grid}>
          <section className={styles.panel} aria-labelledby="letter-title">
            <h2 id="letter-title">La lettre de Caldera</h2>
            <NewsletterForm preparing={preparing} />
          </section>
          <div className={styles.channels}>
            <section className={styles.panel} aria-labelledby="discord-title">
              <h2 id="discord-title">Échanger sur Discord</h2>
              <p>
                Rejoignez le serveur officiel pour discuter du JCC Pokémon et
                suivre les annonces de Caldera. Vous gardez la main sur vos
                notifications dans Discord.
              </p>
              <DiscordInviteLink />
            </section>
            {links.length > 0 && (
              <section className={styles.panel} aria-labelledby="updates-title">
                <h2 id="updates-title">Consulter, sans s’inscrire</h2>
                <nav aria-label="Nouveautés, réassorts et sorties">
                  {links.map((link) => (
                    <Link key={link.href} href={link.href}>
                      {link.label} →
                    </Link>
                  ))}
                </nav>
                <p>
                  Le calendrier indique les dates publiées ; il ne garantit pas
                  une disponibilité en boutique.
                </p>
              </section>
            )}
            {!preparing && (
              <section className={styles.panel} aria-labelledby="alert-title">
                <h2 id="alert-title">Vous attendez un produit précis ?</h2>
                <p>
                  Sur la fiche d’une version épuisée, choisissez « M’avertir du
                  retour en stock ». Un seul e-mail vous prévient de son retour,
                  sans inscription à la newsletter.
                </p>
              </section>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
