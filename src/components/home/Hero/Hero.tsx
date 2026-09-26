import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { Container } from '@/components/ui/Container/Container';
import type { HomeCopy, HomeLinks } from '@/components/home/homeData';
import styles from './Hero.module.scss';
const SECONDARY: readonly { kind: keyof HomeLinks; label: string }[] = [
  { kind: 'nouveautes', label: 'Voir les nouveautés' },
  { kind: 'precommandes', label: 'Voir les précommandes' },
  { kind: 'en-stock', label: 'Voir les produits en stock' },
];
export function Hero({
  copy,
  links,
  familiesAnchor,
}: {
  copy: HomeCopy;
  links: HomeLinks;
  /** The family grid is shown: #familles exists. */
  familiesAnchor: boolean;
}) {
  const secondary = SECONDARY.find(({ kind }) => links[kind]);
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <Image
        className={styles.image}
        src="/assets/images/editorial/hero-banner.png"
        alt="Volcan en éruption au coucher du soleil, au-dessus des forêts et de la vallée de Caldera"
        fill
        sizes="100vw"
        preload
      />
      <Container className={styles.inner}>
        <div className={styles.content}>
          <p className={styles.eyebrow}>
            <span /> LES TERRES DE CALDERA
          </p>
          <h1 id="hero-title">
            Cartes{copy.games ? ` ${copy.games}` : ''}
            <br />
            <em>à collectionner.</em>
          </h1>
          <p className={styles.description}>{copy.summary}</p>
          {(links.catalogue || secondary) && (
            <div className={styles.actions}>
              {links.catalogue && (
                <Button href={links.catalogue} variant="gold">
                  Parcourir le catalogue <ArrowRight aria-hidden="true" />
                </Button>
              )}
              {secondary && (
                <Link
                  href={links[secondary.kind]!}
                  className={styles.secondary}
                >
                  {secondary.label} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </div>
        <div className={styles.foot}>
          {familiesAnchor ? (
            <a href="#familles">
              <ArrowDown size={16} aria-hidden="true" /> Les familles de
              produits
            </a>
          ) : (
            <span />
          )}
          <span>
            <Compass size={17} aria-hidden="true" /> L’âme d’un collectionneur.
            L’esprit d’un explorateur.
          </span>
        </div>
      </Container>
    </section>
  );
}
