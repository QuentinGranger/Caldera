import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  DELIVERY_PATH,
  DELIVERY_ZONE,
  handlingLabel,
} from '@/components/editorial/delivery';
import { ORGANIZATION, RETURN_POLICY } from '@/lib/seo/policies';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import styles from './Assurances.module.scss';

/**
 * What ordering here actually involves. Each promise comes from a page of
 * the site (CGV, delivery, withdrawal) or from how the shop works: nothing
 * is written here that the shop does not do.
 */
export function Assurances() {
  const demonstration = process.env.CATALOG_DEMO_MODE === '1';
  const promises = demonstration
    ? [
        {
          title: 'Découvrir les produits',
          text: 'Parcourez les produits d’exemple pour découvrir Caldera. Aucun achat n’est encore possible.',
          href: '/catalogue',
          link: ALL_PRODUCTS_LABEL,
        },
        {
          title: 'Garder vos favoris',
          text: 'Retrouvez les produits que vous avez enregistrés dans votre sélection.',
          href: '/favoris',
          link: 'Mes favoris',
        },
        {
          title: 'Rejoindre la communauté',
          text: 'Votre espace compte permet de relier votre compte Discord à Caldera.',
          href: '/compte/connexion',
          link: 'Mon compte',
        },
        {
          title: 'Échanger avec Caldera',
          text: 'Une question sur le projet ? Notre formulaire de contact est à votre disposition.',
          href: '/contact',
          link: 'Nous écrire',
        },
      ]
    : [
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
    <section
      id="garanties"
      className={styles.section}
      aria-labelledby="assurances-title"
    >
      <div className={styles.inner}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>
            {demonstration ? 'Découvrir Caldera' : 'Commander à Caldera'}
          </p>
          <h2 id="assurances-title">
            Explorer librement,{' '}
            <em>
              {demonstration ? 'préparer la suite.' : 'acheter sereinement.'}
            </em>
          </h2>
        </header>
        <ol className={styles.list}>
          {promises.map((promise, index) => (
            <li key={promise.title} data-journey-item="promise">
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
          {demonstration
            ? 'Une question sur Caldera ?'
            : 'Une question avant de commander ?'}{' '}
          <Link href="/contact">Écrivez-nous</Link> ou{' '}
          <a href={`mailto:${ORGANIZATION.email}`}>{ORGANIZATION.email}</a>
        </p>
      </div>
    </section>
  );
}
