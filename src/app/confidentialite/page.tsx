import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Container } from '@/components/ui/Container/Container';
import { PRODUCTION_SITE_URL } from '@/lib/site';
import styles from '../cgv/cgv.module.scss';

export const metadata: Metadata = {
  title: 'Politique de confidentialité | Les Terres de Caldera',
  description:
    'Découvrez comment CALDERA collecte, utilise, conserve et protège les données personnelles sur Les Terres de Caldera.',
  alternates: { canonical: '/confidentialite' },
  openGraph: {
    title: 'Politique de confidentialité | Les Terres de Caldera',
    description:
      'Politique de confidentialité et informations relatives aux données personnelles de CALDERA.',
    url: '/confidentialite',
    type: 'website',
    locale: 'fr_FR',
  },
};

const sections = [
  ['section-1', '1. Responsable du traitement'],
  ['section-2', '2. Données personnelles collectées'],
  ['section-3', '3. Finalités et bases juridiques'],
  ['section-4', '4. Newsletter et communications commerciales'],
  ['section-5', '5. Destinataires et prestataires'],
  ['section-6', '6. Transferts hors EEE'],
  ['section-7', '7. Durées de conservation'],
  ['section-8', '8. Vercel Web Analytics'],
  ['section-9', '9. Cookies et traceurs nécessaires'],
  ['section-10', '10. Sécurité'],
  ['section-11', '11. Droits des personnes'],
  ['section-12', '12. Exercice des droits'],
  ['section-13', '13. Réclamation auprès de la CNIL'],
  ['section-14', '14. Données relatives aux mineurs'],
  ['section-15', '15. Absence de décision exclusivement automatisée'],
  ['section-16', '16. Modification de la politique'],
  ['section-17', '17. Contact'],
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

export default function ConfidentialitePage() {
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <Container className={styles.heroInner}>
          <p className={styles.eyebrow}>Vie privée & données</p>
          <h1>Politique de confidentialité</h1>
          <p className={styles.brand}>Les Terres de Caldera — CALDERA</p>
          <p className={styles.version}>Dernière mise à jour : 21 septembre 2026</p>
        </Container>
      </section>

      <section className={styles.content}>
        <Container className={styles.layout}>
          <nav
            className={styles.summary}
            aria-label="Sommaire de la politique de confidentialité"
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
            <section className={styles.article}>
              <p>
                La présente politique de confidentialité explique comment{' '}
                <strong>CALDERA</strong>, exploitant du site{' '}
                <strong>Les Terres de Caldera</strong>, collecte, utilise, conserve
                et protège les données personnelles des utilisateurs et clients du
                site accessible à l’adresse :
              </p>
              <p>
                <a href={PRODUCTION_SITE_URL}>https://lesterresdecaldera.fr</a>
              </p>
              <p>
                CALDERA accorde une attention particulière à la protection des
                données personnelles et s’engage à les traiter conformément au
                Règlement général sur la protection des données (« RGPD »), à la loi
                Informatique et Libertés et aux autres dispositions applicables.
              </p>
            </section>

            <Section id="section-1" title="1. Responsable du traitement">
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
                Président : <strong>Quentin SAVIGNY</strong>
                <br />
                E-mail :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
                <br />
                Téléphone : <a href="tel:+33671638306">06 71 63 83 06</a>
              </address>
              <p>CALDERA est en cours d’immatriculation au RCS de Lyon.</p>
              <p>
                Aucun délégué à la protection des données (« DPO ») n’a été désigné
                à ce jour.
              </p>
              <p>
                Les demandes relatives aux données personnelles peuvent être
                adressées à :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
              </p>
            </Section>

            <Section id="section-2" title="2. Données personnelles collectées">
              <p>
                Selon la manière dont l’utilisateur utilise le site, CALDERA peut
                traiter les catégories de données suivantes.
              </p>

              <h3>2.1 Identité</h3>
              <p>Peuvent notamment être collectés :</p>
              <ul>
                <li>prénom ;</li>
                <li>nom.</li>
              </ul>

              <h3>2.2 Coordonnées</h3>
              <p>Peuvent notamment être collectés :</p>
              <ul>
                <li>adresse e-mail ;</li>
                <li>
                  numéro de téléphone lorsqu’il est nécessaire, notamment pour la
                  livraison ou la gestion d’une commande.
                </li>
              </ul>

              <h3>2.3 Livraison et facturation</h3>
              <p>CALDERA peut traiter :</p>
              <ul>
                <li>adresse postale ;</li>
                <li>adresse de livraison ;</li>
                <li>
                  adresse de facturation lorsqu’elle diffère de l’adresse de
                  livraison ;
                </li>
                <li>
                  informations nécessaires au choix ou au suivi du mode de
                  livraison ;
                </li>
                <li>Point Relais sélectionné le cas échéant.</li>
              </ul>

              <h3>2.4 Compte client</h3>
              <p>
                Lorsqu’un utilisateur crée un compte, avec ou sans commande,
                CALDERA peut notamment traiter :
              </p>
              <ul>
                <li>un identifiant interne ;</li>
                <li>les informations liées au compte ;</li>
                <li>les préférences du compte ;</li>
                <li>les données nécessaires à l’authentification.</li>
              </ul>
              <p>
                Les mots de passe ne sont pas destinés à être conservés en clair.
                Ils sont stockés sous une forme sécurisée conformément aux
                mécanismes techniques d’authentification utilisés.
              </p>

              <h3>2.5 Commandes</h3>
              <p>CALDERA peut notamment conserver :</p>
              <ul>
                <li>numéro de commande ;</li>
                <li>produits achetés ;</li>
                <li>quantités ;</li>
                <li>prix ;</li>
                <li>montant total ;</li>
                <li>historique des commandes ;</li>
                <li>statut de la commande ;</li>
                <li>informations relatives à l’expédition ;</li>
                <li>retours ;</li>
                <li>remboursements ;</li>
                <li>réclamations associées.</li>
              </ul>

              <h3>2.6 Paiements</h3>
              <p>
                Les paiements sont traités par{' '}
                <strong>Stripe et ses partenaires de paiement</strong>.
              </p>
              <p>
                CALDERA peut recevoir ou conserver certaines informations
                nécessaires au suivi de la transaction, notamment :
              </p>
              <ul>
                <li>statut du paiement ;</li>
                <li>moyen de paiement utilisé ;</li>
                <li>montant ;</li>
                <li>identifiant technique de transaction ;</li>
                <li>informations relatives aux remboursements ;</li>
                <li>informations nécessaires à la prévention de la fraude.</li>
              </ul>
              <p>
                <strong>
                  CALDERA ne stocke pas directement le numéro complet des cartes
                  bancaires utilisées pour effectuer un paiement.
                </strong>
              </p>
              <p>
                Les informations bancaires nécessaires au traitement du paiement
                sont gérées par les prestataires de paiement concernés.
              </p>

              <h3>2.7 Service client et formulaire de contact</h3>
              <p>
                Lorsque l’utilisateur contacte CALDERA, peuvent notamment être
                traités :
              </p>
              <ul>
                <li>identité ;</li>
                <li>adresse e-mail ;</li>
                <li>numéro de commande ;</li>
                <li>contenu du message ;</li>
                <li>historique des échanges ;</li>
                <li>documents ou photographies transmis volontairement.</li>
              </ul>
              <p>
                Des photographies peuvent par exemple être demandées afin de
                constater un colis ou un produit endommagé, incorrect ou non
                conforme.
              </p>

              <h3>2.8 Newsletter</h3>
              <p>
                Lorsqu’une personne s’inscrit à la newsletter, CALDERA traite
                notamment :
              </p>
              <ul>
                <li>son adresse e-mail ;</li>
                <li>la date d’inscription ;</li>
                <li>les informations nécessaires à la gestion du consentement ;</li>
                <li>les informations relatives à la désinscription ;</li>
                <li>
                  les interactions pertinentes avec les communications permettant
                  de déterminer le dernier signe d’intérêt.
                </li>
              </ul>

              <h3>2.9 Données techniques et de sécurité</h3>
              <p>
                Le fonctionnement et la sécurisation du site peuvent entraîner le
                traitement de certaines données techniques, notamment :
              </p>
              <ul>
                <li>adresse IP ;</li>
                <li>date et heure de connexion ou de requête ;</li>
                <li>journaux techniques ;</li>
                <li>informations relatives au navigateur ou au terminal ;</li>
                <li>données nécessaires à la détection d’erreurs ;</li>
                <li>données nécessaires à la sécurisation du site ;</li>
                <li>
                  éléments nécessaires à la prévention des utilisations
                  frauduleuses ou abusives.
                </li>
              </ul>

              <h3>2.10 Mesure d’audience</h3>
              <p>
                CALDERA utilise ou prévoit d’utiliser{' '}
                <strong>Vercel Web Analytics</strong> afin d’obtenir des
                statistiques sur l’utilisation du site, telles que les pages
                consultées, les sources de trafic, certaines informations
                techniques et des événements simples.
              </p>
              <p>
                CALDERA utilise également <strong>Google Search Console</strong>{' '}
                afin de suivre notamment l’indexation du site, les impressions, les
                clics et les requêtes associées au référencement naturel du site
                sur Google.
              </p>
              <p>
                Google Search Console ne constitue pas, en lui-même, un outil
                publicitaire installé sur le site afin de suivre individuellement
                les visiteurs à des fins de publicité.
              </p>
            </Section>

            <Section id="section-3" title="3. Finalités et bases juridiques">
              <p>Les données ne sont utilisées que pour des finalités déterminées.</p>
              <div className={styles.tableScroll}>
                <table className={styles.legalTable}>
                  <thead>
                    <tr>
                      <th>Finalité</th>
                      <th>Base juridique principale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Création et gestion d’un compte client</td>
                      <td>
                        Exécution du contrat ou mesures précontractuelles demandées
                        par l’utilisateur
                      </td>
                    </tr>
                    <tr>
                      <td>Gestion du panier et du parcours d’achat</td>
                      <td>Exécution de mesures précontractuelles</td>
                    </tr>
                    <tr>
                      <td>Traitement et suivi des commandes</td>
                      <td>Exécution du contrat</td>
                    </tr>
                    <tr>
                      <td>Paiement et remboursement</td>
                      <td>Exécution du contrat</td>
                    </tr>
                    <tr>
                      <td>Livraison des commandes</td>
                      <td>Exécution du contrat</td>
                    </tr>
                    <tr>
                      <td>Gestion des retours et garanties</td>
                      <td>Exécution du contrat et obligations légales</td>
                    </tr>
                    <tr>
                      <td>Facturation et obligations comptables</td>
                      <td>Obligation légale</td>
                    </tr>
                    <tr>
                      <td>Service client et traitement des réclamations</td>
                      <td>
                        Exécution du contrat ou intérêt légitime selon la nature de
                        la demande
                      </td>
                    </tr>
                    <tr>
                      <td>Prévention de la fraude et sécurité</td>
                      <td>
                        Intérêt légitime de CALDERA à protéger le site, ses clients
                        et ses transactions
                      </td>
                    </tr>
                    <tr>
                      <td>Conservation de certaines preuves</td>
                      <td>Obligation légale ou intérêt légitime selon les cas</td>
                    </tr>
                    <tr>
                      <td>Newsletter et prospection électronique sur consentement</td>
                      <td>Consentement</td>
                    </tr>
                    <tr>
                      <td>Mesure d’audience et amélioration technique du site</td>
                      <td>
                        Intérêt légitime lorsque les conditions légales le permettent
                      </td>
                    </tr>
                    <tr>
                      <td>Réponse aux demandes d’exercice de droits RGPD</td>
                      <td>Obligation légale</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                CALDERA ne fonde pas l’envoi de sa newsletter sur l’acceptation des
                CGV.
              </p>
              <p>
                Lorsque le consentement est nécessaire, celui-ci doit résulter d’un
                choix libre, spécifique, éclairé et univoque.
              </p>
            </Section>

            <Section
              id="section-4"
              title="4. Newsletter et communications commerciales"
            >
              <p>L’inscription à la newsletter est facultative.</p>
              <p>
                Lorsque le consentement est requis, celui-ci est recueilli au moyen
                d’une action positive de l’utilisateur.
              </p>
              <p>
                La case permettant de recevoir les communications commerciales
                n’est pas cochée par défaut.
              </p>
              <p>
                Le consentement à la newsletter n’est pas une condition permettant
                de passer une commande.
              </p>
              <p>L’utilisateur peut retirer son consentement à tout moment :</p>
              <ul>
                <li>au moyen du lien de désinscription figurant dans les e-mails ;</li>
                <li>
                  ou en contactant{' '}
                  <a href="mailto:contact@lesterresdecaldera.fr">
                    contact@lesterresdecaldera.fr
                  </a>
                  .
                </li>
              </ul>
              <p>
                Le retrait du consentement n’affecte pas la licéité des traitements
                réalisés avant son retrait.
              </p>
            </Section>

            <Section id="section-5" title="5. Destinataires et prestataires">
              <p>
                Les données sont accessibles uniquement aux personnes et
                prestataires ayant besoin d’en connaître pour les finalités
                décrites dans la présente politique.
              </p>
              <p>CALDERA peut notamment recourir aux prestataires suivants.</p>

              <h3>Vercel</h3>
              <p>Vercel est utilisé notamment pour :</p>
              <ul>
                <li>l’hébergement et le déploiement du site ;</li>
                <li>son infrastructure technique ;</li>
                <li>Vercel Web Analytics lorsque cette fonctionnalité est activée.</li>
              </ul>

              <h3>Supabase</h3>
              <p>Supabase est utilisé notamment pour :</p>
              <ul>
                <li>la base de données ;</li>
                <li>
                  certaines fonctionnalités liées aux comptes clients et à
                  l’authentification ;
                </li>
                <li>
                  le stockage des données nécessaires au fonctionnement de la
                  boutique.
                </li>
              </ul>

              <h3>Stripe et ses partenaires de paiement</h3>
              <p>Stripe intervient notamment pour :</p>
              <ul>
                <li>le traitement des paiements ;</li>
                <li>la gestion des transactions ;</li>
                <li>certains remboursements ;</li>
                <li>la prévention de la fraude.</li>
              </ul>
              <p>
                Selon les moyens activés, Stripe peut permettre l’utilisation de
                moyens de paiement tels que :
              </p>
              <ul>
                <li>carte bancaire ;</li>
                <li>Apple Pay ;</li>
                <li>Google Pay ;</li>
                <li>PayPal ;</li>
                <li>Klarna.</li>
              </ul>

              <h3>Resend</h3>
              <p>Resend est utilisé pour l’envoi notamment :</p>
              <ul>
                <li>des e-mails transactionnels ;</li>
                <li>des confirmations liées aux commandes ;</li>
                <li>des communications liées aux comptes ;</li>
                <li>des e-mails du service client ;</li>
                <li>de la newsletter.</li>
              </ul>

              <h3>Mondial Relay</h3>
              <p>
                Mondial Relay peut recevoir les informations nécessaires à
                l’acheminement des commandes lorsque le client sélectionne une
                livraison en Point Relais.
              </p>

              <h3>La Poste / Colissimo</h3>
              <p>
                La Poste et Colissimo peuvent recevoir les informations nécessaires
                à l’acheminement d’une commande lorsqu’une livraison correspondante
                est choisie.
              </p>

              <h3>OVHcloud</h3>
              <p>OVHcloud est notamment utilisé pour :</p>
              <ul>
                <li>l’enregistrement ou la gestion du nom de domaine ;</li>
                <li>
                  le cas échéant, certains services liés à la messagerie
                  professionnelle.
                </li>
              </ul>
              <p>
                CALDERA ne vend pas les données personnelles de ses clients à des
                tiers à des fins commerciales.
              </p>
            </Section>

            <Section
              id="section-6"
              title="6. Transferts de données hors de l’Espace économique européen"
            >
              <p>
                Certains prestataires utilisés par CALDERA sont des sociétés
                internationales ou peuvent recourir à des infrastructures situées
                hors de l’Espace économique européen.
              </p>
              <p>
                Des données peuvent donc, dans certaines situations, faire l’objet
                d’un transfert international.
              </p>
              <p>
                Lorsque la réglementation l’exige, ces transferts doivent être
                encadrés par un mécanisme reconnu par le droit applicable, tel que :
              </p>
              <ul>
                <li>une décision d’adéquation ;</li>
                <li>
                  des clauses contractuelles types approuvées par la Commission
                  européenne ;
                </li>
                <li>
                  ou tout autre mécanisme de transfert reconnu par le RGPD.
                </li>
              </ul>
              <p>
                Les modalités exactes peuvent dépendre du prestataire, de la
                configuration du service et de la localisation des infrastructures
                utilisées.
              </p>
              <p>
                Les personnes concernées peuvent contacter CALDERA pour obtenir
                davantage d’informations sur les garanties applicables à un
                traitement les concernant.
              </p>
            </Section>

            <Section id="section-7" title="7. Durées de conservation">
              <p>
                CALDERA ne conserve les données personnelles que pendant une durée
                compatible avec la finalité pour laquelle elles ont été collectées
                et avec ses obligations légales.
              </p>

              <h3>Comptes clients et relation commerciale</h3>
              <p>
                Les données liées au compte client et à la relation commerciale
                sont conservées pendant la relation commerciale puis, lorsqu’elles
                restent nécessaires, jusqu’à <strong>3 ans après la dernière
                commande ou le dernier contact</strong>.
              </p>
              <p>
                Un compte client inactif peut être supprimé après{' '}
                <strong>3 ans sans connexion, commande ou interaction</strong>,
                sous réserve des données devant être conservées séparément pour
                respecter une obligation légale ou assurer la défense des droits de
                CALDERA.
              </p>

              <h3>Commandes et comptabilité</h3>
              <p>
                Les factures, commandes et données devant être conservées pour
                satisfaire aux obligations comptables et légales peuvent être
                archivées pendant <strong>10 ans</strong>.
              </p>
              <p>
                Les données devenues inutiles au fonctionnement courant du compte
                peuvent être placées dans un archivage à accès restreint lorsqu’une
                conservation légale demeure nécessaire.
              </p>

              <h3>Newsletter</h3>
              <p>
                L’adresse e-mail et les données utilisées à des fins de newsletter
                peuvent être conservées pendant{' '}
                <strong>
                  3 ans à compter de l’inscription ou du dernier signe d’intérêt ou
                  de la dernière interaction du contact
                </strong>
                , sauf désinscription anticipée.
              </p>
              <p>
                En cas de désinscription, CALDERA cesse l’utilisation de l’adresse
                pour l’envoi de la newsletter.
              </p>
              <p>
                Certaines informations strictement nécessaires à la preuve du
                retrait ou au respect durable d’une opposition peuvent cependant
                être conservées dans les conditions permises par la réglementation.
              </p>

              <h3>Service client</h3>
              <p>
                Les échanges avec le service client sont conservés pendant le temps
                nécessaire au traitement de la demande puis, lorsque cela est
                pertinent, pendant la durée nécessaire au suivi de la relation
                commerciale ou à la défense des droits de CALDERA ou du client.
              </p>
              <p>
                Les photographies ou justificatifs transmis dans le cadre d’une
                réclamation ne sont pas destinés à être conservés au-delà de la
                durée nécessaire au traitement et à la justification de cette
                réclamation, sauf nécessité légale ou contentieuse.
              </p>

              <h3>Données de sécurité</h3>
              <p>
                Les journaux et données techniques de sécurité sont conservés
                pendant une durée limitée déterminée en fonction de leur nécessité
                pour assurer la sécurité du service, détecter les anomalies,
                prévenir la fraude ou répondre à une obligation légale.
              </p>
              <p>
                Ils sont ensuite supprimés ou anonymisés lorsqu’ils ne sont plus
                nécessaires.
              </p>
            </Section>

            <Section id="section-8" title="8. Vercel Web Analytics">
              <p>
                CALDERA peut utiliser <strong>Vercel Web Analytics</strong> afin de
                mesurer la fréquentation et le fonctionnement du site.
              </p>
              <p>
                Selon la documentation publiée par Vercel, Web Analytics fonctionne
                sans recourir à des cookies pour identifier les visiteurs et
                utilise notamment un identifiant dérivé de la requête afin de
                limiter le suivi d’un utilisateur entre différents sites.
              </p>
              <p>
                CALDERA utilise cet outil dans un objectif de mesure globale de
                fréquentation et d’amélioration du site, et non pour constituer des
                profils publicitaires individuels.
              </p>
              <p>
                Aucun <strong>Meta Pixel</strong>, <strong>TikTok Pixel</strong> ou
                traceur <strong>Google Ads</strong> n’est prévu au lancement.
              </p>
              <p>
                Si CALDERA ajoute ultérieurement des technologies de mesure ou de
                publicité nécessitant le consentement de l’utilisateur, la présente
                politique et le dispositif de recueil du consentement seront
                adaptés avant leur utilisation.
              </p>
            </Section>

            <Section id="section-9" title="9. Cookies et traceurs nécessaires">
              <p>
                Certaines technologies peuvent être nécessaires au fonctionnement
                du site, notamment pour :
              </p>
              <ul>
                <li>maintenir une session utilisateur ;</li>
                <li>authentifier un compte ;</li>
                <li>assurer la sécurité ;</li>
                <li>conserver temporairement le contenu d’un panier ;</li>
                <li>
                  exécuter les fonctionnalités expressément demandées par
                  l’utilisateur.
                </li>
              </ul>
              <p>
                Ces technologies peuvent, lorsqu’elles sont strictement nécessaires
                au service demandé, relever des exemptions au consentement prévues
                par la réglementation.
              </p>
              <p>
                CALDERA n’utilise pas au lancement de traceurs publicitaires
                destinés au profilage ou au ciblage comportemental.
              </p>
              <p>
                L’ajout futur de traceurs nécessitant un consentement préalable
                donnera lieu à la mise en place d’un mécanisme permettant notamment
                de les accepter ou de les refuser avant leur dépôt.
              </p>
            </Section>

            <Section id="section-10" title="10. Sécurité">
              <p>
                CALDERA met en œuvre des mesures techniques et organisationnelles
                adaptées afin de protéger les données personnelles contre notamment :
              </p>
              <ul>
                <li>l’accès non autorisé ;</li>
                <li>la perte ;</li>
                <li>la destruction ;</li>
                <li>l’altération ;</li>
                <li>la divulgation non autorisée ;</li>
                <li>l’utilisation abusive.</li>
              </ul>
              <p>
                Ces mesures comprennent notamment, selon les traitements concernés,
                des mécanismes d’authentification, de contrôle d’accès, de
                sécurisation des communications, de journalisation et de limitation
                des accès aux données.
              </p>
              <p>
                Aucun système informatique ne pouvant offrir une sécurité absolue,
                CALDERA adapte ses mesures aux risques identifiés et à l’évolution
                de ses services.
              </p>
            </Section>

            <Section id="section-11" title="11. Droits des personnes">
              <p>
                Dans les conditions prévues par le RGPD, une personne concernée
                peut notamment disposer :
              </p>
              <ul>
                <li>d’un droit d’accès à ses données ;</li>
                <li>d’un droit de rectification ;</li>
                <li>d’un droit à l’effacement ;</li>
                <li>d’un droit à la limitation du traitement ;</li>
                <li>
                  d’un droit d’opposition lorsque le traitement repose sur une base
                  permettant cette opposition ;
                </li>
                <li>
                  d’un droit à la portabilité lorsque les conditions légales sont
                  réunies ;
                </li>
                <li>
                  du droit de retirer son consentement à tout moment pour les
                  traitements reposant sur celui-ci.
                </li>
              </ul>
              <p>
                Ces droits ne sont pas absolus et peuvent connaître des limitations
                prévues par la réglementation, notamment lorsqu’une conservation
                est nécessaire au respect d’une obligation légale ou à la
                constatation, l’exercice ou la défense de droits en justice.
              </p>
            </Section>

            <Section id="section-12" title="12. Exercice des droits">
              <p>
                Pour exercer ses droits ou poser une question relative à ses données
                personnelles, l’utilisateur peut contacter CALDERA à :
              </p>
              <p>
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
              </p>
              <address className={styles.address}>
                <strong>CALDERA</strong>
                <br />
                74 rue Pierre Valdo
                <br />
                69005 Lyon
                <br />
                France
              </address>
              <p>
                La demande doit permettre à CALDERA d’identifier précisément le
                droit concerné et les données auxquelles elle se rapporte.
              </p>
              <p>
                Lorsque CALDERA a un doute raisonnable sur l’identité du demandeur,
                des informations supplémentaires strictement nécessaires à la
                vérification de son identité peuvent être demandées.
              </p>
              <p>
                CALDERA répond aux demandes dans les délais prévus par la
                réglementation applicable.
              </p>
            </Section>

            <Section id="section-13" title="13. Réclamation auprès de la CNIL">
              <p>
                Si une personne estime, après avoir contacté CALDERA, que ses droits
                relatifs à ses données personnelles ne sont pas respectés, elle
                dispose du droit d’introduire une réclamation auprès de l’autorité
                de contrôle compétente.
              </p>
              <p>
                En France :{' '}
                <strong>
                  Commission nationale de l’informatique et des libertés — CNIL
                </strong>
              </p>
              <p>
                Informations et démarches disponibles sur :{' '}
                <a href="https://www.cnil.fr">www.cnil.fr</a>
              </p>
              <p>
                Cette possibilité n’empêche pas la personne concernée d’exercer tout
                autre recours prévu par la loi.
              </p>
            </Section>

            <Section id="section-14" title="14. Données relatives aux mineurs">
              <p>
                CALDERA ne cherche pas à collecter volontairement davantage de
                données concernant les mineurs que ce qui est nécessaire au
                fonctionnement du service ou à l’exécution d’une commande
                autorisée.
              </p>
              <p>
                Les mineurs ne doivent communiquer que les informations nécessaires
                à l’utilisation licite du service.
              </p>
              <p>
                Lorsque la réglementation exige l’intervention ou l’autorisation
                d’un représentant légal pour un traitement particulier, CALDERA
                peut prendre les mesures nécessaires afin de respecter cette
                obligation.
              </p>
            </Section>

            <Section
              id="section-15"
              title="15. Absence de décision exclusivement automatisée"
            >
              <p>
                CALDERA n’a pas vocation, au lancement du site, à prendre à l’égard
                de ses clients des décisions produisant des effets juridiques ou
                les affectant de manière significative qui seraient fondées
                exclusivement sur un traitement automatisé au sens du RGPD.
              </p>
              <p>
                Les outils de lutte contre la fraude utilisés par les prestataires
                de paiement peuvent toutefois réaliser des analyses automatisées
                conformément à leurs propres conditions et politiques de
                confidentialité.
              </p>
            </Section>

            <Section
              id="section-16"
              title="16. Modification de la politique de confidentialité"
            >
              <p>
                CALDERA peut modifier la présente politique afin notamment de tenir
                compte :
              </p>
              <ul>
                <li>d’une évolution du site ;</li>
                <li>de l’ajout d’un nouveau service ;</li>
                <li>d’un changement de prestataire ;</li>
                <li>d’une modification de la réglementation ;</li>
                <li>d’une évolution des traitements réalisés.</li>
              </ul>
              <p>
                La date de dernière mise à jour est indiquée en haut du document.
              </p>
              <p>
                Lorsque les modifications sont susceptibles d’affecter
                substantiellement les droits des utilisateurs, CALDERA prend les
                mesures d’information appropriées.
              </p>
            </Section>

            <Section id="section-17" title="17. Contact">
              <p>Pour toute question concernant la protection des données personnelles :</p>
              <address className={styles.address}>
                <strong>CALDERA</strong>
                <br />
                E-mail :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
                <br />
                <br />
                Adresse :
                <br />
                <strong>74 rue Pierre Valdo</strong>
                <br />
                <strong>69005 Lyon — France</strong>
                <br />
                <br />
                Téléphone : <a href="tel:+33671638306">06 71 63 83 06</a>
              </address>
              <p>
                Vous pouvez également consulter les{' '}
                <Link href="/mentions-legales">Mentions légales</Link> et les{' '}
                <Link href="/cgv">Conditions Générales de Vente</Link>.
              </p>
            </Section>
          </div>
        </Container>
      </section>
    </main>
  );
}
