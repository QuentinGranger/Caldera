import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import {
  DELIVERY_PATH,
  DELIVERY_ZONE,
  handlingLabel,
} from '@/components/editorial/delivery';
import { getSiteNavigation, type NavLink } from '@/data/navigation';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
import { ORGANIZATION } from '@/lib/seo/policies';
import styles from './Footer.module.scss';

/**
 * The end of every page: the brand and its two ways to stay in touch (the
 * newsletter, a real address), then the whole site in four columns. The
 * service line only repeats what the CGV state.
 */
export async function Footer() {
  const demonstration = process.env.CATALOG_DEMO_MODE === '1';
  const navigation = await getSiteNavigation();
  const groups: { title: string; links: NavLink[] }[] = [
    {
      title: 'Boutique',
      links: [
        navigation.catalogue,
        ...navigation.games.map(({ href, label }) => ({ href, label })),
        ...navigation.productTypes,
        ...navigation.listings,
      ],
    },
    {
      title: 'Explorer',
      links: [
        navigation.universe,
        { label: 'Les territoires', href: '/univers/territoires' },
        navigation.extensions,
        navigation.calendar,
        navigation.guides,
        ...(navigation.news ? [navigation.news] : []),
      ],
    },
    {
      title: 'Aide',
      links: [
        navigation.delivery,
        ...(navigation.questions ? [navigation.questions] : []),
        navigation.contact,
        navigation.account,
      ],
    },
    {
      title: 'Légal',
      links: [
        { label: 'Mentions légales', href: '/mentions-legales' },
        { label: 'Conditions de vente', href: '/cgv' },
        { label: 'Confidentialité', href: '/confidentialite' },
      ],
    },
  ];
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.lead}>
          <div className={styles.brand}>
            <Link href="/" aria-label="Les Terres de Caldera — Accueil">
              <Image
                src="/assets/brand/logo-header-no-bg.png"
                alt=""
                width={1774}
                height={887}
                sizes="176px"
              />
            </Link>
            <p className={styles.statement}>
              Pour ceux qui collectionnent <em>bien plus que des cartes.</em>
            </p>
          </div>
          <div className={styles.contact}>
            <div className={styles.letter}>
              <p className={styles.label}>La lettre de Caldera</p>
              <p>Réassorts, nouvelles extensions et sélections, par e-mail.</p>
              <Link href="/#newsletter" className={styles.link}>
                S’inscrire <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div>
              <p className={styles.label}>Une question ?</p>
              <p>
                <a href={`mailto:${ORGANIZATION.email}`}>
                  {ORGANIZATION.email}
                </a>
              </p>
              <Link href={navigation.contact.href} className={styles.link}>
                Nous écrire <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Plan du site">
          {groups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.bottom}>
          <p>
            © {new Date().getFullYear()} Les Terres de Caldera ·{' '}
            <Link href={PRODUCTION_SITE_URL}>{PRODUCTION_HOST}</Link>
          </p>
          <p>
            {demonstration ? (
              'Catalogue de démonstration · Aucun achat ni expédition'
            ) : (
              <>
                Paiement sécurisé par Stripe ·{' '}
                <Link href={DELIVERY_PATH}>
                  Expédition sous {handlingLabel()} en {DELIVERY_ZONE}
                </Link>
              </>
            )}
          </p>
          {/* « #top » without a target: the browser scrolls to the very top. */}
          <a href="#top" className={styles.top}>
            Haut de page <ArrowUp size={14} aria-hidden="true" />
          </a>
        </div>
      </Container>
    </footer>
  );
}
