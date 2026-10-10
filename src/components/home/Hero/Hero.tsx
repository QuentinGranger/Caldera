import { ArrivalLayers } from '@/components/transitions/ArrivalLayers';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ViewTransition } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { HOME_PROMISE, type HomeLinks } from '@/components/home/homeData';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import {
  LANDSCAPE_REVEAL,
  WORLD_HERO,
  WORLD_HERO_NAME,
} from '@/lib/transitions/classes';
import styles from './Hero.module.scss';

/**
 * The landscape and who Caldera is for, in one glance: the specialty above
 * the title, the promise under it, the shop first and the universe second.
 * Shorter than the screen: the shop's first products show beneath it.
 */
export function Hero({ links }: { links: HomeLinks }) {
  return (
    // Into the universe, the landscape carries the visitor in.
    <section
      className={styles.hero}
      aria-labelledby="hero-title"
      data-home-hero=""
      data-scroll-scene="hero"
    >
      <div className={styles.stage}>
        <ViewTransition
          name={WORLD_HERO_NAME}
          share={WORLD_HERO}
          enter={LANDSCAPE_REVEAL}
          exit={LANDSCAPE_REVEAL}
          default="none"
        >
          <div
            className={styles.landscape}
            data-caldera-landscape
            data-depth-landscape
          >
            <div className={styles.media} aria-hidden="true">
              <Image
                className={styles.image}
                src="/assets/images/editorial/hero-banner.png"
                alt=""
                fill
                sizes="(max-width: 47.99rem) 180vh, 100vw"
                preload
              />
              <span className={styles.mist} />
            </div>
          </div>
        </ViewTransition>
        <div className={styles.inner}>
          <div className={styles.content}>
            <ArrivalLayers>
              <p className={styles.eyebrow}>
                <span aria-hidden="true" />
                Les Terres de Caldera · {'Pokémon\u00a0TCG'}
              </p>
              <h1 id="hero-title">
                Une carte. <em>Tout un univers.</em>
              </h1>
              <p className={styles.lead}>{HOME_PROMISE}</p>
              <div className={styles.actions}>
                {/* Nothing online yet: the invitation to hear of the opening. */}
                {links.catalogue ? (
                  <Button href={links.catalogue} variant="gold">
                    {ALL_PRODUCTS_LABEL} <ArrowRight aria-hidden="true" />
                  </Button>
                ) : (
                  <Button href="#newsletter" variant="gold">
                    Être prévenu de l’ouverture{' '}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
                <Link href="/univers" className={styles.secondary}>
                  Découvrir l’univers{' '}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </ArrivalLayers>
          </div>
        </div>
      </div>
    </section>
  );
}
