import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
import styles from './Footer.module.scss';
const groups = [
  {
    title: 'Caldera',
    links: [
      { label: 'Notre univers', href: '/univers' },
      { label: 'Notre sélection', href: '/#selection' },
    ],
  },
  {
    title: 'Boutique',
    links: [
      { label: 'Pokémon', href: '/catalogue' },
      { label: 'Scellés', href: '/categorie/scelles' },
      { label: 'Cartes', href: '/categorie/cartes' },
      { label: 'Accessoires', href: '/categorie/accessoires' },
      { label: 'Précommandes', href: '/precommandes' },
      { label: 'Extensions', href: '/extensions' },
    ],
  },
  {
    title: 'Aide',
    links: [
      { label: 'Livraison', href: '/livraison' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact', href: '/faq#besoin-aide' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Mentions légales' },
      { label: 'CGV' },
      { label: 'Confidentialité' },
    ],
  },
];
export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link href="/" aria-label="Caldera — Accueil">
              <Image
                src="/assets/brand/logo-header-no-bg.png"
                alt="Les Terres de Caldera"
                width={1774}
                height={887}
                sizes="230px"
              />
            </Link>
            <p>
              Pour ceux qui collectionnent
              <br />
              bien plus que des cartes.
            </p>
            <Link className={styles.backTop} href="#contenu">
              Retour à l’exploration{' '}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {groups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    {'href' in link ? (
                      <Link href={link.href}>{link.label}</Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        title="Page disponible à l’ouverture de la boutique"
                      >
                        {link.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.bottom}>
          <p>
            © {new Date().getFullYear()} Les Terres de Caldera ·{' '}
            <Link href={PRODUCTION_SITE_URL}>{PRODUCTION_HOST}</Link>
          </p>
          <p>Boutique indépendante · Cartes et produits de collection</p>
          <span>Explorez. Collectionnez.</span>
        </div>
      </Container>
    </footer>
  );
}
