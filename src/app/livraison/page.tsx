import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import {
  DELIVERY_PATH,
  DELIVERY_ZONE,
  getDeliveryPage,
  handlingLabel,
  priceLabel,
  transitLabel,
} from '@/components/editorial/delivery';
import { editorialMetadata } from '@/components/editorial/editorial';
import { EditorialHeader } from '@/components/editorial/EditorialParts';
import { formatEuro, listFr } from '@/lib/seo/metadata';
import { RETURN_POLICY } from '@/lib/seo/policies';
import styles from '@/components/editorial/Editorial.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const page = await getDeliveryPage();
  return editorialMetadata({ ...page.text, decision: page.decision });
}

export default async function DeliveryPage() {
  await connection();
  const { methods } = await getDeliveryPage();
  const handling = handlingLabel();
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Livraison' }]}
          currentPath={DELIVERY_PATH}
        />
        <EditorialHeader
          eyebrow="Commande et expédition"
          title="Livraison"
          lead={`Livraison en ${DELIVERY_ZONE}. Les commandes sont préparées et expédiées sous ${handling} après confirmation du paiement.`}
        />

        <section className={styles.section} aria-labelledby="modes-titre">
          <h2 id="modes-titre">Modes de livraison et tarifs</h2>
          {methods.length > 0 ? (
            <div
              className={styles.tableScroll}
              role="region"
              aria-labelledby="modes-legende"
              tabIndex={0}
            >
              <table className={styles.table}>
                <caption id="modes-legende">
                  Modes proposés à la commande, tarifs et délais indicatifs du
                  transporteur après expédition.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Mode de livraison</th>
                    <th scope="col">Tarif</th>
                    <th scope="col">Livraison offerte</th>
                    <th scope="col">Délai indicatif</th>
                    <th scope="col">Pays desservis</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((method) => (
                    <tr key={method.code}>
                      <th scope="row">
                        {method.name}
                        {method.description && (
                          <span className={styles.methodNote}>
                            {method.description}
                          </span>
                        )}
                      </th>
                      <td>{priceLabel(method.price)}</td>
                      <td>
                        {method.freeFromAmount
                          ? `Dès ${formatEuro(method.freeFromAmount)} d’achat`
                          : 'Non'}
                      </td>
                      <td>{transitLabel(method) ?? 'Non communiqué'}</td>
                      <td>
                        {listFr(
                          method.destinations.map(
                            (destination) => destination.name,
                          ),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.notice}>
              Les modes de livraison disponibles et leurs tarifs sont indiqués
              au moment de la commande.
            </p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="delais-titre">
          <h2 id="delais-titre">Préparation et délais</h2>
          <div className={styles.textBlock}>
            <p>
              Les commandes sont normalement préparées et expédiées sous{' '}
              <strong>{handling} après confirmation du paiement</strong>. Ce
              délai correspond à la préparation et à la remise au transporteur :
              {methods.length > 0
                ? ' le délai indicatif de chaque mode s’y ajoute.'
                : ' il ne constitue pas nécessairement le délai total de livraison.'}
            </p>
            <p>
              Les délais des transporteurs sont estimatifs et peuvent être
              affectés par un retard du transporteur ou un cas de force majeure,
              sans priver le client des droits que lui reconnaît la loi.
            </p>
            <p>
              Conditions complètes :{' '}
              <Link href="/cgv#article-10">
                article 10 des conditions générales de vente
              </Link>
              .
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="reception-titre">
          <h2 id="reception-titre">Réception et retours</h2>
          <div className={styles.textBlock}>
            <p>
              Vérifiez l’état extérieur du colis à sa réception. En cas de colis
              ou de produit endommagé, incorrect ou non conforme, écrivez-nous
              dans les meilleurs délais depuis la{' '}
              <Link href="/contact">page de contact</Link>, avec votre numéro de
              commande et, si possible, des photos.
            </p>
            <p>
              Vous disposez de <strong>{RETURN_POLICY.days} jours</strong> pour
              exercer votre droit de rétractation, en principe à compter de la
              réception ; les frais directs de retour sont à votre charge, sauf
              disposition légale contraire. Détails :{' '}
              <Link href={RETURN_POLICY.path}>
                article 12 des conditions générales de vente
              </Link>
              .
            </p>
          </div>
        </section>
      </Container>
    </main>
  );
}
