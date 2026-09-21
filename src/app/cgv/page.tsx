import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Container } from '@/components/ui/Container/Container';
import styles from './cgv.module.scss';

export const metadata: Metadata = {
  title: 'Conditions générales de vente | Les Terres de Caldera',
  description:
    'Consultez les Conditions Générales de Vente de la boutique Les Terres de Caldera.',
  alternates: { canonical: '/cgv' },
  openGraph: {
    title: 'Conditions générales de vente | Les Terres de Caldera',
    description:
      'Conditions Générales de Vente applicables aux achats réalisés sur Les Terres de Caldera.',
    url: '/cgv',
    type: 'website',
    locale: 'fr_FR',
  },
};

const articles = [
  ['article-1', '1. Identité du vendeur'],
  ['article-2', '2. Objet et champ d’application'],
  ['article-3', '3. Produits commercialisés'],
  ['article-4', '4. Disponibilité et stock'],
  ['article-5', '5. Prix'],
  ['article-6', '6. Promotions et offres commerciales'],
  ['article-7', '7. Processus de commande'],
  ['article-8', '8. Refus, suspension ou annulation'],
  ['article-9', '9. Paiement'],
  ['article-10', '10. Livraison'],
  ['article-11', '11. Transfert des risques et réception'],
  ['article-12', '12. Droit de rétractation'],
  ['article-13', '13. État des produits retournés'],
  ['article-14', '14. Remboursement en cas de rétractation'],
  ['article-15', '15. Autres remboursements'],
  ['article-16', '16. Garanties légales'],
  ['article-17', '17. Réclamations et service client'],
  ['article-18', '18. Médiation de la consommation'],
  ['article-19', '19. Responsabilité'],
  ['article-20', '20. Force majeure'],
  ['article-21', '21. Mineurs'],
  ['article-22', '22. Réserve de propriété'],
  ['article-23', '23. Preuve et archivage'],
  ['article-24', '24. Données personnelles'],
  ['article-25', '25. Propriété intellectuelle'],
  ['article-26', '26. Droit applicable'],
  ['article-27', '27. Juridictions compétentes'],
  ['annexe', 'Annexe — Rétractation'],
] as const;

function Article({
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

export default function CgvPage() {
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <Container className={styles.heroInner}>
          <p className={styles.eyebrow}>Informations légales</p>
          <h1>Conditions Générales de Vente</h1>
          <p className={styles.brand}>Les Terres de Caldera — CALDERA</p>
          <p className={styles.version}>Version du 21 septembre 2026</p>
        </Container>
      </section>

      <section className={styles.content}>
        <Container className={styles.layout}>
          <nav className={styles.summary} aria-label="Sommaire des CGV">
            <p className={styles.summaryTitle}>Sommaire</p>
            <ol>
              {articles.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.document}>
            <Article id="article-1" title="Article 1 — Identité du vendeur">
              <p>
                Le site Les Terres de Caldera, accessible notamment à l’adresse
                <strong> lesterresdecaldera.fr</strong>, est exploité par :
              </p>
              <address className={styles.address}>
                <strong>CALDERA</strong>, société par actions simplifiée
                unipersonnelle (SASU) au capital social de <strong>100 euros</strong>,
                dont le siège social est situé :
                <br />
                74 rue Pierre Valdo
                <br />
                69005 Lyon, France
                <br />
                Président : <strong>Quentin SAVIGNY</strong>
                <br />
                RCS : <strong>Lyon — immatriculation en cours</strong>
                <br />
                SIREN / SIRET : <strong>à compléter après immatriculation</strong>
                <br />
                E-mail :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">
                  contact@lesterresdecaldera.fr
                </a>
                <br />
                Téléphone : <a href="tel:+33671638306">06 71 63 83 06</a>
              </address>
              <p>
                CALDERA bénéficie, tant que les conditions légales sont remplies,
                du régime de franchise en base de TVA.
              </p>
              <p>
                TVA non applicable conformément à l’article 293 B du Code général
                des impôts.
              </p>
              <p>
                Les présentes Conditions Générales de Vente, ci-après les « CGV »,
                régissent les ventes réalisées par CALDERA auprès de consommateurs
                agissant à des fins non professionnelles.
              </p>
              <p>CALDERA commercialise ses produits uniquement auprès de particuliers.</p>
            </Article>

            <Article id="article-2" title="Article 2 — Objet et champ d’application">
              <p>
                Les présentes CGV définissent les droits et obligations de CALDERA
                et de ses clients dans le cadre des ventes réalisées sur le site
                Les Terres de Caldera.
              </p>
              <p>Elles s’appliquent à toute commande passée sur le site par un consommateur.</p>
              <p>
                Le client déclare avoir pris connaissance des présentes CGV avant
                la validation de sa commande et les accepter sans réserve.
              </p>
              <p>
                La version des CGV applicable à une commande est celle acceptée
                par le client au moment de sa commande.
              </p>
              <p>
                CALDERA peut modifier les présentes CGV à tout moment. Les
                modifications ne s’appliquent pas rétroactivement aux commandes
                déjà conclues.
              </p>
            </Article>

            <Article id="article-3" title="Article 3 — Produits commercialisés">
              <p>CALDERA peut notamment commercialiser :</p>
              <ul>
                <li>des cartes Pokémon à l’unité ;</li>
                <li>
                  des produits Pokémon JCC scellés, tels que boosters, displays,
                  Elite Trainer Box, bundles, coffrets, mini tins, duopacks et
                  collections spéciales ;
                </li>
                <li>
                  des accessoires destinés aux jeux de cartes à collectionner,
                  notamment sleeves, top loaders, classeurs, boîtes de rangement,
                  protections et accessoires de jeu.
                </li>
              </ul>
              <p>
                Les caractéristiques essentielles de chaque produit sont indiquées
                sur sa fiche produit.
              </p>
              <p>
                CALDERA s’efforce de présenter les produits, photographies,
                caractéristiques et descriptions de la manière la plus fidèle
                possible.
              </p>
              <p>
                Pour les cartes vendues à l’unité, l’état annoncé sur la fiche
                produit fait partie des caractéristiques prises en compte lors de
                la vente.
              </p>
              <p>
                Les éventuelles différences mineures de rendu liées notamment à
                l’écran, à l’éclairage ou à la photographie ne sauraient priver le
                consommateur de ses droits lorsque le produit livré n’est pas
                conforme aux caractéristiques contractuelles annoncées.
              </p>
              <p>CALDERA ne propose pas de précommandes au lancement du service.</p>
            </Article>

            <Article id="article-4" title="Article 4 — Disponibilité et stock">
              <p>Les produits sont proposés dans la limite des stocks disponibles.</p>
              <p>L’ajout d’un produit au panier ne constitue pas une réservation du produit.</p>
              <p>
                Le stock est attribué dans le cadre de la validation effective de
                la commande et de l’autorisation du paiement.
              </p>
              <p>
                Si, malgré les systèmes de gestion de stock mis en place, un
                produit devient indisponible après validation et paiement de la
                commande, CALDERA en informe le client dans les meilleurs délais.
              </p>
              <p>Le produit indisponible est alors intégralement remboursé.</p>
              <p>
                Si le produit indisponible constituait l’intégralité de la
                commande, la commande est annulée et remboursée intégralement.
              </p>
            </Article>

            <Article id="article-5" title="Article 5 — Prix">
              <p>Les prix des produits sont indiqués en <strong>euros TTC</strong>.</p>
              <p>
                CALDERA bénéficiant de la franchise en base de TVA, aucune TVA
                n’est facturée tant que ce régime demeure applicable.
              </p>
              <p>
                Les frais de livraison sont indiqués séparément avant la
                validation définitive de la commande.
              </p>
              <p>CALDERA peut modifier ses prix à tout moment.</p>
              <p>
                Le prix applicable reste toutefois celui affiché au moment où le
                client valide sa commande, sous réserve d’une erreur manifeste de
                prix.
              </p>
              <p>
                En présence d’une erreur de prix évidente et objectivement
                identifiable, CALDERA peut annuler la commande concernée et
                rembourser les sommes éventuellement encaissées.
              </p>
              <p>Aucun montant minimum de commande n’est imposé.</p>
            </Article>

            <Article id="article-6" title="Article 6 — Promotions et offres commerciales">
              <p>
                CALDERA peut proposer ponctuellement des codes promotionnels,
                réductions, offres de lancement ou autres opérations commerciales
                temporaires.
              </p>
              <p>
                Les conditions spécifiques de chaque offre, notamment sa durée,
                les produits concernés, son éventuel montant minimum et ses
                possibilités de cumul, sont précisées lors de l’opération.
              </p>
              <p>
                Sauf mention contraire, une promotion n’est ni échangeable contre
                sa valeur monétaire ni applicable rétroactivement à une commande
                déjà validée.
              </p>
            </Article>

            <Article id="article-7" title="Article 7 — Processus de commande">
              <p>
                Le client sélectionne les produits qu’il souhaite commander et les
                ajoute à son panier.
              </p>
              <p>Avant la validation définitive, le client a la possibilité de vérifier :</p>
              <ul>
                <li>les produits commandés ;</li>
                <li>leurs quantités ;</li>
                <li>leur prix ;</li>
                <li>les frais applicables ;</li>
                <li>le montant total de la commande ;</li>
                <li>ses coordonnées ;</li>
                <li>son adresse de livraison ;</li>
                <li>le mode de livraison sélectionné ;</li>
              </ul>
              <p>et de corriger d’éventuelles erreurs.</p>
              <p>
                Le client valide ensuite sa commande par une action indiquant sans
                ambiguïté que cette validation entraîne une obligation de paiement.
              </p>
              <p>
                La commande est définitivement conclue lorsque le client, après
                avoir vérifié le détail de sa commande et son prix total et corrigé
                d’éventuelles erreurs, confirme sa commande avec obligation de
                paiement et que le paiement est autorisé.
              </p>
              <p>
                CALDERA adresse ensuite au client, sans retard injustifié, un
                e-mail de confirmation récapitulant les informations essentielles
                de la commande.
              </p>
              <p>
                Cette disposition ne fait pas obstacle aux cas d’annulation prévus
                dans les présentes CGV.
              </p>
            </Article>

            <Article id="article-8" title="Article 8 — Refus, suspension ou annulation d’une commande">
              <p>CALDERA se réserve le droit de suspendre ou d’annuler une commande en cas :</p>
              <ul>
                <li>de suspicion raisonnable de fraude ;</li>
                <li>d’anomalie de paiement ;</li>
                <li>de refus ou d’échec du paiement ;</li>
                <li>d’erreur manifeste de prix ;</li>
                <li>d’indisponibilité réelle du produit ;</li>
                <li>ou d’impossibilité légitime d’exécuter la commande.</li>
              </ul>
              <p>Le client en est informé dans les meilleurs délais.</p>
              <p>
                Si une somme a déjà été encaissée au titre d’une commande annulée,
                elle est remboursée selon les modalités prévues par les présentes CGV.
              </p>
            </Article>

            <Article id="article-9" title="Article 9 — Paiement">
              <p>Le paiement est exigible lors de la commande.</p>
              <p>
                Les paiements sont traités par <strong>Stripe et ses partenaires de paiement</strong>.
              </p>
              <p>
                Selon leur disponibilité technique, leur activation par CALDERA et
                l’éligibilité du client, les moyens de paiement pouvant notamment
                être proposés sont :
              </p>
              <ul>
                <li>carte bancaire ;</li>
                <li>Apple Pay ;</li>
                <li>Google Pay ;</li>
                <li>PayPal ;</li>
                <li>Klarna.</li>
              </ul>
              <p>Les moyens effectivement disponibles sont indiqués au client pendant le processus de commande.</p>
              <p>Certains moyens de paiement peuvent être soumis à des conditions propres au prestataire concerné.</p>
              <p>CALDERA ne stocke pas directement les numéros complets de cartes bancaires.</p>
              <p>
                Les données de paiement sont traitées par les prestataires de paiement
                concernés conformément à leurs propres procédures de sécurité.
              </p>
              <p>
                La commande peut être refusée ou suspendue en cas de refus
                d’autorisation du paiement ou de suspicion raisonnable de fraude.
              </p>
            </Article>

            <Article id="article-10" title="Article 10 — Livraison">
              <h3>10.1 Zone de livraison</h3>
              <p>CALDERA livre au lancement uniquement en <strong>France métropolitaine</strong>.</p>
              <p>Les éventuelles restrictions de livraison sont indiquées au client avant la validation de la commande.</p>

              <h3>10.2 Modes de livraison</h3>
              <p>Les modes de livraison proposés peuvent notamment comprendre :</p>
              <p><strong>Mondial Relay — Point Relais</strong></p>
              <p>et</p>
              <p><strong>La Poste / Colissimo — livraison à domicile</strong>.</p>
              <p>Les modes effectivement disponibles sont indiqués au moment de la commande.</p>

              <h3>10.3 Préparation</h3>
              <p>
                Les commandes sont normalement préparées et expédiées sous
                <strong> 1 à 2 jours ouvrés après confirmation du paiement</strong>.
              </p>
              <p>
                Ce délai correspond à la préparation et à la remise de la commande
                au transporteur et ne constitue pas nécessairement le délai total
                de livraison.
              </p>

              <h3>10.4 Délais de livraison</h3>
              <p>Les délais indiqués lors de la commande sont estimatifs lorsqu’ils dépendent du transporteur.</p>
              <p>
                Ils peuvent être affectés par des circonstances indépendantes de la
                volonté de CALDERA, notamment un retard du transporteur ou un cas
                de force majeure.
              </p>
              <p>
                Ces circonstances ne privent pas le client des droits que lui
                reconnaît la loi en cas de retard ou de défaut de livraison.
              </p>
              <p>
                Lorsque le droit applicable impose une date ou un délai de
                délivrance, CALDERA demeure tenue par les dispositions légales correspondantes.
              </p>

              <h3>10.5 Livraison offerte</h3>
              <p>
                La livraison en Point Relais Mondial Relay est offerte à partir de
                <strong> 100 euros d’achat</strong>, en France métropolitaine, sous
                réserve que ce mode de livraison soit disponible pour la commande concernée.
              </p>
              <p>Les éventuelles autres conditions sont affichées lors de la commande.</p>
            </Article>

            <Article id="article-11" title="Article 11 — Transfert des risques et réception">
              <p>
                Le risque de perte ou d’endommagement des produits est transféré
                au client lorsqu’il prend physiquement possession de la commande,
                ou lorsqu’un tiers désigné par lui en prend possession.
              </p>
              <p>
                Lorsque le consommateur choisit lui-même un transporteur qui n’a
                pas été proposé par CALDERA, les règles légales spécifiques
                relatives au transfert des risques s’appliquent.
              </p>
              <p>Le client est invité à vérifier l’état extérieur du colis lors de sa réception.</p>
              <p>
                L’absence de réserves au moment de la livraison ne prive pas le
                consommateur des garanties légales auxquelles il peut prétendre.
              </p>
              <p>
                En présence d’un colis ou produit endommagé, incorrect ou non
                conforme, le client doit contacter CALDERA dans les meilleurs délais à :
              </p>
              <p>
                <a href="mailto:contact@lesterresdecaldera.fr">contact@lesterresdecaldera.fr</a>
                {' '}ou via le formulaire de contact du site.
              </p>
              <p>
                Le client est invité à transmettre son numéro de commande ainsi
                que, lorsque cela est utile, des photographies permettant de constater le problème.
              </p>
            </Article>

            <Article id="article-12" title="Article 12 — Droit de rétractation">
              <h3>12.1 Principe</h3>
              <p>
                Le consommateur dispose d’un délai légal de <strong>14 jours</strong>
                {' '}pour exercer son droit de rétractation, sans avoir à justifier sa décision.
              </p>
              <p>
                Pour les ventes de biens, ce délai court en principe à compter de
                la réception du bien par le consommateur ou par un tiers désigné
                par lui autre que le transporteur.
              </p>
              <p>
                Lorsque plusieurs biens d’une même commande sont livrés séparément,
                les règles légales relatives au point de départ du délai s’appliquent.
              </p>

              <h3>12.2 Exercice de la rétractation</h3>
              <p>Le client peut exercer son droit de rétractation :</p>
              <ul>
                <li>par l’intermédiaire de la fonctionnalité de rétractation en ligne mise à disposition sur le site ;</li>
                <li>par e-mail à contact@lesterresdecaldera.fr ;</li>
                <li>ou au moyen de toute déclaration non ambiguë exprimant sa volonté de se rétracter.</li>
              </ul>
              <p className={styles.warning}>
                <strong>Fonctionnalité de rétractation en ligne : [URL À COMPLÉTER AVANT OUVERTURE]</strong>
              </p>
              <p>
                Lorsque la rétractation est effectuée en ligne dans les conditions
                prévues par la réglementation, un accusé de réception est transmis
                au consommateur sur un support durable.
              </p>

              <h3>12.3 Retour des produits</h3>
              <p>
                Après avoir communiqué sa décision de se rétracter, le consommateur
                doit retourner les produits sans retard excessif et au plus tard
                dans le délai légal applicable.
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
                Les frais directs de retour sont à la charge du client, sauf
                lorsque CALDERA décide de les prendre en charge ou lorsqu’une
                disposition légale prévoit le contraire.
              </p>
              <p>Le client est invité à utiliser un mode d’expédition permettant de justifier le retour du colis.</p>
            </Article>

            <Article id="article-13" title="Article 13 — État des produits retournés et dépréciation">
              <p>
                Le client doit manipuler les produits uniquement dans la mesure
                nécessaire pour établir leur nature, leurs caractéristiques et leur bon fonctionnement.
              </p>
              <p>
                Une dépréciation résultant de manipulations allant au-delà de ce
                qui est nécessaire peut entraîner une diminution du montant
                remboursé correspondant à la perte de valeur effectivement
                constatée, dans les conditions prévues par la loi.
              </p>

              <h3>Cartes Pokémon à l’unité</h3>
              <p>
                Les cartes doivent être retournées, dans la mesure du possible,
                avec les protections dans lesquelles elles ont été expédiées.
              </p>
              <p>
                Toute dégradation, rayure, pliure, altération ou manipulation
                dépassant ce qui est nécessaire pour examiner la carte peut
                entraîner une réduction du remboursement correspondant à la
                dépréciation réellement constatée.
              </p>

              <h3>Produits scellés</h3>
              <p>
                Le simple fait qu’un produit soit vendu scellé ne signifie pas
                automatiquement que le droit de rétractation disparaît lors de son ouverture.
              </p>
              <p>
                Toutefois, l’ouverture, la destruction ou l’altération irréversible
                d’un emballage ou d’un scellage susceptible d’entraîner une perte
                de valeur commerciale importante peut être prise en compte pour
                déterminer une éventuelle dépréciation du produit conformément à
                la réglementation applicable.
              </p>
              <p>
                Les exceptions légales au droit de rétractation restent applicables
                lorsqu’un produit entre effectivement dans l’une des catégories prévues par la loi.
              </p>
            </Article>

            <Article id="article-14" title="Article 14 — Remboursement en cas de rétractation">
              <p>
                En cas d’exercice valable du droit de rétractation, CALDERA
                rembourse les sommes devant légalement être remboursées, y compris
                les frais de livraison dans les limites prévues par la réglementation.
              </p>
              <p>
                Le remboursement intervient sans retard injustifié et au plus tard
                dans le délai légal applicable à compter de la notification de la rétractation.
              </p>
              <p>
                CALDERA peut, dans les situations prévues par la loi, différer le
                remboursement jusqu’à récupération du produit ou jusqu’à ce que le
                consommateur fournisse une preuve de son expédition.
              </p>
              <p>
                Les éventuels frais supplémentaires résultant du choix par le
                client d’un mode de livraison plus coûteux que le mode standard
                proposé peuvent ne pas être remboursés dans les conditions prévues par la loi.
              </p>
              <p>
                Le remboursement est réalisé par le même moyen de paiement que
                celui utilisé lors de la commande, sauf accord exprès du client
                pour un autre moyen, à condition que cela ne lui occasionne aucuns frais.
              </p>
            </Article>

            <Article id="article-15" title="Article 15 — Autres remboursements">
              <p>
                Lorsqu’un remboursement devient dû pour un motif autre que
                l’exercice du droit de rétractation, notamment en cas d’annulation
                de commande ou d’indisponibilité d’un produit, il est effectué sans
                retard injustifié et au plus tard dans un délai de <strong>14 jours
                à compter du moment où il devient dû</strong>, sous réserve d’un
                délai impératif différent prévu par la loi.
              </p>
              <p>
                Le remboursement est effectué par le même moyen de paiement que
                celui utilisé lors de la commande, sauf accord exprès du client
                pour un autre moyen ne lui occasionnant aucun frais.
              </p>
            </Article>

            <Article id="article-16" title="Article 16 — Garanties légales">
              <p>CALDERA ne propose aucune garantie commerciale supplémentaire.</p>
              <p>Le consommateur bénéficie toutefois de l’ensemble des garanties légales applicables, notamment :</p>
              <ul>
                <li>la garantie légale de conformité prévue par le Code de la consommation ;</li>
                <li>la garantie des vices cachés prévue par le Code civil.</li>
              </ul>
              <p>Pour mettre en œuvre une garantie légale, le client peut contacter :</p>
              <address className={styles.address}>
                <strong>CALDERA</strong>
                <br />
                74 rue Pierre Valdo
                <br />
                69005 Lyon
                <br />
                France
                <br />
                E-mail :{' '}
                <a href="mailto:contact@lesterresdecaldera.fr">contact@lesterresdecaldera.fr</a>
                <br />
                Téléphone : <a href="tel:+33671638306">06 71 63 83 06</a>
              </address>
              <p>
                La garantie légale de conformité permet notamment au consommateur
                d’agir lorsque le bien livré n’est pas conforme au contrat.
              </p>
              <p>
                Pour les biens concernés par cette garantie, le vendeur répond dans
                les conditions et délais prévus par les articles L. 217-1 et
                suivants du Code de la consommation.
              </p>
              <p>
                La garantie des vices cachés s’applique dans les conditions des
                articles 1641 et suivants du Code civil lorsqu’un défaut caché rend
                le produit impropre à l’usage auquel il est destiné ou en diminue fortement l’usage.
              </p>
              <p className={styles.warning}>
                <strong>
                  ENCADRÉ RÉGLEMENTAIRE OBLIGATOIRE : avant publication commerciale
                  des présentes CGV, CALDERA devra insérer ici l’encadré officiel
                  relatif aux garanties légales prévu par l’article D. 211-2 du
                  Code de la consommation et son annexe, dans sa version en vigueur.
                </strong>
              </p>
            </Article>

            <Article id="article-17" title="Article 17 — Réclamations et service client">
              <p>Toute réclamation relative à une commande doit d’abord être adressée à CALDERA par écrit :</p>
              <p>
                à <a href="mailto:contact@lesterresdecaldera.fr">contact@lesterresdecaldera.fr</a>
                {' '}ou au moyen du formulaire de contact disponible sur le site.
              </p>
              <p>Le client est invité à préciser :</p>
              <p>
                son identité, son numéro de commande, l’objet de sa réclamation,
                une description du problème et toute pièce utile à son traitement.
              </p>
              <p>
                Lorsque cela est pertinent, notamment en cas de dommage ou de
                non-conformité visible, des photographies peuvent être jointes.
              </p>
              <p>CALDERA examine la réclamation et s’efforce d’apporter une réponse dans les meilleurs délais.</p>
              <p>CALDERA privilégie, lorsque cela est possible, une résolution amiable du différend.</p>
            </Article>

            <Article id="article-18" title="Article 18 — Médiation de la consommation">
              <p>
                Après une réclamation écrite préalable adressée à CALDERA et en
                l’absence de résolution amiable satisfaisante, le consommateur peut
                recourir gratuitement à un médiateur de la consommation conformément
                aux dispositions applicables.
              </p>
              <div className={styles.warning}>
                <p><strong>Médiateur de la consommation de CALDERA : À COMPLÉTER IMPÉRATIVEMENT AVANT L’OUVERTURE COMMERCIALE</strong></p>
                <p>Nom : <strong>[à compléter]</strong></p>
                <p>Adresse : <strong>[à compléter]</strong></p>
                <p>Site internet : <strong>[à compléter]</strong></p>
              </div>
              <p>
                Les modalités de saisine du médiateur seront indiquées sur le site
                et dans les présentes CGV dès sa désignation.
              </p>
              <p>La médiation ne prive pas le consommateur de son droit de saisir les juridictions compétentes.</p>
            </Article>

            <Article id="article-19" title="Article 19 — Responsabilité">
              <p>
                CALDERA est responsable de la bonne exécution des obligations
                résultant du contrat dans les conditions prévues par la loi.
              </p>
              <p>
                CALDERA ne saurait toutefois être tenue responsable d’un dommage
                imputable au consommateur, à un tiers ou à un événement présentant
                les caractéristiques de la force majeure, dans les limites autorisées par la loi.
              </p>
              <p>
                Aucune disposition des présentes CGV n’a pour objet ni pour effet
                d’exclure ou de limiter un droit impératif reconnu au consommateur.
              </p>
            </Article>

            <Article id="article-20" title="Article 20 — Force majeure">
              <p>
                Aucune partie ne peut être tenue responsable d’un manquement
                résultant d’un événement remplissant les conditions légales de la force majeure.
              </p>
              <p>
                Lorsque l’événement est temporaire, l’exécution de l’obligation
                concernée peut être suspendue pendant la durée de l’empêchement.
              </p>
              <p>Lorsque l’empêchement devient définitif, les conséquences prévues par la loi s’appliquent.</p>
              <p>Les droits impératifs du consommateur demeurent applicables.</p>
            </Article>

            <Article id="article-21" title="Article 21 — Mineurs">
              <p>
                Les mineurs peuvent effectuer les achats correspondant à des actes
                courants de la vie quotidienne pouvant être raisonnablement
                accomplis compte tenu de leur âge et de leur situation.
              </p>
              <p>
                Pour tout achat important au regard de sa nature ou de son montant,
                l’autorisation du représentant légal est requise conformément aux règles applicables.
              </p>
            </Article>

            <Article id="article-22" title="Article 22 — Réserve de propriété">
              <p>Les produits demeurent la propriété de CALDERA jusqu’au paiement complet du prix.</p>
              <p>Cette clause n’affecte pas les règles légales relatives au transfert des risques au consommateur.</p>
            </Article>

            <Article id="article-23" title="Article 23 — Preuve et archivage">
              <p>
                Les registres informatisés, confirmations de commande, échanges
                électroniques, données de commande et enregistrements de paiement
                conservés dans les systèmes de CALDERA et de ses prestataires
                peuvent constituer des éléments de preuve des commandes, paiements
                et échanges intervenus avec le client, sous réserve des dispositions
                légales applicables et des droits du consommateur.
              </p>
              <p>
                Les contrats conclus par voie électronique pour un montant égal ou
                supérieur au seuil réglementaire font l’objet d’une conservation
                dans les conditions et pendant la durée prévues par le Code de la consommation.
              </p>
              <p>Le consommateur peut demander l’accès au contrat ainsi archivé en contactant CALDERA à :</p>
              <p><a href="mailto:contact@lesterresdecaldera.fr">contact@lesterresdecaldera.fr</a></p>
              <p>
                Les factures et documents devant être conservés au titre des
                obligations comptables ou légales sont archivés pendant la durée légalement requise.
              </p>
            </Article>

            <Article id="article-24" title="Article 24 — Données personnelles">
              <p>
                Les données personnelles collectées dans le cadre des commandes et
                de la gestion de la relation client sont traitées conformément à la
                réglementation applicable en matière de protection des données.
              </p>
              <p>Les informations détaillées relatives notamment :</p>
              <ul>
                <li>aux données collectées ;</li>
                <li>aux finalités des traitements ;</li>
                <li>aux durées de conservation ;</li>
                <li>aux prestataires ;</li>
                <li>aux droits des personnes ;</li>
              </ul>
              <p>figurent dans la <strong>Politique de confidentialité</strong> disponible sur le site.</p>
              <p>CALDERA ne stocke pas directement les numéros complets de carte bancaire.</p>
              <p>Les demandes relatives aux données personnelles peuvent être adressées à :</p>
              <p><a href="mailto:contact@lesterresdecaldera.fr">contact@lesterresdecaldera.fr</a></p>
            </Article>

            <Article id="article-25" title="Article 25 — Propriété intellectuelle">
              <p>
                Les éléments propres à CALDERA et à l’univers Les Terres de
                Caldera, notamment le nom, les créations graphiques, logos, textes,
                photographies, illustrations, éléments narratifs, interfaces et
                contenus originaux, sont protégés par les droits de propriété intellectuelle applicables.
              </p>
              <p>
                Toute reproduction, représentation, adaptation, extraction ou
                réutilisation totale ou partielle de ces éléments est interdite
                sans autorisation préalable de CALDERA, sauf exception prévue par la loi.
              </p>
              <p>
                Les marques, personnages, illustrations, logos et autres éléments
                relatifs à Pokémon appartiennent à leurs titulaires respectifs.
              </p>
              <p>
                CALDERA / Les Terres de Caldera est une boutique indépendante et ne
                prétend détenir aucun droit de propriété intellectuelle sur les
                éléments appartenant à The Pokémon Company, Nintendo, Game Freak,
                Creatures Inc. ou leurs ayants droit respectifs.
              </p>
            </Article>

            <Article id="article-26" title="Article 26 — Droit applicable">
              <p>Les présentes CGV et les ventes conclues sur le site sont soumises au <strong>droit français</strong>.</p>
              <p>
                Le choix du droit français ne prive pas le consommateur des
                dispositions impératives plus protectrices dont il bénéficie
                éventuellement en vertu de la loi de son pays de résidence.
              </p>
            </Article>

            <Article id="article-27" title="Article 27 — Juridictions compétentes">
              <p>
                En cas de litige, le consommateur peut saisir les juridictions
                compétentes conformément aux règles de droit commun.
              </p>
              <p>
                Aucune clause des présentes CGV ne saurait priver le consommateur
                des règles de compétence territoriale protectrices prévues par la loi.
              </p>
            </Article>

            <Article id="annexe" title="ANNEXE — MODÈLE DE DEMANDE DE RÉTRACTATION">
              <p>
                Le consommateur peut utiliser le modèle suivant, sans que son
                utilisation soit obligatoire lorsqu’il exprime sa volonté de se
                rétracter par un autre moyen admis par la loi.
              </p>
              <p><strong>À l’attention de :</strong></p>
              <address className={styles.address}>
                CALDERA
                <br />
                74 rue Pierre Valdo
                <br />
                69005 Lyon
                <br />
                France
                <br />
                E-mail : <a href="mailto:contact@lesterresdecaldera.fr">contact@lesterresdecaldera.fr</a>
              </address>
              <p>
                Je vous informe par la présente de ma décision de me rétracter du
                contrat portant sur la commande suivante :
              </p>
              <div className={styles.formTemplate}>
                <p>Numéro de commande : ____________________________</p>
                <p>Produit(s) concerné(s) : ____________________________</p>
                <p>Date de commande : ____________________________</p>
                <p>Date de réception : ____________________________</p>
                <p>Nom du consommateur : ____________________________</p>
                <p>Adresse du consommateur : ____________________________</p>
                <p>Adresse e-mail : ____________________________</p>
                <p>Date : ____________________________</p>
                <p>Signature du consommateur, uniquement en cas d’envoi papier :</p>
              </div>
            </Article>
          </div>
        </Container>
      </section>
    </main>
  );
}
