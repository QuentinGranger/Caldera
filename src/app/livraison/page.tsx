import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  Box,
  CircleCheck,
  Compass,
  Gift,
  House,
  MapPin,
  PackageCheck,
  ReceiptText,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import styles from './livraison.module.scss';

export const metadata: Metadata = {
  title: 'Livraison | Les Terres de Caldera',
  description:
    'Découvrez les modes de livraison, les délais indicatifs, la préparation et le suivi des commandes Les Terres de Caldera.',
};

const mondialRelayFeatures = [
  'Livraison avec suivi',
  'Choix du Point Relais lors de la commande',
  'Solution économique pour vos commandes',
  'Notification lorsque votre colis est disponible',
];

const colissimoFeatures = [
  'Livraison à domicile',
  'Suivi du colis',
  'Livraison partout en France métropolitaine',
];

export default function ShippingPage() {
  return (
    <main id="contenu" className={styles.main}>
      <header className={styles.hero}>
        <Container className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Du comptoir jusqu’à vous</p>
            <h1>Livraison</h1>
            <p>
              Nous préparons chaque commande avec soin afin que vos cartes,
              produits scellés et accessoires arrivent dans les meilleures
              conditions.
            </p>
          </div>
          <Route className={styles.route} aria-hidden="true" />
          <Compass className={styles.compass} aria-hidden="true" />
        </Container>
      </header>

      <Container className={styles.content}>
        <section className={styles.methods} aria-labelledby="methods-title">
          <header className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Choisir son itinéraire</p>
            <h2 id="methods-title">Modes de livraison</h2>
            <p>
              Les options effectivement disponibles pour votre adresse et votre
              commande sont toujours confirmées pendant le checkout.
            </p>
          </header>

          <div className={styles.methodGrid}>
            <article className={styles.methodCard}>
              <div className={styles.methodIcon}>
                <MapPin aria-hidden="true" />
              </div>
              <p className={styles.methodNumber}>01 · Point de retrait</p>
              <h3>Mondial Relay — Point Relais®</h3>
              <p>
                Faites livrer votre commande dans le Point Relais® de votre
                choix.
              </p>
              <ul>
                {mondialRelayFeatures.map((feature) => (
                  <li key={feature}>
                    <CircleCheck aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className={styles.delay}>
                Délai indicatif : <strong>3 à 5 jours ouvrés</strong> après
                expédition.
              </p>
            </article>

            <article className={styles.methodCard}>
              <div className={styles.methodIcon}>
                <House aria-hidden="true" />
              </div>
              <p className={styles.methodNumber}>02 · À domicile</p>
              <h3>Colissimo — Livraison à domicile</h3>
              <p>
                Recevez directement votre commande à l’adresse indiquée lors de
                votre achat.
              </p>
              <ul>
                {colissimoFeatures.map((feature) => (
                  <li key={feature}>
                    <CircleCheck aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className={styles.delay}>
                Délai indicatif : <strong>2 à 3 jours ouvrés</strong> après
                expédition.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.journey} aria-labelledby="journey-title">
          <header className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Le voyage de votre commande</p>
            <h2 id="journey-title">Préparation et suivi</h2>
          </header>

          <div className={styles.journeyGrid}>
            <article>
              <span>01</span>
              <PackageCheck aria-hidden="true" />
              <h3>Préparation des commandes</h3>
              <p>
                Les commandes sont préparées avec soin avant leur remise au
                transporteur.
              </p>
              <p>
                Les cartes à l’unité sont protégées de manière adaptée afin de
                limiter les risques de pliure ou de détérioration pendant le
                transport.
              </p>
              <p>
                Les produits scellés sont emballés dans des colis adaptés à leur
                taille et protégés contre les chocs.
              </p>
            </article>

            <article>
              <span>02</span>
              <Route aria-hidden="true" />
              <h3>Suivi de votre commande</h3>
              <p>
                Dès l’expédition de votre commande, vous recevez un e-mail
                contenant votre numéro de suivi.
              </p>
              <p>
                Vous pouvez également retrouver le statut de votre commande
                depuis votre espace client.
              </p>
            </article>

            <article>
              <span>03</span>
              <Box aria-hidden="true" />
              <h3>Réception</h3>
              <p>
                À la réception, vérifiez l’état extérieur du colis avant son
                ouverture et conservez les éléments utiles en cas d’anomalie.
              </p>
            </article>
          </div>
        </section>

        <div className={styles.infoGrid}>
          <section className={styles.infoCard} aria-labelledby="fees-title">
            <ReceiptText aria-hidden="true" />
            <p className={styles.eyebrow}>Un montant clair</p>
            <h2 id="fees-title">Frais de livraison</h2>
            <p>
              Les frais de livraison sont calculés automatiquement lors de la
              commande selon :
            </p>
            <ul>
              <li>le mode de livraison choisi ;</li>
              <li>le poids et le volume de la commande ;</li>
              <li>la destination.</li>
            </ul>
            <strong>Le montant exact est affiché avant le paiement.</strong>
          </section>

          <section className={styles.infoCard} aria-labelledby="free-title">
            <Gift aria-hidden="true" />
            <p className={styles.eyebrow}>Une étape offerte</p>
            <h2 id="free-title">Livraison offerte</h2>
            <p>
              Lorsque la livraison gratuite est proposée, le montant minimum
              nécessaire est indiqué directement dans votre panier.
            </p>
          </section>
        </div>

        <section className={styles.issue} aria-labelledby="issue-title">
          <div className={styles.issueIcon}>
            <ShieldCheck aria-hidden="true" />
          </div>
          <div>
            <p className={styles.eyebrow}>Un imprévu sur la route</p>
            <h2 id="issue-title">Colis endommagé ou problème de livraison</h2>
            <p>
              Si votre colis arrive visiblement endommagé, nous vous
              recommandons de prendre des photos du colis avant son ouverture
              ainsi que des éventuels produits endommagés.
            </p>
            <p>
              En cas de problème avec votre livraison, contactez-nous en
              indiquant votre numéro de commande afin que nous puissions
              examiner la situation.
            </p>
            <Link href="/faq#reception-colis">
              Consulter les réponses sur la réception
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className={styles.zone} aria-labelledby="zone-title">
          <MapPin aria-hidden="true" />
          <div>
            <p className={styles.eyebrow}>Territoire desservi</p>
            <h2 id="zone-title">France métropolitaine</h2>
            <p>
              Les Terres de Caldera livre actuellement en France métropolitaine.
              De nouvelles destinations pourront être ajoutées progressivement.
            </p>
          </div>
          <Link href="/catalogue">
            Explorer la boutique
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>
      </Container>
    </main>
  );
}
