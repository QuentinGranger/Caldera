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
    'Découvrez les Terres de Caldera : un monde né du Grand Effondrement, cinq territoires, des Archives et des routes encore incomplètes.',
  robots: { index: true, follow: true },
};

export default function UniversePage() {
  return (
    <main id="contenu" className={styles.main}>
      <section className={styles.hero} aria-labelledby="universe-title">
        <Image
          src="/assets/images/RouteCinq.png"
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
            Un ancien sommet s’est effondré. À sa place est né un monde de
            falaises, de brumes, de forêts, de terres volcaniques et de routes
            que personne n’a encore fini de tracer.
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
            <h2>Un monde construit autour de la découverte.</h2>
          </div>
          <div>
            <p>
              La Caldera n’est pas un simple cratère. C’est un bassin immense,
              habitable et encore instable, encerclé par cinq territoires que
              des générations d’explorateurs ont appris à relier.
            </p>
            <p>
              On y voyage pour cartographier, observer, échanger, retrouver ce
              que l’on croyait perdu ou simplement rapporter la trace d’un lieu
              que personne n’avait encore décrit.
            </p>
            <p>
              Dans ce monde, un trésor n’est pas défini par son prix. Il l’est
              par l’histoire que quelqu’un a choisi de conserver avec lui.
            </p>
          </div>
        </Container>
      </section>

      <section className={styles.chapters} aria-labelledby="chapters-title">
        <Container>
          <div className={styles.chapterHeading}>
            <Compass size={26} strokeWidth={1.2} aria-hidden="true" />
            <div>
              <p className={styles.eyebrow}>SOMMAIRE DES ARCHIVES</p>
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
