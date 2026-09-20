import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { universeChapters } from '@/data/universe';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'Les Terres de Caldera | Univers & chroniques',
  description:
    'Entrez dans les chroniques des Terres de Caldera et découvrez ses origines, ses Archives, ses cinq territoires et ses routes encore inconnues.',
  robots: { index: true, follow: true },
};

export default function UniversePage() {
  return (
    <main id="contenu" className={styles.main}>
      <section className={styles.hero} aria-labelledby="universe-title">
        <Image
          src="/assets/images/editorial/hero-banner.png"
          alt=""
          fill
          preload
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <Container className={styles.heroInner}>
          <p className={styles.eyebrow}>LES TERRES DE CALDERA</p>
          <h1 id="universe-title">
            Là où la terre
            <br />
            s’est <em>ouverte.</em>
          </h1>
          <p className={styles.heroLead}>
            Personne ne sait exactement quand le sommet s’est effondré. Depuis,
            les cartes se remplissent lentement de routes, d’archives et
            d’histoires rapportées par ceux qui ont choisi d’explorer.
          </p>
          <Link className={styles.primaryCta} href="/univers/origines">
            Commencer par les origines
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </Container>
      </section>

      <section className={styles.intro}>
        <Container className={styles.introGrid}>
          <div>
            <p className={styles.eyebrow}>LES CHRONIQUES</p>
            <h2>Un monde à lire comme une carte.</h2>
          </div>
          <div>
            <p>
              Pour rendre le lore agréable à découvrir, l’histoire est organisée
              en cinq chroniques courtes plutôt qu’en une seule longue page.
            </p>
            <p>
              Vous pouvez les lire dans l’ordre ou entrer directement dans le
              chapitre qui vous intéresse.
            </p>
          </div>
        </Container>
      </section>

      <section className={styles.chapters} aria-labelledby="chapters-title">
        <Container>
          <div className={styles.chapterHeading}>
            <Compass size={26} strokeWidth={1.2} aria-hidden="true" />
            <div>
              <p className={styles.eyebrow}>SOMMAIRE</p>
              <h2 id="chapters-title">Choisir une chronique</h2>
            </div>
          </div>

          <ol className={styles.chapterGrid}>
            {universeChapters.map((chapter) => (
              <li key={chapter.slug}>
                <Link href={`/univers/${chapter.slug}`}>
                  <span className={styles.chapterNumber}>{chapter.number}</span>
                  <div>
                    <p>{chapter.label}</p>
                    <h3>{chapter.title}</h3>
                    <span className={styles.chapterDescription}>
                      {chapter.description}
                    </span>
                  </div>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className={styles.closing}>
        <Container className={styles.closingInner}>
          <p className={styles.eyebrow}>PRINCIPE DES ARCHIVES</p>
          <blockquote>
            « Ce qui mérite d’être gardé mérite d’être raconté. »
          </blockquote>
          <p>
            Les Terres de Caldera est l’univers éditorial original de la
            boutique. Les univers et marques des produits proposés restent la
            propriété de leurs ayants droit respectifs.
          </p>
        </Container>
      </section>
    </main>
  );
}
