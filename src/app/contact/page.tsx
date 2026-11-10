import { Globe2, PackageSearch, Sparkles } from 'lucide-react';

import { Container } from '@/components/ui/Container/Container';
import {
  editorialDecision,
  editorialMetadata,
} from '@/components/editorial/editorial';
import { INSTAGRAM_PROFILE_URL } from '@/lib/social';
import { ContactForm } from './ContactForm';
import { DiscordInviteLink } from '@/components/discord/DiscordInviteLink';
import styles from './contact.module.scss';

export const metadata = editorialMetadata({
  title: 'Contact : commandes, produits et livraison',
  description:
    'Contactez Les Terres de Caldera pour une question sur une commande, un produit, le stock ou la livraison.',
  decision: editorialDecision('/contact'),
});

const helpCards = [
  {
    icon: PackageSearch,
    title: 'Commande',
    text: 'Indiquez votre numéro de commande si votre demande concerne un achat, un paiement, une préparation ou une expédition.',
  },
  {
    icon: Sparkles,
    title: 'Produit',
    text: 'Pour une question sur un article, précisez son nom, son extension ou son lien afin que la demande soit identifiable rapidement.',
  },
  {
    icon: Globe2,
    title: 'Site officiel',
    text: 'Le domaine officiel de la boutique est lesterresdecaldera.fr.',
  },
] as const;

export default function ContactPage() {
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <Container className={styles.heroInner}>
          <p className={styles.eyebrow}>Aide & contact</p>
          <h1>Contactez Caldera.</h1>
          <p className={styles.intro}>
            Une question sur une commande ou un produit ? Précisez votre demande
            dans le formulaire.
          </p>
        </Container>
      </section>

      <section className={styles.content}>
        <Container className={styles.grid}>
          <ContactForm />
          <aside
            className={styles.help}
            aria-label="Conseils avant de nous écrire"
          >
            <p className={styles.eyebrow}>Avant d’envoyer</p>
            <h2>Les informations qui nous aident</h2>
            <div className={styles.cards}>
              {helpCards.map(({ icon: Icon, title, text }) => (
                <article className={styles.card} key={title}>
                  <Icon size={20} aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
            <section
              className={styles.community}
              aria-labelledby="community-title"
            >
              <h3 id="community-title">Échanger avec la communauté</h3>
              <p>
                Retrouvez Caldera sur Discord pour les discussions autour du JCC
                Pokémon. Pour une commande ou des informations personnelles,
                utilisez le formulaire privé de cette page.
              </p>
              <DiscordInviteLink />
              <p>
                <a
                  href={INSTAGRAM_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivre Les Terres de Caldera sur Instagram (nouvel onglet)"
                >
                  Suivre Les Terres de Caldera sur Instagram
                </a>
              </p>
            </section>
          </aside>
        </Container>
      </section>
    </main>
  );
}
