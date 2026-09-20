import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'Les cinq territoires | L’univers de Caldera',
  description:
    'Explorez la Caldera, les Terres de Braise, les Forêts anciennes, les Hautes Terres et les Rivages.',
};

export default function TerritoriesPage() {
  return (
    <UniverseChapterShell
      slug="territoires"
      title="Les cinq territoires"
      kicker="Cartographie"
      lead="Autour du cratère, cinq régions ont façonné cinq manières d’explorer, de chercher et de collectionner."
      image="/assets/images/editorial/mountains.jpg"
      imageAlt="Reliefs montagneux évoquant les territoires de Caldera"
    >
      <section>
        <h2>Les cinq territoires</h2>
        <p className={styles.intro}>
          Les anciennes cartes divisent les terres en cinq grands territoires,
          chacun marqué par son paysage, ses routes et sa manière de raconter la
          découverte.
        </p>

        <nav className={styles.territoryJump} aria-label="Aller à un territoire">
          <a href="#caldera">I · La Caldera</a>
          <a href="#braise">II · Terres de Braise</a>
          <a href="#forets">III · Forêts anciennes</a>
          <a href="#hautes-terres">IV · Hautes Terres</a>
          <a href="#rivages">V · Rivages</a>
        </nav>

        <section id="caldera" className={styles.territory}>
          <header>
            <span className={styles.roman}>I</span>
            <div>
              <h3>La Caldera</h3>
              <h4>Le cœur des terres</h4>
            </div>
          </header>
          <p>
            Au centre du monde connu s’étend l’immense cratère qui donna son nom
            à toutes les terres environnantes.
          </p>
          <p>
            Ses falaises forment une couronne de roche sombre autour d’une
            vallée où se croisent rivières, brumes et anciennes coulées
            volcaniques.
          </p>
          <p>C’est ici que furent fondées les Archives des Explorateurs.</p>
          <p>
            Toutes les grandes routes finissent, tôt ou tard, par revenir vers
            la Caldera.
          </p>
          <p>
            On dit que l’on peut parcourir le monde entier sans comprendre ce
            que l’on cherche.
          </p>
          <p>Mais qu’une fois revenu ici, on sait enfin pourquoi on était parti.</p>
        </section>

        <section id="braise" className={styles.territory}>
          <header>
            <span className={styles.roman}>II</span>
            <div>
              <h3>Les Terres de Braise</h3>
              <h4>La roche garde la mémoire</h4>
            </div>
          </header>
          <p>
            À l’est de la Caldera s’étendent des plateaux noirs traversés de
            veines rougeoyantes.
          </p>
          <p>La terre y porte encore les marques du Grand Effondrement.</p>
          <p>
            Le vent soulève parfois une poussière sombre qui recouvre les anciens
            chemins en quelques heures. Certaines routes disparaissent pendant
            des années avant d’être découvertes de nouveau.
          </p>
          <p>Les explorateurs y recherchent ce qui a résisté au temps.</p>
          <p>
            Les objets provenant des Terres de Braise sont souvent associés aux
            découvertes les plus improbables : fragments oubliés, pièces que
            l’on croyait perdues ou trésors retrouvés là où personne ne pensait
            encore chercher.
          </p>
          <p>Ici, la rareté ne se mesure pas seulement au nombre.</p>
          <p className={styles.maxim}>
            Elle se mesure à la difficulté du chemin parcouru pour la trouver.
          </p>
        </section>

        <section id="forets" className={styles.territory}>
          <header>
            <span className={styles.roman}>III</span>
            <div>
              <h3>Les Forêts anciennes</h3>
              <h4>Tout ne demande pas à être découvert</h4>
            </div>
          </header>
          <p>À l’ouest commencent les grandes forêts.</p>
          <p>
            Elles existaient avant les premières cartes et semblent parfois
            ignorer les frontières tracées par les hommes.
          </p>
          <p>
            Sous leur canopée, les sentiers changent, les pierres disparaissent
            sous les racines et certains repères ne figurent sur aucun registre.
          </p>
          <p>
            Les explorateurs disent qu’on ne traverse jamais deux fois exactement
            la même forêt.
          </p>
          <p>C’est le territoire de la curiosité.</p>
          <p>Celui des découvertes inattendues.</p>
          <p>De l’objet que l’on ne cherchait pas.</p>
          <p>
            De la collection commencée par hasard et que l’on poursuivra pourtant
            pendant des années.
          </p>
          <p>
            Les Archivistes possèdent encore des dizaines de cartes incomplètes
            de ces forêts.
          </p>
          <p>Certaines comportent simplement cette annotation :</p>
          <blockquote>« À poursuivre. »</blockquote>
        </section>

        <section id="hautes-terres" className={styles.territory}>
          <header>
            <span className={styles.roman}>IV</span>
            <div>
              <h3>Les Hautes Terres</h3>
              <h4>Certaines recherches prennent du temps</h4>
            </div>
          </header>
          <p>Au nord, les chemins montent jusqu’aux crêtes.</p>
          <p>
            L’air y devient froid, la végétation rare et les distances difficiles
            à estimer.
          </p>
          <p>
            Depuis les sommets, on distingue parfois simultanément les forêts,
            les terres volcaniques et les reflets de l’océan.
          </p>
          <p>Mais atteindre ces points demande du temps.</p>
          <p>
            Les Hautes Terres sont devenues le symbole des longues recherches.
          </p>
          <p>
            Celles que l’on poursuit pendant des semaines, des mois ou des
            années.
          </p>
          <p>
            Les explorateurs qui y voyagent répètent souvent une autre maxime des
            Archives :
          </p>
          <blockquote>
            « Tout ce qui est rare n’est pas précieux. Tout ce qui est précieux
            n’est pas rare. »
          </blockquote>
        </section>

        <section id="rivages" className={styles.territory}>
          <header>
            <span className={styles.roman}>V</span>
            <div>
              <h3>Les Rivages</h3>
              <h4>Là où le monde arrive à Caldera</h4>
            </div>
          </header>
          <p>Au sud, les terres rencontrent l’océan.</p>
          <p>
            Les premiers ports y furent construits bien avant que l’intérieur de
            Caldera ne soit entièrement cartographié.
          </p>
          <p>
            Depuis toujours, voyageurs, marchandises, récits et objets venus
            d’ailleurs arrivent par ces rivages.
          </p>
          <p>
            Certaines découvertes parcourent des milliers de kilomètres avant
            d’entrer dans les Archives.
          </p>
          <p>
            D’autres quittent Caldera par les mêmes routes pour rejoindre de
            nouveaux collectionneurs.
          </p>
          <p>Les Rivages rappellent ainsi une chose essentielle :</p>
          <p className={styles.maxim}>
            Aucune collection ne se construit entièrement seule.
          </p>
          <p>
            Elle grandit grâce aux rencontres, aux échanges et aux découvertes
            faites par ceux qui ont emprunté d’autres chemins.
          </p>
        </section>
      </section>
    </UniverseChapterShell>
  );
}
