import type { Metadata } from 'next';
import Image from 'next/image';
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
      lead="Autour du cratère, cinq régions ont développé leurs propres paysages, leurs propres dangers et leurs propres façons d’explorer."
      image="/assets/images/GrandEffondrement.png"
      imageAlt="Vue générale de la Caldera, de ses falaises, de ses lacs et de ses terres volcaniques"
    >
      <section>
        <h2>Les cinq territoires</h2>
        <p className={styles.intro}>
          Les cartes anciennes représentaient ces régions comme cinq mondes
          séparés. Les explorateurs ont fini par comprendre qu’elles formaient
          un seul territoire vivant, relié par l’eau, le vent, les migrations et
          les routes humaines.
        </p>
        <p>
          Chaque région possède sa propre matière, son propre climat et sa propre
          manière de mettre les voyageurs à l’épreuve. C’est aussi pour cette
          raison que les découvertes rapportées aux Archives portent toujours la
          trace du lieu où elles ont été trouvées.
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
          <figure className={styles.territoryVisual}>
            <Image
              src="/assets/images/GrandEffondrement.png"
              alt="Grande vue du bassin central de la Caldera"
              fill
              sizes="(min-width: 75rem) 46rem, 100vw"
            />
            <figcaption>La Caldera — le cœur des terres.</figcaption>
          </figure>
          <p>
            Au centre du monde connu s’étend l’immense bassin qui donna son nom à
            toutes les terres environnantes.
          </p>
          <p>
            Ses falaises forment une couronne de roche sombre autour d’un relief
            complexe de lacs, d’îlots volcaniques, de rivières et d’anciennes
            coulées aujourd’hui recouvertes par endroits de végétation.
          </p>
          <p>
            Les cascades qui descendent des hauteurs alimentent le bassin tandis
            que la chaleur du sous-sol entretient des nappes de brume presque
            permanentes.
          </p>
          <p>
            Les grands dragons des falaises sont parfois visibles au-dessus du
            cratère. Ils utilisent les courants thermiques pour parcourir de
            longues distances sans presque battre des ailes. Les Archives
            consignent leurs passages, mais aucune tentative sérieuse de les
            domestiquer n’a jamais abouti.
          </p>
          <p>
            C’est ici que furent fondées les Archives des Explorateurs et que se
            croisent aujourd’hui les principales routes.
          </p>
          <p className={styles.maxim}>
            Toutes les grandes routes finissent, tôt ou tard, par revenir vers la
            Caldera.
          </p>
          <p>
            On dit que l’on peut parcourir le monde entier sans comprendre ce que
            l’on cherche. Mais qu’une fois revenu ici, on sait enfin pourquoi on
            était parti.
          </p>
        </section>

        <section id="braise" className={styles.territory}>
          <header>
            <span className={styles.roman}>II</span>
            <div>
              <h3>Les Terres de Braise</h3>
              <h4>La roche garde la mémoire</h4>
            </div>
          </header>
          <figure className={styles.territoryVisual}>
            <Image
              src="/assets/images/TerresBraise.png"
              alt="Plateaux volcaniques noirs et rougeoyants des Terres de Braise"
              fill
              sizes="(min-width: 75rem) 46rem, 100vw"
            />
            <figcaption>Les Terres de Braise — la roche garde la mémoire.</figcaption>
          </figure>
          <p>
            À l’est de la Caldera s’étendent des plateaux noirs traversés de
            fractures rouges, de fumerolles et d’anciennes rivières de lave.
          </p>
          <p>
            La terre y porte encore les marques les plus visibles du Grand
            Effondrement. Certaines zones sont froides depuis des siècles ;
            d’autres dégagent toujours assez de chaleur pour déformer l’air au-dessus de la roche.
          </p>
          <p>
            Le vent soulève une poussière sombre qui peut recouvrir un chemin en
            quelques heures. À l’inverse, une tempête suffit parfois à dégager
            un passage ou un fragment resté enfoui pendant des années.
          </p>
          <p className={styles.shortBeat}>
            Dans les Terres de Braise, ce qui disparaît n’est pas toujours perdu.
            Les cendres cachent autant qu’elles révèlent.
          </p>
          <p>
            Une faune lourde et cuirassée vit sur les plateaux les plus chauds.
            Certaines espèces se confondent presque avec le basalte lorsqu’elles
            restent immobiles.
          </p>
          <p>
            Les explorateurs y recherchent surtout ce qui a résisté au temps :
            fragments oubliés, pièces que l’on croyait perdues ou objets
            retrouvés là où personne ne pensait encore chercher.
          </p>
          <p className={styles.maxim}>
            Ici, la rareté se mesure aussi à la difficulté du chemin parcouru
            pour la trouver.
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
          <figure className={styles.territoryVisual}>
            <Image
              src="/assets/images/ForetsAnciennes.png"
              alt="Forêt ancienne humide et brumeuse de Caldera avec une faune mimétique"
              fill
              sizes="(min-width: 75rem) 46rem, 100vw"
              className={styles.territoryImagePortrait}
            />
            <figcaption>Les Forêts anciennes — tout ne demande pas à être découvert.</figcaption>
          </figure>
          <p>
            À l’ouest commencent les grandes forêts, plus anciennes que les
            premières cartes conservées aux Archives.
          </p>
          <p>
            Sous leur canopée, l’humidité ne disparaît presque jamais. La mousse
            recouvre les troncs, les racines déplacent lentement les pierres et
            les chemins sont régulièrement repris par la végétation.
          </p>
          <p>
            Les explorateurs disent qu’on ne traverse jamais deux fois exactement
            la même forêt. Un sentier praticable une saison peut être fermé
            l’année suivante par un arbre tombé, une crue ou plusieurs mètres de
            fougères.
          </p>
          <p>
            La faune elle-même semble faite pour disparaître dans le paysage.
            Certaines petites espèces portent sur leur pelage des mousses,
            lichens et feuilles qui les rendent presque invisibles tant qu’elles
            restent immobiles.
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
          <figure className={styles.territoryVisual}>
            <Image
              src="/assets/images/HautesTerres.png"
              alt="Plateaux froids et falaises des Hautes Terres de Caldera"
              fill
              sizes="(min-width: 75rem) 46rem, 100vw"
            />
            <figcaption>Les Hautes Terres — certaines recherches prennent du temps.</figcaption>
          </figure>
          <p>
            Au nord, les chemins quittent progressivement les arbres et montent
            jusqu’aux plateaux balayés par le vent.
          </p>
          <p>
            L’air y devient froid, la végétation basse et les distances
            difficiles à estimer. Les falaises s’interrompent brutalement dans
            les nuages et certains cols ne sont praticables qu’une partie de
            l’année.
          </p>
          <p>
            Les voyageurs y utilisent des relais espacés, des balises de pierre
            et, sur les plateaux les plus ouverts, de grands chariots à voile
            capables de profiter des vents réguliers pour transporter du
            matériel sur de longues distances.
          </p>
          <p>
            C’est aussi depuis ces hauteurs que les cartographes peuvent
            comparer plusieurs régions d’un seul regard. Beaucoup de cartes
            commencées dans les vallées sont corrigées ici.
          </p>
          <p>
            Les Hautes Terres sont devenues le symbole des recherches longues :
            celles que l’on poursuit pendant des semaines, des mois ou parfois
            des années.
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
          <figure className={styles.territoryVisual}>
            <Image
              src="/assets/images/Rivages.png"
              alt="Village côtier et embarcations des Rivages de Caldera"
              fill
              sizes="(min-width: 75rem) 46rem, 100vw"
            />
            <figcaption>Les Rivages — là où le monde arrive à Caldera.</figcaption>
          </figure>
          <p>
            Au sud, les falaises volcaniques s’ouvrent sur l’océan et laissent
            place à une succession de criques, de plages noires et de petits
            ports.
          </p>
          <p>
            Les communautés côtières y naviguaient bien avant que l’intérieur de
            Caldera ne soit entièrement cartographié. Leurs embarcations légères
            reliaient déjà les baies, les îlots et les caps lorsque les routes
            terrestres n’étaient encore que des lignes incertaines.
          </p>
          <p>
            Depuis toujours, voyageurs, marchandises, récits et objets venus
            d’ailleurs arrivent par ces rivages.
          </p>
          <p>
            Certaines découvertes parcourent des milliers de kilomètres avant
            d’entrer dans les Archives. D’autres quittent Caldera par les mêmes
            routes pour rejoindre de nouveaux collectionneurs.
          </p>
          <p>
            Les ports sont donc autant des lieux d’échange que des lieux de
            récit. On y apprend souvent l’existence d’un objet, d’une route ou
            d’un territoire avant même de pouvoir le placer sur une carte.
          </p>
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
