import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  DELIVERY_PATH,
  DELIVERY_ZONE,
  handlingLabel,
} from '@/components/editorial/delivery';
import { ORGANIZATION, RETURN_POLICY } from '@/lib/seo/policies';
import styles from './Assurances.module.scss';

/**
 * What ordering here actually involves. Each promise comes from a page of
 * the site (CGV, delivery, withdrawal) or from how the shop works: nothing
 * is written here that the shop does not do.
 */
export function Assurances() {
  const promises = [
    {
      title: 'Paiement sécurisé',
      text: 'Par Stripe : vos données bancaires ne passent jamais par nos serveurs.',
      href: '/cgv',
      link: 'Conditions de vente',
    },
    {
      title: `Expédié sous ${handlingLabel()}`,
      text: `Après confirmation du paiement, livraison en ${DELIVERY_ZONE}.`,
      href: DELIVERY_PATH,
      link: 'Livraison',
    },
    {
      title: 'Suivi de commande',
      text: 'Confirmation et expédition par e-mail, historique dans votre compte.',
      href: '/compte/connexion',
      link: 'Mon compte',
    },
    {
      title: `${RETURN_POLICY.days} jours pour changer d’avis`,
      text: 'Droit de rétractation à compter de la réception de la commande.',
      href: '/retractation',
      link: 'Se rétracter',
    },
  ];
  return (
    <section className={styles.section} aria-labelledby="assurances-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>Commander à Caldera</p>
          <h2 id="assurances-title">
            Explorer librement, <em>acheter sereinement.</em>
          </h2>
        </header>
        <ol className={styles.list}>
          {promises.map((promise, index) => (
            <li key={promise.title}>
              <span className={styles.number} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{promise.title}</h3>
              <p>{promise.text}</p>
              <Link href={promise.href} className={styles.link}>
                {promise.link} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
        <p className={styles.contact}>
          Une question avant de commander&nbsp;?{' '}
          <Link href="/contact">Écrivez-nous</Link> ou{' '}
          <a href={`mailto:${ORGANIZATION.email}`}>{ORGANIZATION.email}</a>
        </p>
      </div>
    </section>
  );
}
