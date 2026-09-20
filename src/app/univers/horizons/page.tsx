import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'Horizons inconnus | L’univers de Caldera',
  description:
    'Les cartes incomplètes, les routes interrompues, les signes inexpliqués et l’esprit qui donne son sens aux Terres de Caldera.',
};

export default function HorizonsPage() {
  return (
    <UniverseChapterShell
      slug="horizons"
      title="Horizons inconnus"
      kicker="Dernières pages"
      lead="Les Archivistes laissent volontairement certaines zones blanches. À Caldera, une carte terminée signifierait qu’il ne reste plus rien à découvrir."
      image="/assets/images/editorial/mountains.jpg"
      imageAlt="Hautes terres brumeuses de Caldera"
    >
      <section>
        <h2>Ce que les Archives ne savent pas</h2>
        <p className={styles.intro}>
          Malgré des générations d’exploration, les cartes de Caldera ne sont
          toujours pas complètes.
        </p>
        <p>
          Certains sentiers s’arrêtent brutalement au bord d’un relief que
          personne n’a encore réussi à franchir.
        </p>
        <p>
          Certaines pages des premiers registres ont disparu, laissant derrière
          elles des références à des lieux que plus aucune carte ne nomme.
        </p>
        <p>
          Des symboles apparaissent sur des relevés dessinés à plusieurs
          décennies d’intervalle sans qu’aucun Archiviste ne soit capable d’en
          expliquer l’origine.
        </p>
        <p>
          Depuis certaines crêtes, on distingue parfois des colonnes de fumée,
          des reliefs ou des lumières au-delà des routes connues. Depuis les
          Rivages, des navigateurs rapportent aussi l’existence d’îlots ou de
          silhouettes de côtes qui ne figurent sur aucun registre commun.
        </p>
        <p>
          Les Archives refusent de transformer ces témoignages en certitudes.
          Elles les notent, les comparent et attendent qu’un chemin permette de
          les vérifier.
        </p>
        <p className={styles.maxim}>
          Les espaces inconnus ne sont pas remplis par imagination. Ils restent
          blancs.
        </p>
      </section>

      <section>
        <h2>Les signes sans réponse</h2>
        <p className={styles.intro}>
          Caldera contient aussi des traces que personne ne sait encore relier à
          une histoire complète.
        </p>
        <p>
          On trouve des escaliers qui ne mènent plus nulle part, des pierres
          taillées sous des couches de cendre anciennes et des passages dont la
          construction semble précéder les premières expéditions consignées.
        </p>
        <p>
          Des migrations de grandes créatures ailées suivent parfois des routes
          différentes de celles observées les années précédentes. Dans les
          Forêts anciennes, certaines espèces disparaissent pendant plusieurs
          saisons avant de réapparaître dans des vallées éloignées.
        </p>
        <p>
          Aucun de ces phénomènes n’est présenté comme une vérité définitive.
          Pour les Archivistes, une hypothèse reste une hypothèse tant qu’elle
          n’a pas été confrontée au terrain.
        </p>
        <p className={styles.shortBeat}>
          À Caldera, ne pas savoir fait partie de la carte.
        </p>
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
          précis, un lieu, une rencontre ou simplement le chemin qu’il a fallu
          parcourir pour l’obtenir.
        </p>
        <p>
          Chaque collection devient ainsi une carte personnelle : une trace de
          toutes les recherches commencées, de tous les détours acceptés et de
          toutes les découvertes que l’on a choisi de garder.
        </p>
        <blockquote>
          Et tant qu’il restera une case vide, une route inconnue ou une histoire
          encore à découvrir, les Terres de Caldera continueront de s’étendre.
        </blockquote>
      </section>
    </UniverseChapterShell>
  );
}
