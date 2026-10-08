import { ArrivalLayers } from '@/components/transitions/ArrivalLayers';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { NewsletterCta } from '@/components/newsletter/NewsletterCta';
import { universeIndexMetadata } from '@/components/universe/metadata';
import {
  universeChapterPath,
  universeChapters,
  universeImage,
  universeIndex,
} from '@/data/universe';
import { ViewTransition } from 'react';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import {
  LANDSCAPE_REVEAL,
  WORLD_HERO,
  WORLD_HERO_NAME,
} from '@/lib/transitions/classes';
import styles from './page.module.scss';

export const metadata = universeIndexMetadata();

export default function UniversePage() {
  const hero = universeImage(universeIndex.hero.src, universeIndex.hero.alt);
  return (
    <main id="contenu" className={styles.main}>
      {/* Its landscape opens onto each chronicle's. */}
      <section className={styles.hero} aria-labelledby="universe-title">
        <ViewTransition
          name={WORLD_HERO_NAME}
          share={WORLD_HERO}
          enter={LANDSCAPE_REVEAL}
          exit={LANDSCAPE_REVEAL}
          default="none"
        >
          <div className={styles.landscape} data-caldera-landscape>
            {hero && (
              <Image
                src={hero.src}
                alt={hero.alt}
                fill
                preload
                sizes="100vw"
                className={styles.heroImage}
              />
            )}
            <div className={styles.heroShade} aria-hidden="true" />
          </div>
        </ViewTransition>
        <Container className={styles.heroInner}>
          <ArrivalLayers>
            <div className={styles.heroBreadcrumb}>
              <Breadcrumb
                items={[{ label: 'Accueil', href: '/' }, { label: 'Univers' }]}
                currentPath={universeIndex.path}
              />
            </div>
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
            <Link
              className={styles.primaryCta}
              href={universeChapterPath('origines')}
            >
              Commencer par les origines
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </ArrivalLayers>
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
                <Link href={universeChapterPath(chapter.slug)}>
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
          <NewsletterCta
            eyebrow="Carnet d’exploration"
            title="Recevez la suite des chroniques"
          >
            Les nouvelles histoires, sélections et arrivages de Caldera,
            directement dans votre boîte mail.
          </NewsletterCta>
        </Container>
      </section>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: universeIndex.path,
            name: universeIndex.title,
            mainEntity: itemListNode(
              universeChapters.map((chapter) => ({
                path: universeChapterPath(chapter.slug),
                name: chapter.title,
              })),
            ),
          }),
        )}
      />
    </main>
  );
}
