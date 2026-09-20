import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import styles from './EditorialSection.module.scss';
export function EditorialSection() {
  return (
    <section
      id="univers"
      className={styles.section}
      aria-labelledby="editorial-title"
    >
      <Container className={styles.grid}>
        <div className={styles.visual}>
          <Image
            src="/assets/images/editorial/foret.png"
            alt="Sentier forestier surplombant des cascades et un volcan en éruption"
            fill
            sizes="(min-width: 1200px) 600px, (min-width: 768px) 45vw, 100vw"
          />
          <span>NOTRE UNIVERS — CALDERA</span>
        </div>
        <div className={styles.text}>
          <p className={styles.eyebrow}>
            L’histoire ne s’arrête pas à la carte
          </p>
          <h2 id="editorial-title">
            Au-delà de
            <br />
            la collection.
          </h2>
          <p className={styles.lead}>
            Le frisson d’une découverte.
            <br />
            Le plaisir de la garder.
          </p>
          <p>
            Chaque extension ouvre un nouveau territoire. Nous sélectionnons les
            produits qui méritent une place dans votre collection.
          </p>
          <p>
            Caldera est née de cette envie : donner à la passion un lieu à part.
            Un refuge pour les curieux, les amoureux des belles illustrations et
            les collectionneurs de toujours.
          </p>
          <Link href="/univers">
            Poursuivre l’exploration{' '}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
