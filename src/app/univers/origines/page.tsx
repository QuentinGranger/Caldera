import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'Origines | L’univers de Caldera',
  description:
    'Le Grand Effondrement, la naissance du bassin de Caldera et les premiers explorateurs qui ouvrirent ses chemins.',
};

export default function OriginsPage() {
  return (
    <UniverseChapterShell
      slug="origines"
      title="Là où la terre s’est ouverte"
      kicker="Origines"
      lead="Personne ne sait exactement quand le sommet s’est effondré. On sait seulement qu’après cette nuit, l’horizon n’a plus jamais eu la même forme."
      image="/assets/images/editorial/hero-banner.png"
      imageAlt="Volcan et reliefs des Terres de Caldera"
    >
      <section>
        <h2>Le Grand Effondrement</h2>
        <p className={styles.intro}>
          Les plus anciens récits parlent d’une montagne si vaste qu’elle
          dominait autrefois l’horizon tout entier.
        </p>
        <p>
          Puis vint ce que les chroniques nomment aujourd’hui{' '}
          <strong>le Grand Effondrement</strong>. La montagne disparut en une
          nuit, laissant derrière elle une immense dépression ceinturée de
          falaises abruptes.
        </p>
        <p>
          Au fond du bassin, la terre resta chaude. Des lacs se formèrent entre
          les coulées refroidies. Des rivières descendirent des hauteurs et
          devinrent des cascades. Les forêts reprirent les pentes tandis que les
          brumes s’accumulaient dans les vallées.
        </p>
        <p className={styles.shortBeat}>
          Cette cicatrice devint <strong>la Caldera</strong>.
        </p>
        <p>
          Pendant des générations, son centre demeura presque inaccessible. Les
          cendres dissimulaient les passages, les parois s’effondraient encore
          et certains reliefs disparaissaient entièrement sous les nuages.
        </p>
        <p>
          Les populations s’installèrent d’abord sur les rebords, là où l’on
          pouvait observer le bassin sans avoir à y descendre.
        </p>
        <p>
          C’est de ces hauteurs que furent signalées les premières grandes
          créatures ailées. Elles utilisaient les courants chauds qui remontaient
          du cratère pour longer les falaises. Elles étaient rares, difficiles à
          approcher et déjà présentes dans les récits les plus anciens.
        </p>
      </section>

      <section>
        <h2>Les premiers chemins</h2>
        <p className={styles.intro}>
          Les premières expéditions ne cherchèrent pas à conquérir Caldera. Elles
          cherchèrent d’abord à comprendre comment y entrer.
        </p>
        <p>
          Les explorateurs suivirent les rebords de la couronne rocheuse,
          repérèrent les pentes praticables et descendirent progressivement vers
          le centre.
        </p>
        <p>
          Ils découvrirent parfois des marches taillées dans la pierre, des
          passages interrompus ou des traces de voies plus anciennes que leurs
          propres cartes.
        </p>
        <p>
          Personne ne sut déterminer avec certitude qui les avait tracées ni
          quand elles avaient été abandonnées.
        </p>
        <p className={styles.shortBeat}>
          Puis les premiers chemins continus furent ouverts.
        </p>
        <p>Et avec eux commencèrent les explorations de Caldera.</p>
      </section>

      <section>
        <h2>Les premiers explorateurs</h2>
        <p className={styles.intro}>
          Ils n’étaient ni conquérants ni aventuriers à la recherche d’un
          royaume perdu.
        </p>
        <p>
          Ils étaient cartographes, voyageurs, naturalistes, marchands,
          collectionneurs ou simplement curieux.
        </p>
        <p>Ils partirent parce que les cartes de Caldera étaient encore vides.</p>
        <p>
          Certains revinrent avec des pierres étranges ou des fragments trouvés
          dans les couches de cendre.
        </p>
        <p>
          D’autres rapportèrent des plantes inconnues, des objets retrouvés sur
          d’anciens chemins, des croquis de créatures aperçues au loin ou de
          simples notes sur un passage qu’ils n’étaient pas certains de pouvoir
          retrouver.
        </p>
        <p>Peu à peu, une habitude apparut.</p>
        <p>
          Chaque découverte digne d’être conservée était accompagnée du récit de
          sa découverte.
        </p>
        <div className={styles.questionList}>
          <p>Où avait-elle été trouvée ?</p>
          <p>Qui l’avait rapportée ?</p>
          <p>Quel chemin avait permis de l’atteindre ?</p>
          <p>Pourquoi méritait-elle d’être gardée ?</p>
        </div>
        <p>Ces récits furent d’abord consignés dans des carnets personnels.</p>
        <p>Puis les carnets devinrent des registres.</p>
        <p>
          Et les registres devinrent les <strong>Archives des Explorateurs</strong>.
        </p>
      </section>
    </UniverseChapterShell>
  );
}
