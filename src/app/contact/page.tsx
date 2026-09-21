import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe2, PackageSearch, Sparkles } from 'lucide-react';

import { Container } from '@/components/ui/Container/Container';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
import { ContactForm } from './ContactForm';
import styles from './contact.module.scss';

export const metadata: Metadata = {
  title: 'Contact | Les Terres de Caldera',
  description:
    'Contactez Les Terres de Caldera pour une question sur une commande, un produit, une précommande ou la livraison.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact | Les Terres de Caldera',
    description:
      'Une question sur votre commande ou sur la boutique Les Terres de Caldera ? Contactez-nous depuis le formulaire dédié.',
    url: '/contact',
    type: 'website',
    locale: 'fr_FR',
  },
};

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
          <h1>Une question sur votre commande ou sur Caldera&nbsp;?</h1>
          <p className={styles.intro}>
            Utilisez le formulaire ci-dessous en donnant le maximum
            d’informations utiles. Nous évitons ainsi les échanges inutiles et
            pouvons identifier plus facilement votre demande.
          </p>
          <Link className={styles.domain} href={PRODUCTION_SITE_URL}>
            <Globe2 size={16} aria-hidden="true" />
            {PRODUCTION_HOST}
          </Link>
        </Container>
      </section>

      <section className={styles.content}>
        <Container className={styles.grid}>
          <aside className={styles.help} aria-label="Conseils avant de nous écrire">
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
          </aside>

          <ContactForm />
        </Container>
      </section>
    </main>
  );
}
