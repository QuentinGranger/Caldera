import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronLeft, Megaphone } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { PageHeader } from '@/components/admin/AdminUI';
import admin from '@/components/admin/Admin.module.scss';
import styles from './page.module.scss';

export default async function NewEditionPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Nouvelle édition"
        description="Choisissez le type de contenu que vous souhaitez préparer."
      >
        <Link
          className={`${admin.button} ${admin.secondaryButton}`}
          href="/admin/newsletter"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Newsletter
        </Link>
      </PageHeader>
      <section className={styles.choices} aria-label="Type d’édition">
        <Link
          className={`${admin.card} ${styles.choice} ${styles.carnet}`}
          href="/admin/carnets/nouveau"
          prefetch={false}
          aria-labelledby="carnet-edition-title"
          aria-describedby="carnet-edition-description"
        >
          <span className={styles.icon} aria-hidden="true">
            <BookOpen size={27} strokeWidth={1.5} />
          </span>
          <span className={admin.eyebrow}>Le rendez-vous narratif</span>
          <h2 id="carnet-edition-title">Créer un Carnet</h2>
          <p id="carnet-edition-description">
            Publiez un nouvel épisode des Carnets de Caldera avec accès anticipé
            pour les abonnés.
          </p>
          <ul className={styles.features} aria-label="Format du Carnet">
            <li>Récit</li>
            <li>14 jours d’avance</li>
            <li>Publication automatique</li>
          </ul>
          <p className={styles.note}>
            Le Comptoir · jusqu’à 3 produits associés
          </p>
          <span className={`${admin.button} ${styles.cta}`} aria-hidden="true">
            Créer un Carnet <ArrowRight size={17} />
          </span>
        </Link>
        <Link
          className={`${admin.card} ${styles.choice}`}
          href="/admin/newsletter/campagnes/nouvelle"
          prefetch={false}
          aria-labelledby="commercial-edition-title"
          aria-describedby="commercial-edition-description"
        >
          <span className={styles.icon} aria-hidden="true">
            <Megaphone size={27} strokeWidth={1.5} />
          </span>
          <span className={admin.eyebrow}>Votre actualité boutique</span>
          <h2 id="commercial-edition-title">Créer une campagne commerciale</h2>
          <p id="commercial-edition-description">
            Préparez une sortie, un réassort, une sélection ou une annonce.
          </p>
          <ul className={styles.features} aria-label="Types de campagne">
            <li>Sortie</li>
            <li>Réassort</li>
            <li>Sélection</li>
            <li>Annonce</li>
          </ul>
          <p className={styles.note}>
            Composez librement avec le studio existant.
          </p>
          <span className={`${admin.button} ${styles.cta}`} aria-hidden="true">
            Créer une campagne <ArrowRight size={17} />
          </span>
        </Link>
      </section>
    </>
  );
}
