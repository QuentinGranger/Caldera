import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  CalendarDays,
} from 'lucide-react';
import { PageHeader, Badge, EmptyState } from '@/components/admin/AdminUI';
import {
  getCarnetCalendar,
  type CarnetEditorialCalendar,
} from '@/lib/carnets/calendar';
import { EDITORIAL_STATES } from '@/lib/carnets/calendar-status';
import { formatDate } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import admin from '@/components/admin/Admin.module.scss';
import styles from './page.module.scss';

type Entry = CarnetEditorialCalendar['entries'][number];
function Edition({ entry }: { entry: Entry }) {
  const tone =
    entry.state === 'Brouillon'
      ? 'neutral'
      : entry.state === 'Texte prêt'
        ? 'pending'
        : ['Programmé', 'Accès anticipé'].includes(entry.state)
          ? 'info'
          : 'success';
  return (
    <article className={styles.edition}>
      <Link href={`/admin/carnets/${entry.id}`} className={styles.editionLink}>
        <div className={styles.titleRow}>
          <h3>
            <span>#{String(entry.number).padStart(3, '0')}</span> —{' '}
            {entry.title}
          </h3>
          <ArrowUpRight size={18} aria-hidden="true" />
        </div>
        <div className={styles.meta}>
          <Badge value={entry.state} tone={tone} />
          {entry.arcTitle && (
            <span>
              {entry.arcTitle}
              {entry.arcPosition && entry.arcTotal
                ? ` · ${entry.arcPosition}/${entry.arcTotal}`
                : ''}
            </span>
          )}
        </div>
        <dl className={styles.dates}>
          <div data-current-month={entry.newsletterInMonth}>
            <dt>Newsletter{entry.newsletterInMonth && <span>Ce mois</span>}</dt>
            <dd>
              {entry.newsletterAt ? (
                <time dateTime={entry.newsletterAt.toISOString()}>
                  {formatDate(entry.newsletterAt)}
                </time>
              ) : (
                'À planifier'
              )}
            </dd>
          </div>
          <div data-current-month={entry.publicInMonth}>
            <dt>Public{entry.publicInMonth && <span>Ce mois</span>}</dt>
            <dd>
              {entry.publicAt ? (
                <time dateTime={entry.publicAt.toISOString()}>
                  {formatDate(entry.publicAt)}
                </time>
              ) : (
                'À planifier'
              )}
            </dd>
          </div>
        </dl>
        {entry.provisional && entry.newsletterAt && (
          <p className={styles.note}>
            Dates prévisionnelles · envoi non programmé
          </p>
        )}
        {!!entry.tasks.length && (
          <p className={styles.tasks}>{entry.tasks.join(' · ')}</p>
        )}
        <span className={styles.open}>
          Ouvrir l’édition <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </article>
  );
}

export default async function CarnetCalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await getCarnetCalendar(param(await searchParams, 'mois'));
  const { month } = data;
  const reserveLabel =
    data.readyCount < 6
      ? `${6 - data.readyCount} texte${6 - data.readyCount === 1 ? '' : 's'} prêt${6 - data.readyCount === 1 ? '' : 's'} pour atteindre le repère de 6`
      : data.readyCount <= 10
        ? 'Vous disposez de 6 à 10 épisodes d’avance'
        : 'Plus de 10 épisodes d’avance';
  return (
    <>
      <PageHeader
        title="Calendrier des Carnets"
        description="Les prochaines newsletters et publications publiques, réunies mois par mois. Dates à l’heure de Paris."
      >
        <Link
          href="/admin/carnets"
          className={`${admin.button} ${admin.secondaryButton}`}
        >
          Liste des Carnets
        </Link>
        <Link href="/admin/carnets/nouveau" className={admin.button}>
          <Plus size={16} aria-hidden="true" />
          Nouveau Carnet
        </Link>
      </PageHeader>
      <section className={styles.reserve} aria-labelledby="reserve-editoriale">
        <div>
          <h2 id="reserve-editoriale">Votre avance éditoriale</h2>
          <p className={styles.reserveNumber}>
            <strong>{data.readyCount}</strong> texte
            {data.readyCount === 1 ? '' : 's'} prêt
            {data.readyCount === 1 ? '' : 's'} à venir
          </p>
          <p className={styles.note}>
            {reserveLabel} ·{' '}
            {new Intl.NumberFormat('fr-FR').format(data.readyCount / 2)} mois à
            2 Carnets par mois.
          </p>
        </div>
        <div className={styles.reserveDetails}>
          <p>
            <strong>{data.sendReadyCount}</strong> prêt
            {data.sendReadyCount === 1 ? '' : 's'} à envoyer
          </p>
          <progress
            max={10}
            value={Math.min(data.readyCount, 10)}
            aria-label={`${data.readyCount} textes prêts à venir ; repère de 6 à 10 épisodes`}
          />
          <span>Repère : 6 à 10 épisodes</span>
        </div>
      </section>
      <section aria-labelledby="mois-editorial">
        <div className={styles.monthHeader}>
          <div>
            <h2 id="mois-editorial" className={styles.month}>
              {month.label}
            </h2>
            <p className={styles.note}>
              {data.newsletterCount} newsletter
              {data.newsletterCount === 1 ? '' : 's'} · {data.publicCount}{' '}
              publication{data.publicCount === 1 ? '' : 's'} publique
              {data.publicCount === 1 ? '' : 's'}
            </p>
          </div>
          <nav
            aria-label="Navigation entre les mois"
            className={styles.navigation}
          >
            {month.previous ? (
              <Link
                href={`?mois=${month.previous}`}
                className={`${admin.button} ${admin.secondaryButton}`}
                aria-label="Mois précédent"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>
            ) : (
              <span className={styles.limit}>Début du calendrier</span>
            )}
            <Link
              href={`?mois=${month.current}`}
              className={`${admin.button} ${admin.secondaryButton}`}
              aria-current={month.value === month.current ? 'date' : undefined}
            >
              Ce mois
            </Link>
            {month.next ? (
              <Link
                href={`?mois=${month.next}`}
                className={`${admin.button} ${admin.secondaryButton}`}
                aria-label="Mois suivant"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <span className={styles.limit}>Fin du calendrier</span>
            )}
          </nav>
        </div>
        {data.entries.length ? (
          <div className={styles.editions}>
            {data.entries.map((entry) => (
              <Edition key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className={admin.card}>
            <EmptyState>
              <CalendarDays size={26} aria-hidden="true" />
              <strong>Aucune publication prévue ce mois-ci</strong>
              <p>
                Parcourez les mois suivants ou choisissez les dates d’un Carnet
                dans son édition.
              </p>
            </EmptyState>
          </div>
        )}
      </section>
      <section
        className={styles.unscheduled}
        aria-labelledby="carnets-a-planifier"
      >
        <div className={styles.monthHeader}>
          <div>
            <h2 id="carnets-a-planifier">À planifier</h2>
            <p className={styles.note}>
              {data.unscheduledTotal} Carnet
              {data.unscheduledTotal === 1 ? '' : 's'} sans calendrier · réserve
              indépendante du mois affiché
            </p>
          </div>
        </div>
        {data.unscheduled.length ? (
          <div className={styles.editions}>
            {data.unscheduled.map((entry) => (
              <Edition key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className={styles.note}>Aucun Carnet sans date à planifier.</p>
        )}
        {data.unscheduledTotal > data.unscheduled.length && (
          <p className={styles.note}>
            Les 10 premiers Carnets sont affichés.{' '}
            <Link href="/admin/carnets">Voir tous les Carnets</Link>
          </p>
        )}
      </section>
      <details className={`${admin.card} ${styles.legend}`}>
        <summary>Comment sont calculés les états ?</summary>
        <ol>
          {EDITORIAL_STATES.map((state, i) => (
            <li key={state}>
              <strong>{state}</strong>
              <span>
                {
                  [
                    'Chapitre non validé ou coupure incomplète.',
                    'Chapitre validé, extrait newsletter et suite du récit présents.',
                    'Illustration avec texte alternatif, Comptoir disponible (ou vide), objet/preheader et test de la version actuelle validés.',
                    'Campagne de diffusion programmée ; une date prévisionnelle ne suffit pas.',
                    'Accès newsletter ouvert selon le calendrier de diffusion existant.',
                    'Date publique atteinte et Carnet accessible selon les règles existantes.',
                  ][i]
                }
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.note}>
          Le stock est relu à l’ouverture de la page et revérifié lors de la
          programmation. Un stock devenu indisponible n’efface pas une diffusion
          déjà programmée ou publiée. Les archives sont exclues.
        </p>
      </details>
    </>
  );
}
