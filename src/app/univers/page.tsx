import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Compass,
  Flame,
  Mountain,
  Trees,
  Waves,
} from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'L’univers de Caldera | Les Terres de Caldera',
  description:
    'Découvrez le lore original des Terres de Caldera : ses régions, ses légendes et l’esprit d’exploration qui guide la boutique.',
  robots: { index: true, follow: true },
};

const territories = [
  {
    id: 'coeur',
    number: 'I',
    name: 'La Caldera',
    subtitle: 'Le cœur des terres',
    text: 'Une vaste couronne de roche noire entoure le cratère ancien. C’est ici que commencent les récits, là où la chaleur du sol rencontre les brumes venues des vallées.',
    icon: Flame,
  },
  {
    id: 'braise',
    number: 'II',
    name: 'Les Terres de Braise',
    subtitle: 'La roche garde la mémoire',
    text: 'Des plateaux minéraux, des veines rouges et des reliefs façonnés par le feu. Les découvertes les plus rares y sont racontées comme des fragments arrachés à la montagne.',
    icon: Compass,
  },
  {
    id: 'forets',
    number: 'III',
    name: 'Les Forêts anciennes',
    subtitle: 'Sous la canopée',
    text: 'Un territoire humide et profond, traversé de sentiers oubliés. On y avance lentement, avec l’idée qu’une découverte importante se cache toujours un peu plus loin.',
    icon: Trees,
  },
  {
    id: 'hautes-terres',
    number: 'IV',
    name: 'Les Hautes Terres',
    subtitle: 'Au-dessus des brumes',
    text: 'Des lignes de crête, du vent et des horizons presque vides. C’est le territoire de la distance, des pièces convoitées longtemps et des collections construites avec patience.',
    icon: Mountain,
  },
  {
    id: 'rivages',
    number: 'V',
    name: 'Les Rivages',
    subtitle: 'Là où les routes se rencontrent',
    text: 'Les eaux de Caldera ouvrent les terres vers l’extérieur. Les arrivages, les échanges et les objets venus de loin passent par ces rivages avant de rejoindre les collections.',
    icon: Waves,
  },
];

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
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>CHRONIQUES DE CALDERA</p>
            <h1 id="universe-title">
              Les terres
              <br />
              avant les <em>trésors.</em>
            </h1>
            <p className={styles.heroLead}>
              Avant d’être une boutique, Caldera est un territoire imaginaire :
              un monde de reliefs, de chemins et de découvertes pensé autour de
              la passion de collectionner.
            </p>
          </div>
          <a className={styles.heroAnchor} href="#origine">
            Entrer dans les chroniques
            <ArrowDown size={16} aria-hidden="true" />
          </a>
        </Container>
      </section>

      <section id="origine" className={styles.origin}>
        <Container className={styles.originGrid}>
          <div className={styles.originVisual}>
            <Image
              src="/assets/images/editorial/foret.png"
              alt="Sentier forestier dominant les vallées de Caldera"
              fill
              sizes="(min-width: 75rem) 48vw, 100vw"
            />
            <span>ARCHIVE I — ORIGINES</span>
          </div>

          <div className={styles.originCopy}>
            <p className={styles.eyebrow}>LE MONDE</p>
            <h2>Un refuge pour ceux qui cherchent encore.</h2>
            <p className={styles.lead}>
              Caldera n’est pas née d’un royaume ou d’une guerre. Elle est née
              d’un geste plus simple : partir chercher quelque chose et revenir
              avec une histoire.
            </p>
            <p>
              Au centre des terres repose un ancien cratère. Autour de lui, les
              paysages se sont organisés comme les pages d’un carnet
              d’exploration : forêts profondes, plateaux de braise, montagnes
              battues par le vent et rivages ouverts sur l’ailleurs.
            </p>
            <p>
              Les habitants des récits de Caldera appellent « trésor » tout
              objet capable de conserver une émotion, un souvenir ou la trace
              d’un voyage. C’est cette idée qui relie l’univers de la marque à
              la collection.
            </p>
          </div>
        </Container>
      </section>

      <section className={styles.territories} aria-labelledby="territories-title">
        <Container>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>CARTOGRAPHIE</p>
              <h2 id="territories-title">Cinq territoires. Une même histoire.</h2>
            </div>
            <p>
              Chaque région donne à Caldera une tonalité différente. Elles
              servent de langage visuel et narratif à la boutique, sans
              remplacer les univers officiels des produits proposés.
            </p>
          </div>

          <div className={styles.territoryGrid}>
            {territories.map(({ id, number, name, subtitle, text, icon: Icon }) => (
              <article key={id} id={id} className={styles.territoryCard}>
                <div className={styles.territoryTop}>
                  <span>{number}</span>
                  <Icon size={22} strokeWidth={1.35} aria-hidden="true" />
                </div>
                <p>{subtitle}</p>
                <h3>{name}</h3>
                <div className={styles.territoryRule} aria-hidden="true" />
                <p className={styles.territoryText}>{text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className={styles.archive} aria-labelledby="archive-title">
        <Container className={styles.archiveGrid}>
          <div className={styles.archiveCopy}>
            <BookOpen size={34} strokeWidth={1.15} aria-hidden="true" />
            <p className={styles.eyebrow}>LES ARCHIVES</p>
            <h2 id="archive-title">Collectionner, c’est garder une trace.</h2>
            <p className={styles.archiveLead}>
              Dans les récits de Caldera, les objets rapportés d’expédition sont
              consignés dans les Archives : pas pour leur prix, mais pour ce
              qu’ils représentent.
            </p>
            <p>
              Une illustration que l’on n’oublie pas. Un coffret attendu
              pendant des mois. Une série commencée par hasard. Une pièce que
              l’on transmet. La collection prend de la valeur parce qu’elle
              raconte quelque chose de personnel.
            </p>
            <Link href="/catalogue">
              Explorer les collections
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.archiveVisual}>
            <Image
              src="/assets/images/editorial/mountains.jpg"
              alt="Reliefs montagneux évoquant les Hautes Terres de Caldera"
              fill
              sizes="(min-width: 75rem) 48vw, 100vw"
            />
            <div className={styles.archiveStamp}>
              <Compass size={18} strokeWidth={1.25} aria-hidden="true" />
              <span>CALDERA — ARCHIVES DES EXPLORATEURS</span>
            </div>
          </div>
        </Container>
      </section>

      <section className={styles.manifesto}>
        <Container className={styles.manifestoInner}>
          <p className={styles.eyebrow}>L’ESPRIT DE CALDERA</p>
          <blockquote>
            « Une collection n’est jamais seulement ce que l’on possède.
            <br />
            C’est la carte de tout ce que l’on a choisi de chercher. »
          </blockquote>
          <div className={styles.manifestoActions}>
            <Link href="/catalogue">
              Entrer dans la boutique
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/">Retour à l’accueil</Link>
          </div>
          <p className={styles.legalNote}>
            Les Terres de Caldera est l’univers éditorial original de la
            boutique. Les marques, personnages et univers des jeux de cartes
            proposés appartiennent à leurs ayants droit respectifs.
          </p>
        </Container>
      </section>
    </main>
  );
}
