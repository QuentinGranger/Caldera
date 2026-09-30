import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import type { HomeCopy, HomeLinks } from '@/components/home/homeData';
import type { ListingHub } from '@/components/catalog/listingHub';
import { DELIVERY_ZONE, handlingLabel } from '@/components/editorial/delivery';
import styles from './Hero.module.scss';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count > 1 ? many : one}`;

/** Real figures of the catalogue, shown as quiet facts under the promise. */
function catalogueFacts(stats: ListingHub['stats']): string[] {
  if (!stats.productCount) return [];
  return [
    `${plural(stats.productCount, 'produit', 'produits')} en ligne`,
    stats.inStockCount > 0 && `${stats.inStockCount} en stock`,
    stats.preorderCount > 0 &&
      `${plural(stats.preorderCount, 'précommande', 'précommandes')}`,
  ].filter((fact): fact is string => Boolean(fact));
}

export function Hero({
  copy,
  links,
  stats,
  next,
}: {
  copy: HomeCopy;
  links: HomeLinks;
  stats: ListingHub['stats'];
  /** Anchor of the first section below, for the scroll cue. */
  next: string;
}) {
  const facts = catalogueFacts(stats);
  return (
    <section
      className={styles.hero}
      aria-labelledby="hero-title"
      data-home-hero=""
    >
      <div className={styles.media} aria-hidden="true">
        <Image
          className={styles.image}
          src="/assets/images/editorial/hero-banner.png"
          alt=""
          fill
          sizes="100vw"
          preload
        />
        <span className={styles.mist} />
      </div>
      <div className={styles.inner}>
        <div className={styles.content}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            Les Terres de Caldera
          </p>
          <h1 id="hero-title">
            Cartes{copy.games ? ` ${copy.games}` : ''} <em>à collectionner.</em>
          </h1>
          <p className={styles.lead}>
            Boutique en ligne de cartes Pokémon et de JCC&nbsp;: produits
            scellés, cartes et accessoires, préparés sous {handlingLabel()} et
            livrés en {DELIVERY_ZONE}.
          </p>
          <div className={styles.actions}>
            {links.catalogue ? (
              <Button href={links.catalogue} variant="gold">
                Parcourir le catalogue <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <Button href="#newsletter" variant="gold">
                Être prévenu de l’ouverture <ArrowRight aria-hidden="true" />
              </Button>
            )}
            <Link href="/univers" className={styles.secondary}>
              Explorer l’univers <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ul className={styles.facts} aria-label="La boutique aujourd’hui">
            {facts.length ? (
              facts.map((fact) => <li key={fact}>{fact}</li>)
            ) : (
              <li>Ouverture prochaine</li>
            )}
          </ul>
        </div>
        <a className={styles.cue} href={next}>
          <span>Entrer dans Caldera</span>
          <ArrowDown size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
