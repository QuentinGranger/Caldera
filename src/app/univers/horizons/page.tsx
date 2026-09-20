import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'Horizons inconnus | L’univers de Caldera',
  description:
    'Les cartes incomplètes, les mystères et l’esprit qui donne son sens aux Terres de Caldera.',
};

export default function HorizonsPage() {
  return (
    <UniverseChapterShell
      slug="horizons"
      title="Horizons inconnus"
      kicker="Dernières pages"
      lead="Les Archivistes laissent volontairement certaines zones blanches. Une carte terminée signifierait qu’il ne reste plus rien à découvrir."
      image="/assets/images/editorial/mountains.jpg"
      imageAlt="Hautes terres brumeuses de Caldera"
    >
      <section>
        <h2>Ce que les Archives ne savent pas</h2>
        <p className={styles.intro}>
          Malgré des générations d’exploration, les cartes de Caldera ne sont
          toujours pas complètes.
        </p>
        <p>Certains sentiers s’arrêtent brutalement.</p>
        <p>Certaines pages des premiers registres ont disparu.</p>
        <p>
          Des symboles apparaissent sur des cartes dessinées à plusieurs
          décennies d’intervalle sans qu’aucun Archiviste ne soit capable d’en
          expliquer l’origine.
        </p>
        <p>
          Et au-delà des Hautes Terres et des Rivages, les anciennes cartes
          laissent encore de vastes espaces sans nom.
        </p>
        <p>Les Archivistes refusent de les remplir par imagination.</p>
        <p>Ils les laissent blancs.</p>
        <p className={styles.maxim}>
          Parce qu’à Caldera, une carte terminée serait une mauvaise nouvelle.
        </p>
        <p>Elle signifierait qu’il ne reste plus rien à découvrir.</p>
      </section>

      <section>
        <h2>L’esprit de Caldera</h2>
        <p className={styles.intro}>
          Caldera n’est pas une histoire de possession.
        </p>
        <p>C’est une histoire de recherche.</p>
        <p>
          Le moment où l’on découvre quelque chose que l’on cherchait depuis
          longtemps.
        </p>
        <p>Celui où l’on trouve exactement ce que l’on ne cherchait pas.</p>
        <p>La pièce qui termine une collection.</p>
        <p>Celle qui en commence une autre.</p>
        <p>
          L’objet conservé pendant des années parce qu’il rappelle un moment
          précis.
        </p>
        <p>Chaque collection devient ainsi une carte personnelle.</p>
        <p>
          Une trace de tous les chemins parcourus, de toutes les recherches
          commencées et de toutes les découvertes que l’on a choisi de garder.
        </p>
        <blockquote>
          Et tant qu’il restera une case vide, une route inconnue ou une histoire
          encore à découvrir, les Terres de Caldera continueront de s’étendre.
        </blockquote>
      </section>
    </UniverseChapterShell>
  );
}
