import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'La Route des Cinq | L’univers de Caldera',
  description:
    'Découvrez la Route des Cinq, le réseau mouvant de pistes, ponts et relais qui relie tous les territoires de Caldera.',
};

export default function RoutePage() {
  return (
    <UniverseChapterShell
      slug="route-des-cinq"
      title="La Route des Cinq"
      kicker="Chemins"
      lead="Il ne s’agit pas d’une route unique, mais d’un réseau vivant de pistes, de ponts, de relais et de passages qui change avec le terrain et ceux qui l’empruntent."
      image="/assets/images/editorial/foret.png"
      imageAlt="Chemin traversant les paysages de Caldera"
    >
      <section>
        <h2>Un réseau, pas une route</h2>
        <p className={styles.intro}>
          Les anciennes cartes représentent souvent les cinq territoires comme
          des régions séparées.
        </p>
        <p>Les cartes modernes montrent quelque chose de différent.</p>
        <p>
          Des centaines de chemins les relient désormais : sentiers taillés dans
          la roche, passerelles au-dessus des ravins, pistes de cendre, relais de
          montagne, quais côtiers et anciennes voies reprises par les voyageurs.
        </p>
        <p>
          On appelle leur ensemble <strong>la Route des Cinq</strong>.
        </p>
        <p>
          Aucun registre ne prétend en posséder une version définitive. Un pont
          peut disparaître après une crue. Une piste peut être recouverte par les
          cendres. Une forêt peut refermer un passage. Un nouveau chemin peut
          naître simplement parce que plusieurs voyageurs ont choisi le même
          détour.
        </p>
        <p className={styles.shortBeat}>
          La Route des Cinq existe parce qu’elle est parcourue.
        </p>
      </section>

      <section>
        <h2>Les signes du chemin</h2>
        <p className={styles.intro}>
          À mesure que les voyages se sont multipliés, une culture commune de la
          route s’est développée entre les territoires.
        </p>
        <p>
          Des cairns indiquent les passages sûrs dans les Hautes Terres. Des
          marques gravées signalent les zones instables des Terres de Braise.
          Dans les Forêts anciennes, des balises suspendues sont préférées aux
          bornes au sol, trop vite absorbées par les racines et la mousse.
        </p>
        <p>
          Près des grands passages, des relais permettent de réparer du matériel,
          d’échanger des informations, de laisser une copie d’un itinéraire ou
          simplement d’attendre que les conditions deviennent praticables.
        </p>
        <p>
          Les voyageurs apprennent ainsi à lire Caldera avant même de savoir la
          dessiner : la direction du vent, la couleur des fumées, le bruit des
          cascades, la présence de certaines espèces ou l’état d’une balise
          peuvent en dire plus qu’une ligne sur une carte.
        </p>
      </section>

      <section>
        <h2>Chaque explorateur trace la sienne</h2>
        <p className={styles.intro}>
          Chaque voyageur finit par parcourir une version différente de la Route
          des Cinq.
        </p>
        <p>Certains passent leur vie dans les Forêts anciennes.</p>
        <p>D’autres reviennent sans cesse vers les Terres de Braise.</p>
        <p>
          Les marchands privilégient les ports et les grands relais. Les
          naturalistes suivent les migrations. Les cartographes montent vers les
          crêtes. Les collectionneurs, eux, peuvent traverser plusieurs régions
          pour retrouver une seule trace.
        </p>
        <p>Certains cherchent une découverte précise.</p>
        <p>D’autres préfèrent ne pas savoir ce qu’ils trouveront.</p>
        <p className={styles.maxim}>
          Il n’existe pas de parcours idéal à travers Caldera.
        </p>
        <p>Seulement celui que l’on choisit de suivre.</p>
      </section>

      <section>
        <h2>Une route qui relie plus que des lieux</h2>
        <p className={styles.intro}>
          À force de circuler, les voyageurs n’ont pas seulement relié les cinq
          territoires. Ils ont aussi relié leurs habitudes.
        </p>
        <p>
          Des techniques de navigation venues des Rivages ont gagné les lacs
          intérieurs. Des méthodes de balisage des Hautes Terres ont été adaptées
          aux plateaux volcaniques. Des observations de naturalistes ont permis
          d’anticiper des saisons de migration jusque dans la Caldera.
        </p>
        <p>
          Les récits, les objets et les usages ont voyagé avec les personnes.
          C’est ainsi qu’une culture commune de l’exploration s’est formée sans
          jamais effacer les particularités de chaque territoire.
        </p>
      </section>
    </UniverseChapterShell>
  );
}
