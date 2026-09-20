import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'Origines | L’univers de Caldera',
  description:
    'Le Grand Effondrement, la naissance de la Caldera et les premiers explorateurs.',
};

export default function OriginsPage() {
  return (
    <UniverseChapterShell
      slug="origines"
      title="Là où la terre s’est ouverte"
      kicker="Origines"
      lead="Personne ne sait exactement quand le sommet s’est effondré. C’est pourtant de cette cicatrice qu’est né tout le reste."
      image="/assets/images/editorial/hero-banner.png"
      imageAlt="Volcan et reliefs des Terres de Caldera"
    >
      <section>
        <h2>Là où la terre s’est ouverte</h2>
        <p className={styles.intro}>
          Personne ne sait exactement quand le sommet s’est effondré.
        </p>
        <p>
          Les plus anciens récits parlent d’une montagne si vaste qu’elle
          dominait autrefois l’horizon tout entier. Puis vint ce que les
          chroniques nomment aujourd’hui <strong>le Grand Effondrement</strong>.
        </p>
        <p className={styles.shortBeat}>La montagne disparut en une nuit.</p>
        <p>
          À sa place demeura une immense dépression encerclée de falaises, de
          forêts et de terres volcaniques encore chaudes :{' '}
          <strong>la Caldera</strong>.
        </p>
        <p>
          Pendant des générations, les brumes, les cendres et les reliefs
          instables rendirent son centre presque inaccessible. Les populations
          s’installèrent autour de cette cicatrice, sans réellement savoir ce
          qu’elle contenait.
        </p>
        <p className={styles.shortBeat}>
          Puis les premiers chemins furent ouverts.
        </p>
        <p>Et avec eux commencèrent les explorations.</p>
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
        <p>Certains revinrent avec des pierres étranges.</p>
        <p>D’autres avec des objets trouvés sur d’anciens chemins.</p>
        <p>
          Certains ne rapportèrent qu’un dessin, une plume, quelques notes ou le
          souvenir d’un paysage qu’ils n’étaient pas certains de pouvoir
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
