import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { getSiteNavigation, type NavLink } from '@/data/navigation';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
import styles from './Footer.module.scss';
export async function Footer() {
  const navigation = await getSiteNavigation();
  const groups: { title: string; links: NavLink[] }[] = [
    {
      title: 'Caldera',
      links: [
        { label: 'Notre univers', href: navigation.universe.href },
        { label: 'Notre sélection', href: '/#selection' },
      ],
    },
    {
      title: 'Boutique',
      links: [
        ...(navigation.catalogue ? [navigation.catalogue] : []),
        ...navigation.games.map(({ href, label }) => ({ href, label })),
        ...navigation.familyHubs,
        ...navigation.listings,
        navigation.extensions,
        navigation.calendar,
      ],
    },
    {
      title: 'Aide',
      links: [
        navigation.delivery,
        navigation.guides,
        navigation.glossary,
        ...(navigation.questions ? [navigation.questions] : []),
        ...(navigation.news ? [navigation.news] : []),
        navigation.contact,
      ],
    },
    {
      title: 'Légal',
      links: [
        { label: 'Mentions légales', href: '/mentions-legales' },
        { label: 'CGV', href: '/cgv' },
        { label: 'Confidentialité', href: '/confidentialite' },
      ],
    },
  ];
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
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
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
          <p>Boutique en préparation · Produits et prix de démonstration</p>
          <span>Explorez. Collectionnez.</span>
        </div>
      </Container>
    </footer>
  );
}
