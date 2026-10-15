import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCarnetAnalytics } from '@/lib/carnets/analytics';
import { PageHeader, AdminTable, EmptyState } from '@/components/admin/AdminUI';
import { formatDate } from '@/lib/admin/format';
import styles from '@/components/admin/Admin.module.scss';
const percent = (rate: number | null) =>
  rate === null
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(rate);
export default async function CarnetAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    data = await getCarnetAnalytics(id);
  if (!data) notFound();
  return (
    <>
      <PageHeader
        title={`Mesures · Carnet #${String(data.chapter.number).padStart(3, '0')}`}
        description={`${data.chapter.title} · 90 derniers jours, depuis le ${formatDate(data.since)}`}
      >
        <Link className={styles.button} href={`/admin/carnets/${id}`}>
          Ouvrir l’édition
        </Link>
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/carnets"
        >
          Tous les Carnets
        </Link>
      </PageHeader>
      <section
        className={styles.pilotageKpis}
        aria-label="Du récit à la boutique"
      >
        {[
          ['Lecteurs mesurés', data.readers],
          ['Continuer l’expédition · clics uniques', data.storyClicks],
          ['Vues produit après lecture · lecteurs', data.productReaders],
          ['Fins de lecture estimées', data.completed],
        ].map(([title, value]) => (
          <article className={styles.pilotageKpi} key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <p className={styles.card}>
        Part des lecteurs mesurés ayant ensuite consulté un produit :{' '}
        <strong>
          {percent(data.readers ? data.productReaders / data.readers : null)}
        </strong>
        . Attribution au dernier Carnet consulté dans les 24 h précédentes, sur
        le même navigateur consentant.
      </p>
      <section className={styles.card} aria-labelledby="comptoir-analytics">
        <h2 id="comptoir-analytics">Le Comptoir · clics par produit</h2>
        {data.products.length ? (
          <AdminTable
            caption="Clics uniques du Comptoir"
            headings={['Produit', 'Type', 'Lien', 'Clics uniques']}
          >
            {data.products.map((p) => (
              <tr key={`${p.linkKey}:${p.productId}`}>
                <td>
                  <Link href={`/admin/produits/${p.productId}`}>{p.name}</Link>
                </td>
                <td>{p.type ?? '—'}</td>
                <td>
                  <code>{p.linkKey}</code>
                </td>
                <td>{p.clicks}</td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <EmptyState>Aucun clic Comptoir mesuré pour ce Carnet.</EmptyState>
        )}
        <p>
          Un clic unique par livraison et par lien. Les clics du récit et de
          chaque produit sont distincts ; leur somme n’est pas un nombre de
          personnes distinctes.
        </p>
      </section>
      <section className={styles.card} aria-labelledby="retention-carnets">
        <h2 id="retention-carnets">Rétention vers les épisodes suivants</h2>
        <p>
          Cohorte : {data.readers} lecteur{data.readers === 1 ? '' : 's'} mesuré
          {data.readers === 1 ? '' : 's'} de ce Carnet sur 90 jours. Un retour
          compte si le même identifiant anonyme a consulté l’épisode suivant
          après celui-ci.
        </p>
        {data.retention.length ? (
          <AdminTable
            caption="Progression de la cohorte"
            headings={[
              'Épisode suivant',
              'Lecteurs revenus',
              'Rétention',
              'Observation',
            ]}
          >
            {data.retention.map((next) => (
              <tr key={next.id}>
                <td>
                  <Link href={`/admin/carnets/${next.id}/analytics`}>
                    #{String(next.number).padStart(3, '0')} — {next.title}
                  </Link>
                </td>
                <td>{next.readers}</td>
                <td>
                  {next.state === 'hidden' || next.state === 'scheduled'
                    ? '—'
                    : percent(next.rate)}
                </td>
                <td>
                  {next.state === 'public'
                    ? 'Épisode public · observation en cours'
                    : next.state === 'early'
                      ? 'Avant-première · cohorte encore partielle'
                      : 'À venir'}
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <EmptyState>Aucun épisode suivant dans la bibliothèque.</EmptyState>
        )}
      </section>
      <section className={styles.card} aria-labelledby="email-existing">
        <h2 id="email-existing">Newsletter · indicateurs existants</h2>
        <p>
          {data.email._all} envois suivis · {data.email.deliveredAt} délivrés ·{' '}
          {data.email.openedAt} ouvertures uniques · {data.email.clickedAt}{' '}
          clics uniques globaux.
        </p>
        <Link href="/admin/mesures">
          Voir les mesures newsletter et boutique
        </Link>
      </section>
      <details className={styles.card}>
        <summary>Comprendre les limites de ces mesures</summary>
        <ul>
          <li>
            Seuls les visiteurs ayant accepté la mesure du site sont comptés. Un
            lecteur correspond à un navigateur, pas à une personne identifiée.
            Plusieurs appareils ne sont pas rapprochés.
          </li>
          <li>
            Une lecture correspond à 10 secondes de présence visible sur le
            récit. Une fin estimée exige 30 secondes et l’arrivée au bas du
            récit ; elle ne prouve pas sa compréhension.
          </li>
          <li>
            Les clics email nécessitent un consentement email distinct et
            trackingEnabled. Les robots de sécurité peuvent cliquer ; un clic
            n’est donc pas une lecture.
          </li>
          <li>
            Les cohortes sont mobiles sur 90 jours et leur durée d’observation
            varie. Un épisode récent ne se compare pas directement à un ancien.
            Les données ne sont pas rétroactives.
          </li>
          <li>
            Ces chiffres décrivent le retour vers la boutique ; ils ne prouvent
            pas que le récit cause davantage d’achats. Retrait du consentement
            et purge peuvent réduire les compteurs.
          </li>
        </ul>
      </details>
    </>
  );
}
