import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { Container } from '@/components/ui/Container/Container';
import styles from './Hero.module.scss';
export function Hero() {
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
            Entrez dans les terres
            <br />
            de la <em>collection.</em>
          </h1>
          <p className={styles.description}>
            Cartes, coffrets et objets de collection
            <br className={styles.desktopBreak} /> sélectionnés pour les
            passionnés.
          </p>
          <div className={styles.actions}>
            <Button href="/catalogue" variant="gold">
              Explorer la boutique <ArrowRight aria-hidden="true" />
            </Button>
            <Link href="/nouveautes" className={styles.secondary}>
              Voir les nouveautés <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className={styles.foot}>
          <a href="#pokemon">
            <ArrowDown size={16} aria-hidden="true" /> Un nouveau territoire
            vous attend
          </a>
          <span>
            <Compass size={17} aria-hidden="true" /> L’âme d’un collectionneur.
            L’esprit d’un explorateur.
          </span>
        </div>
      </Container>
    </section>
  );
}
