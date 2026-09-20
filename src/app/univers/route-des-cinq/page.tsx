import type { Metadata } from 'next';
import { UniverseChapterShell } from '@/components/universe/UniverseChapterShell';
import styles from '@/components/universe/UniverseChapter.module.scss';

export const metadata: Metadata = {
  title: 'La Route des Cinq | L’univers de Caldera',
  description:
    'Découvrez la Route des Cinq, le réseau mouvant qui relie tous les territoires de Caldera.',
};

export default function RoutePage() {
  return (
    <UniverseChapterShell
      slug="route-des-cinq"
      title="La Route des Cinq"
      kicker="Chemins"
      lead="Il ne s’agit pas d’une route unique, mais d’un réseau vivant que chaque voyageur finit par redessiner à sa manière."
      image="/assets/images/editorial/foret.png"
      imageAlt="Chemin traversant les paysages de Caldera"
    >
      <section>
        <h2>La Route des Cinq</h2>
        <p className={styles.intro}>
          Les anciennes cartes représentent souvent les cinq territoires
          séparément.
        </p>
        <p>Les cartes modernes montrent quelque chose de différent.</p>
        <p>Des centaines de chemins relient désormais les régions.</p>
        <p>
          On appelle leur ensemble <strong>la Route des Cinq</strong>.
        </p>
        <p>
          Il ne s’agit pas d’une route unique, mais d’un réseau constamment
          modifié par les voyageurs.
        </p>
        <p>Chaque explorateur en parcourt une version différente.</p>
        <p>Certains passent leur vie dans les Forêts anciennes.</p>
        <p>D’autres reviennent sans cesse vers les Terres de Braise.</p>
        <p>Certains cherchent une découverte précise.</p>
        <p>D’autres préfèrent ne pas savoir ce qu’ils trouveront.</p>
        <p className={styles.maxim}>
          Il n’existe donc pas de parcours idéal à travers Caldera.
        </p>
        <p>Seulement celui que l’on choisit de suivre.</p>
      </section>
    </UniverseChapterShell>
  );
}
