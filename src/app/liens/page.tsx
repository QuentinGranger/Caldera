import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  Mail,
  MessagesSquare,
} from 'lucide-react';
import { DISCORD_INVITE_URL } from '@/data/community';
import { buildMetadata } from '@/lib/seo/metadata';
import { INSTAGRAM_PROFILE_URL } from '@/lib/social';
import styles from './page.module.scss';

export const metadata = buildMetadata({
  title: 'Boutique, Discord et newsletter',
  description:
    'Tous les chemins vers Les Terres de Caldera : découvrez notre boutique de cartes Pokémon, rejoignez le Discord et inscrivez-vous à la newsletter.',
  path: '/liens',
  index: true,
});

export default function LinksPage() {
  const preparing =
    process.env.CATALOG_DEMO_MODE === '1' || process.env.STORE_OPEN !== '1';

  const destinations = [
    {
      href: '/newsletter',
      icon: Mail,
      eyebrow: 'La lettre de Caldera',
      title: preparing
        ? 'Être prévenu de l’ouverture'
        : 'Recevoir les nouvelles',
      description: preparing
        ? 'Les annonces de Caldera, par e-mail.'
        : 'Sorties, réassorts et sélections, à votre rythme.',
      featured: preparing,
    },
    {
      href: '/',
      icon: Compass,
      eyebrow: 'Le site officiel',
      title: preparing ? 'Découvrir la boutique' : 'Explorer la boutique',
      description: preparing
        ? 'Notre univers et le catalogue de démonstration.'
        : 'Cartes Pokémon, boosters, coffrets et collections.',
      featured: !preparing,
    },
    {
      href: DISCORD_INVITE_URL,
      icon: MessagesSquare,
      eyebrow: 'La communauté',
      title: 'Rejoindre le Discord',
      description: 'Échanger entre passionnés de cartes.',
      external: true,
    },
    {
      href: '/guides',
      icon: BookOpen,
      eyebrow: 'Les repères',
      title: 'Les guides du collectionneur',
      description: 'Comprendre, choisir et protéger ses cartes.',
    },
  ];

  // The shop becomes the first destination once commercial sales open.
  if (!preparing)
    [destinations[0], destinations[1]] = [destinations[1]!, destinations[0]!];

  return (
    <main id="contenu" tabIndex={-1} data-caldera-links className={styles.main}>
      <div className={styles.landscape} aria-hidden="true">
        <Image
          src="/assets/images/editorial/hero-banner.png"
          alt=""
          fill
          preload
          sizes="100vw"
          className={styles.landscapeImage}
        />
      </div>

      <div className={styles.shell}>
        <header className={styles.intro}>
          <Link
            href="/"
            className={styles.emblem}
            aria-label="Caldera — Accueil"
          >
            <Image src="/favicon.png" alt="" width={88} height={88} />
          </Link>
          <p className={styles.eyebrow}>Cartes Pokémon &amp; JCC</p>
          <h1>
            Les Terres <em>de Caldera.</em>
          </h1>
          <p className={styles.motto}>Collectionner. Jouer. Explorer.</p>
          <div className={styles.signature} aria-hidden="true">
            <span />
            <Compass size={22} strokeWidth={1} />
            <span />
          </div>
          <p className={styles.independent}>Boutique française indépendante</p>
        </header>

        <div className={styles.destinations}>
          <p className={styles.invitation}>À chaque envie, son chemin.</p>
          <nav aria-label="Les liens officiels de Caldera">
            {destinations.map(
              ({
                href,
                icon: Icon,
                eyebrow,
                title,
                description,
                featured,
                external,
              }) => (
                <Link
                  key={href}
                  href={href}
                  className={`${styles.card} ${featured ? styles.featured : ''}`}
                  {...(external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  <span className={styles.icon}>
                    <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className={styles.cardText}>
                    <span className={styles.cardEyebrow}>{eyebrow}</span>
                    <span className={styles.cardTitle}>{title}</span>
                    <span className={styles.cardDescription}>
                      {description}
                    </span>
                  </span>
                  {external ? (
                    <ArrowUpRight
                      className={styles.arrow}
                      size={19}
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight
                      className={styles.arrow}
                      size={19}
                      aria-hidden="true"
                    />
                  )}
                  {external && (
                    <span className={styles.srOnly}> (nouvel onglet)</span>
                  )}
                </Link>
              ),
            )}
          </nav>
          <footer className={styles.footer}>
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.instagram}
            >
              <ArrowUpRight size={16} aria-hidden="true" />
              @lesterresdecaldera
              <span className={styles.srOnly}>
                {' '}
                sur Instagram (nouvel onglet)
              </span>
            </a>
            <div className={styles.footerLinks}>
              <Link href="/contact">Nous écrire</Link>
              <span aria-hidden="true">·</span>
              <Link href="/confidentialite">Confidentialité</Link>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
