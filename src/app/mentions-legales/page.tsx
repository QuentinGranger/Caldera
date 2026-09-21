import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Container } from '@/components/ui/Container/Container';
import { PRODUCTION_SITE_URL } from '@/lib/site';
import styles from '../cgv/cgv.module.scss';

export const metadata: Metadata = {
  title: 'Mentions légales | Les Terres de Caldera',
  description:
    'Consultez les mentions légales de la boutique Les Terres de Caldera éditée par CALDERA.',
  alternates: { canonical: '/mentions-legales' },
  openGraph: {
    title: 'Mentions légales | Les Terres de Caldera',
    description:
      'Informations légales relatives à CALDERA et au site Les Terres de Caldera.',
    url: '/mentions-legales',
    type: 'website',
    locale: 'fr_FR',
  },
};

const sections = [
  ['section-1', '1. Éditeur du site'],
  ['section-2', '2. Directeur de la publication'],
  ['section-3', '3. Hébergement'],
  ['section-4', '4. Activité du site'],
  ['section-5', '5. Propriété intellectuelle de CALDERA'],
  ['section-6', '6. Pokémon et droits de tiers'],
  ['section-7', '7. Données personnelles'],
  ['section-8', '8. Paiements'],
  ['section-9', '9. Hébergement, base de données et prestataires techniques'],
  ['section-10', '10. Mesure d’audience'],
  ['section-11', '11. Responsabilité'],
  ['section-12', '12. Liens externes'],
  ['section-13', '13. Médiation de la consommation'],
  ['section-14', '14. Réclamations'],
  ['section-15', '15. Droit applicable'],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.article}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function MentionsLegalesPage() {
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <Container className={styles.heroInner}>
          <p className={styles.eyebrow}>Informations légales</p>
          <h1>Mentions légales</h1>
          <p className={styles.brand}>Les Terres de Caldera — CALDERA</p>
          <p className={styles.version}>Dernière mise à jour : 21 septembre 2026</p>
        </Container>
      </section>

      <section className={styles.content}>
        <Container className={styles.layout}>
          <nav
            className={styles.summary}
            aria-label="Sommaire des mentions légales"
          >
            <p className={styles.summaryTitle}>Sommaire</p>
            <ol>
              {sections.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.document}>
            <Section id="section-1" title="1. Éditeur du site">
              <p>
                Le présent site, accessible à l’adresse{' '}
                <a href={PRODUCTION_SITE_URL}>https://lesterresdecaldera.fr</a>,
                est édité par la société CALDERA.
              </p>

              <address className={styles.address}>
                <strong>CALDERA</strong>
                <br />
                Société par actions simplifiée unipersonnelle (SASU)
                <br />
                Capital social : <strong>100 €</strong>
                <br />
                <br />
                Siège social :
                <br />
                <strong>74 rue Pierre Valdo</strong>
                <br />
                <strong>69005 Lyon — France</strong>
                <br />
                <br />
                Société en cours d’immatriculation au{' '}
                <strong>Registre du commerce et des sociétés de Lyon</strong> et
                au <strong>Registre national des entreprises</strong>.
                <br />
                <br />
                SIREN : <strong>à compléter après immatriculation</strong>
                <br />
                SIRET : <strong>à compléter après immatriculation</strong>
                <br />
                <br />
                Président : <strong>Quentin SAVIGNY</strong>
                <br />
                <br />
                Adresse e-mail :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
                <br />
                Téléphone : <a href="tel:+33671638306">06 71 63 83 06</a>
              </address>

              <p>
                CALDERA bénéficie, sous réserve du maintien des conditions légales
                applicables, du régime de franchise en base de TVA.
              </p>
              <p>
                <strong>
                  TVA non applicable, article 293 B du Code général des impôts.
                </strong>
              </p>
            </Section>

            <Section id="section-2" title="2. Directeur de la publication">
              <p>Le directeur de la publication est :</p>
              <p>
                <strong>Quentin SAVIGNY</strong>, en qualité de Président de
                CALDERA.
              </p>
              <p>
                Contact :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
              </p>
            </Section>

            <Section id="section-3" title="3. Hébergement">
              <p>Le site est hébergé par :</p>
              <address className={styles.address}>
                <strong>Vercel Inc.</strong>
                <br />
                440 N Barranca Avenue #4133
                <br />
                Covina, CA 91723
                <br />
                États-Unis
                <br />
                <br />
                Téléphone : <a href="tel:+15592887060">+1 559 288 7060</a>
              </address>
              <p>
                Le nom de domaine <strong>lesterresdecaldera.fr</strong> est
                enregistré auprès d’<strong>OVHcloud</strong>.
              </p>
            </Section>

            <Section id="section-4" title="4. Activité du site">
              <p>
                Les Terres de Caldera est une boutique en ligne spécialisée
                notamment dans la vente aux particuliers de :
              </p>
              <ul>
                <li>cartes Pokémon à l’unité ;</li>
                <li>produits Pokémon JCC scellés ;</li>
                <li>accessoires destinés aux jeux de cartes à collectionner.</li>
              </ul>
              <p>
                Les ventes sont régies par les{' '}
                <Link href="/cgv">Conditions Générales de Vente</Link> disponibles
                sur le site.
              </p>
              <p>CALDERA exerce son activité de manière indépendante.</p>
            </Section>

            <Section
              id="section-5"
              title="5. Propriété intellectuelle de CALDERA"
            >
              <p>
                La structure du site ainsi que les éléments propres à{' '}
                <strong>CALDERA / Les Terres de Caldera</strong>, notamment :
              </p>
              <ul>
                <li>le nom et l’identité de marque ;</li>
                <li>les logos ;</li>
                <li>l’identité graphique ;</li>
                <li>l’univers graphique et narratif ;</li>
                <li>les textes ;</li>
                <li>photographies et visuels originaux ;</li>
                <li>illustrations ;</li>
                <li>créations graphiques ;</li>
                <li>éléments d’interface ;</li>
                <li>contenus éditoriaux ;</li>
                <li>
                  et plus généralement toute création originale appartenant à
                  CALDERA,
                </li>
              </ul>
              <p>
                sont protégés par les dispositions applicables en matière de
                propriété intellectuelle.
              </p>
              <p>
                Toute reproduction, représentation, adaptation, extraction,
                diffusion ou réutilisation, totale ou partielle, de ces éléments
                est interdite sans l’autorisation préalable de CALDERA, sauf dans
                les cas expressément autorisés par la loi.
              </p>
              <p>
                Toute utilisation non autorisée est susceptible de constituer une
                atteinte aux droits de propriété intellectuelle de leurs
                titulaires.
              </p>
            </Section>

            <Section id="section-6" title="6. Pokémon et droits de tiers">
              <p>
                <strong>Pokémon</strong>, ainsi que les noms, personnages,
                illustrations, logos, marques, produits et autres éléments
                associés à l’univers Pokémon, appartiennent à leurs propriétaires
                et ayants droit respectifs.
              </p>
              <p>Les Terres de Caldera est une boutique indépendante.</p>
              <p>
                Sauf indication expresse contraire,{' '}
                <strong>
                  CALDERA / Les Terres de Caldera n’est ni affiliée, ni sponsorisée,
                  ni administrée par The Pokémon Company, Nintendo, Game Freak ou
                  Creatures Inc.
                </strong>
              </p>
              <p>
                La présence de marques, photographies ou références à des produits
                de tiers sur le site est réalisée uniquement dans le cadre de la
                présentation et de la commercialisation licite des produits
                concernés.
              </p>
            </Section>

            <Section id="section-7" title="7. Données personnelles">
              <p>
                CALDERA peut être amenée à collecter et traiter des données
                personnelles dans le cadre notamment :
              </p>
              <ul>
                <li>de la création et de la gestion des comptes clients ;</li>
                <li>de la gestion des commandes ;</li>
                <li>des paiements ;</li>
                <li>de la livraison ;</li>
                <li>du service client ;</li>
                <li>des demandes adressées via le formulaire de contact ;</li>
                <li>de la newsletter ;</li>
                <li>de la sécurité du site et de la prévention de la fraude.</li>
              </ul>
              <p>
                Les informations détaillées concernant les traitements réalisés,
                leurs finalités, leurs bases juridiques, leurs durées de
                conservation, les destinataires des données et les droits des
                personnes concernées figurent dans la{' '}
                <strong>Politique de confidentialité</strong> du site.
              </p>
              <p>
                CALDERA n’a pas désigné de délégué à la protection des données à ce
                jour.
              </p>
              <p>
                Toute demande relative à l’exercice des droits en matière de
                données personnelles peut être adressée à :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
              </p>
              <p>
                Les personnes concernées disposent également, dans les conditions
                prévues par la réglementation applicable, du droit d’introduire
                une réclamation auprès de la{' '}
                <strong>
                  Commission nationale de l’informatique et des libertés (CNIL)
                </strong>
                .
              </p>
            </Section>

            <Section id="section-8" title="8. Paiements">
              <p>
                Les paiements réalisés sur le site sont traités par{' '}
                <strong>Stripe et ses partenaires de paiement</strong>.
              </p>
              <p>
                Selon les moyens activés et l’éligibilité du client, le site peut
                notamment proposer :
              </p>
              <ul>
                <li>carte bancaire ;</li>
                <li>Apple Pay ;</li>
                <li>Google Pay ;</li>
                <li>PayPal ;</li>
                <li>Klarna.</li>
              </ul>
              <p>
                CALDERA ne stocke pas directement les numéros complets de cartes
                bancaires.
              </p>
              <p>
                Les traitements réalisés par les prestataires de paiement sont
                soumis à leurs propres conditions et politiques de confidentialité.
              </p>
            </Section>

            <Section
              id="section-9"
              title="9. Hébergement, base de données et prestataires techniques"
            >
              <p>
                Dans le cadre du fonctionnement de la boutique, CALDERA peut
                notamment recourir aux prestataires suivants :
              </p>
              <p>
                <strong>Vercel</strong>
                <br />
                Hébergement, déploiement et mesure d’audience du site.
              </p>
              <p>
                <strong>Supabase</strong>
                <br />
                Infrastructure de base de données et fonctionnalités liées aux
                comptes clients.
              </p>
              <p>
                <strong>Stripe et ses partenaires</strong>
                <br />
                Paiement et prévention de la fraude.
              </p>
              <p>
                <strong>Resend</strong>
                <br />
                Envoi des e-mails transactionnels et de la newsletter.
              </p>
              <p>
                <strong>Mondial Relay</strong>
                <br />
                Acheminement des commandes en Point Relais.
              </p>
              <p>
                <strong>La Poste / Colissimo</strong>
                <br />
                Acheminement des commandes à domicile lorsque ce mode de livraison
                est proposé.
              </p>
              <p>
                <strong>OVHcloud</strong>
                <br />
                Gestion du nom de domaine et, le cas échéant, de services de
                messagerie professionnelle.
              </p>
            </Section>

            <Section id="section-10" title="10. Mesure d’audience">
              <p>
                Le site peut utiliser <strong>Vercel Web Analytics</strong> afin
                d’obtenir des statistiques relatives notamment à la fréquentation
                et à l’utilisation du site.
              </p>
              <p>
                CALDERA utilise également <strong>Google Search Console</strong>{' '}
                afin de suivre l’indexation du site et ses performances dans les
                résultats du moteur de recherche Google.
              </p>
              <p>
                Aucun pixel publicitaire de type Meta Pixel, TikTok Pixel ou Google
                Ads n’est prévu au lancement du site.
              </p>
              <p>
                Les conditions relatives aux traceurs et technologies similaires
                sont détaillées dans la{' '}
                <strong>Politique de confidentialité et relative aux cookies</strong>.
              </p>
            </Section>

            <Section id="section-11" title="11. Responsabilité">
              <p>
                CALDERA s’efforce d’assurer l’exactitude et la mise à jour des
                informations diffusées sur le site.
              </p>
              <p>
                Certaines informations peuvent toutefois être modifiées à tout
                moment, notamment les prix, stocks, disponibilités et
                caractéristiques des produits.
              </p>
              <p>
                Les informations contractuelles applicables à une commande sont
                celles présentées au client au moment de la validation de celle-ci,
                dans les conditions prévues par les{' '}
                <Link href="/cgv">Conditions Générales de Vente</Link>.
              </p>
              <p>
                CALDERA ne saurait être tenue responsable des interruptions ou
                dysfonctionnements du site résultant notamment d’opérations de
                maintenance, de problèmes techniques ou d’événements indépendants
                de sa volonté, sans préjudice des droits impératifs dont bénéficie
                le consommateur.
              </p>
            </Section>

            <Section id="section-12" title="12. Liens externes">
              <p>
                Le site peut contenir des liens vers des sites ou services
                exploités par des tiers.
              </p>
              <p>
                CALDERA n’exerce aucun contrôle général sur les contenus, pratiques
                ou politiques de ces sites tiers et ne saurait être tenue
                responsable de leur contenu lorsque cette responsabilité ne lui
                incombe pas légalement.
              </p>
            </Section>

            <Section id="section-13" title="13. Médiation de la consommation">
              <p>
                Conformément aux dispositions applicables au règlement amiable des
                litiges de consommation, le consommateur pourra saisir gratuitement
                le médiateur de la consommation dont relève CALDERA après avoir
                adressé une réclamation écrite préalable à la société.
              </p>
              <div className={styles.warning}>
                <p>
                  <strong>
                    Médiateur de la consommation : à désigner avant l’ouverture
                    commerciale du site.
                  </strong>
                </p>
                <p>
                  <strong>Nom :</strong> [À COMPLÉTER]
                </p>
                <p>
                  <strong>Adresse :</strong> [À COMPLÉTER]
                </p>
                <p>
                  <strong>Site internet :</strong> [À COMPLÉTER]
                </p>
              </div>
              <p>
                Les modalités détaillées figurent également dans les{' '}
                <Link href="/cgv">Conditions Générales de Vente</Link>.
              </p>
            </Section>

            <Section id="section-14" title="14. Réclamations">
              <p>
                Pour toute question ou réclamation concernant le site ou une
                commande, le client peut contacter CALDERA :
              </p>
              <p>
                <strong>Par e-mail :</strong>{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
              </p>
              <p>
                <strong>Via le formulaire de contact :</strong>{' '}
                <Link href="/contact">disponible sur le site</Link>
              </p>
              <p>
                <strong>Par téléphone :</strong>{' '}
                <a href="tel:+33671638306">06 71 63 83 06</a>
              </p>
              <address className={styles.address}>
                <strong>Par courrier :</strong>
                <br />
                <br />
                CALDERA
                <br />
                74 rue Pierre Valdo
                <br />
                69005 Lyon
                <br />
                France
              </address>
              <p>
                Pour faciliter le traitement d’une réclamation relative à une
                commande, le client est invité à indiquer son nom, son numéro de
                commande, une description du problème et toute pièce justificative
                utile.
              </p>
            </Section>

            <Section id="section-15" title="15. Droit applicable">
              <p>
                Le présent site et les relations juridiques liées à son utilisation
                sont régis par le droit français, sous réserve des dispositions
                impératives plus protectrices éventuellement applicables au
                consommateur.
              </p>
              <p>
                Les ventes réalisées sur le site sont régies par les{' '}
                <Link href="/cgv">Conditions Générales de Vente</Link> de CALDERA.
              </p>
            </Section>
          </div>
        </Container>
      </section>
    </main>
  );
}
