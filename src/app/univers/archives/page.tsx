import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'Les Archives | L’univers de Caldera',
  description:
    'Les Archives des Explorateurs : observatoire, bibliothèque, centre de cartographie et mémoire vivante de Caldera.',
};

export default function ArchivesPage() {
  return (
    <UniverseChapterShell
      slug="archives"
      title="Les Archives des Explorateurs"
      kicker="Mémoire"
      lead="Suspendues au-dessus des brumes, les Archives sont à la fois un refuge, un observatoire, une bibliothèque et le lieu où Caldera apprend à se souvenir."
      image="/assets/images/editorial/foret.png"
      imageAlt="Chemin forestier dans l’univers de Caldera"
    >
      <section>
        <h2>Un lieu pour conserver ce qui revient</h2>
        <p className={styles.intro}>
          Les Archives reposent au cœur de la Caldera, sur un promontoire de
          roche d’où l’on peut observer une grande partie du bassin.
        </p>
        <p>
          Le bâtiment n’a pas été construit d’un seul geste. Il s’est agrandi
          au fil des générations : salles de lecture, galeries de cartes,
          réserves, ateliers, verrières d’étude et plateformes d’observation se
          sont accrochés peu à peu à la falaise.
        </p>
        <p>
          Les expéditions y partent et y reviennent. On y compare les itinéraires,
          on y corrige les cartes, on y classe les fragments rapportés du terrain
          et l’on y rassemble les journaux de voyage.
        </p>
        <p>
          Depuis la tour d’observation, les Archivistes surveillent les fumées
          volcaniques, l’état des cols, les grandes nappes de brume et les
          déplacements des créatures ailées qui longent parfois les parois de la
          Caldera.
        </p>
        <p className={styles.shortBeat}>
          Les Archives ne sont pas un musée figé. Elles changent à chaque retour
          d’expédition.
        </p>
      </section>

      <section>
        <h2>Ce qui mérite d’être gardé</h2>
        <p className={styles.intro}>
          À Caldera, un trésor n’est pas défini par sa richesse.
        </p>
        <p>
          Il peut s’agir d’une pierre inhabituelle, d’une illustration, d’un
          fragment d’outil, d’une plume, d’un carnet, d’un objet échangé sur les
          Rivages ou d’une pièce retrouvée sous les cendres des Terres de Braise.
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
      </section>

      <section>
        <h2>La règle des trois traces</h2>
        <p className={styles.intro}>
          Avec le temps, les Archivistes adoptèrent une méthode simple pour
          enregistrer les découvertes.
        </p>
        <p>
          Chaque objet important devait être accompagné de trois traces :{' '}
          <strong>le lieu</strong> où il avait été trouvé, <strong>le chemin</strong>{' '}
          qui avait permis de l’atteindre et <strong>le récit</strong> de celui
          ou celle qui l’avait rapporté.
        </p>
        <p>
          Cette règle ne garantissait pas que l’histoire soit complète. Elle
          permettait seulement de distinguer un objet sans contexte d’une
          véritable découverte.
        </p>
        <p>
          C’est aussi pour cette raison que les cartes des Archives comportent
          encore des annotations contradictoires, des chemins barrés et des
          marges remplies de remarques laissées par plusieurs générations
          d’explorateurs.
        </p>
      </section>

      <section>
        <h2>La naissance des collections</h2>
        <p className={styles.intro}>
          À mesure que les découvertes s’accumulaient, les Archivistes
          commencèrent à remarquer des liens entre elles.
        </p>
        <p>
          Certaines provenaient d’un même itinéraire. D’autres partageaient une
          forme, un usage, une origine ou une histoire commune.
        </p>
        <p>
          Les explorateurs se mirent alors à rechercher des séries oubliées, à
          compléter des ensembles et à échanger certains objets pour retrouver
          ceux qui leur manquaient.
        </p>
        <p className={styles.shortBeat}>
          Les premières collections de Caldera étaient nées.
        </p>
      </section>
    </UniverseChapterShell>
  );
}
