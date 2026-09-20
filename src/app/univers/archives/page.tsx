import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'Les Archives | L’univers de Caldera',
  description:
    'Découvrez les Archives des Explorateurs et la naissance des premières collections de Caldera.',
};

export default function ArchivesPage() {
  return (
    <UniverseChapterShell
      slug="archives"
      title="Les Archives des Explorateurs"
      kicker="Mémoire"
      lead="Au cœur de la Caldera, les découvertes ne sont pas seulement conservées : elles sont accompagnées de l’histoire qui leur donne un sens."
      image="/assets/images/editorial/foret.png"
      imageAlt="Chemin forestier dans l’univers de Caldera"
    >
      <section>
        <h2>Les Archives des Explorateurs</h2>
        <p className={styles.intro}>
          Les Archives reposent au cœur de la Caldera, là où les grandes routes
          des cinq territoires finissent par se rencontrer.
        </p>
        <p>
          On y conserve des cartes, des journaux de voyage, des illustrations,
          des fragments rapportés d’expédition et les histoires qui leur sont
          associées.
        </p>
        <p>
          Car à Caldera, un trésor n’est pas défini par sa richesse.
        </p>
        <p className={styles.shortBeat}>
          Un trésor est <strong>quelque chose que quelqu’un a choisi de ne pas oublier</strong>.
        </p>
        <p>Il peut être exceptionnel ou presque insignifiant.</p>
        <p>Rare ou commun.</p>
        <p>Ancien ou découvert la veille.</p>
        <p>Ce qui compte est la trace qu’il laisse.</p>
        <p>C’est ainsi qu’est née l’une des plus anciennes maximes des Archives :</p>
        <blockquote>« Ce qui mérite d’être gardé mérite d’être raconté. »</blockquote>
        <p>
          Avec le temps, les explorateurs commencèrent à organiser leurs
          découvertes, à rechercher des séries oubliées, à compléter des
          ensembles et à échanger certains objets pour retrouver ceux qui leur
          manquaient.
        </p>
        <p className={styles.shortBeat}>
          Les premières collections de Caldera étaient nées.
        </p>
      </section>
    </UniverseChapterShell>
  );
}
