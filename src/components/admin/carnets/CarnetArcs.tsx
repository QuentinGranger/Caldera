import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  CheckCircle2,
  PencilLine,
  Circle,
  Archive,
  Plus,
} from 'lucide-react';
import { Badge } from '../AdminUI';
import type { CarnetArcs as Data } from '@/lib/carnets/arcs';
import type { SearchParams } from '@/lib/admin/queries';
import { adminListHref } from '@/lib/admin/list-url';
import admin from '../Admin.module.scss';
import styles from './CarnetArcs.module.scss';
export function CarnetArcs({
  data,
  params,
}: {
  data: Data;
  params: SearchParams;
}) {
  return (
    <section aria-labelledby="arcs-narratifs">
      <div className={styles.heading}>
        <div>
          <h2 id="arcs-narratifs">Vos arcs narratifs</h2>
          <p>
            {data.total} groupe{data.total === 1 ? '' : 's'} ·{' '}
            {data.matchingChapters} chapitre
            {data.matchingChapters === 1 ? '' : 's'}
            {data.filtered ? ' correspondant aux filtres' : ''}
          </p>
        </div>
        <span>8 arcs par page · ordre des épisodes conservé</span>
      </div>
      <p className={styles.note}>
        Les numéros d’arc suivent le premier épisode de chaque arc. « Prêt »
        valide le récit et sa coupure ; les contrôles d’envoi restent dans
        l’édition et le calendrier.
      </p>
      {!data.arcs.length && (
        <div className={admin.card}>
          <BookOpen size={26} aria-hidden="true" />
          <p>
            Aucun Carnet dans cette sélection. Créez votre premier récit ou
            ajustez les filtres.
          </p>
        </div>
      )}
      <div className={styles.arcs}>
        {data.arcs.map((arc, index) => (
          <details
            key={arc.key}
            className={styles.arc}
            open={index < 2 || data.filtered}
          >
            <summary>
              <div className={styles.arcTitle}>
                <span className={styles.kicker}>
                  {arc.number ? `Arc ${arc.number}` : 'À organiser'}
                </span>
                <h3>{arc.title ?? 'Carnets sans arc'}</h3>
                <span className={styles.total}>
                  {arc.chapterCount} chapitre{arc.chapterCount === 1 ? '' : 's'}{' '}
                  enregistré{arc.chapterCount === 1 ? '' : 's'}
                  {arc.title
                    ? ` sur ${arc.total}${arc.declared ? ' prévus' : ''}`
                    : ''}
                </span>
              </div>
              <div className={styles.progress}>
                <strong>
                  {arc.complete}/{arc.total} prêts ou diffusés
                </strong>
                <progress
                  max={arc.total}
                  value={arc.complete}
                  aria-label={`${arc.title ?? 'Carnets sans arc'} : ${arc.complete} chapitres prêts ou diffusés sur ${arc.total}`}
                />
                <span>
                  {arc.counts.public} publié{arc.counts.public === 1 ? '' : 's'}{' '}
                  · {arc.counts.ready} prêt{arc.counts.ready === 1 ? '' : 's'}
                  {arc.counts.early
                    ? ` · ${arc.counts.early} en accès anticipé`
                    : ''}
                  {arc.counts.archived
                    ? ` · ${arc.counts.archived} archivé${arc.counts.archived === 1 ? '' : 's'}`
                    : ''}
                </span>
              </div>
              <ChevronDown
                size={19}
                aria-hidden="true"
                className={styles.chevron}
              />
            </summary>
            <div className={styles.body}>
              {!!arc.warnings.length && (
                <div className={styles.warning}>
                  <strong>Repères d’arc à vérifier</strong>
                  <ul>
                    {arc.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {arc.chapters.length < arc.chapterCount && (
                <p className={styles.note}>
                  {arc.chapters.length} chapitre
                  {arc.chapters.length === 1 ? '' : 's'} affiché
                  {arc.chapters.length === 1 ? '' : 's'} sur {arc.chapterCount}.
                  La progression porte sur l’arc complet.{' '}
                  {data.filtered ? (
                    <Link href="/admin/carnets">Retirer les filtres</Link>
                  ) : (
                    <Link href="/admin/carnets?status=ARCHIVED">
                      Voir les archives masquées
                    </Link>
                  )}
                </p>
              )}
              <ol className={styles.chapters}>
                {arc.chapters.map((chapter) => {
                  const done = ['READY', 'PUBLIC', 'EARLY'].includes(
                    chapter.kind,
                  );
                  const Icon = done
                    ? CheckCircle2
                    : chapter.kind === 'WORKING'
                      ? PencilLine
                      : chapter.kind === 'ARCHIVED'
                        ? Archive
                        : Circle;
                  return (
                    <li key={chapter.id}>
                      <Link
                        href={`/admin/carnets/${chapter.id}`}
                        className={styles.chapter}
                      >
                        <span className={styles.number}>
                          {String(chapter.number).padStart(2, '0')}
                        </span>
                        <span className={styles.chapterTitle}>
                          {chapter.title}
                          <small>
                            {chapter.position
                              ? `Position ${chapter.position}`
                              : arc.title
                                ? 'Position à renseigner'
                                : 'Sans arc'}
                          </small>
                        </span>
                        <Icon
                          size={18}
                          aria-hidden="true"
                          className={
                            done
                              ? styles.done
                              : chapter.kind === 'WORKING'
                                ? styles.working
                                : styles.empty
                          }
                        />
                        <Badge
                          value={chapter.label}
                          tone={
                            done
                              ? 'success'
                              : chapter.kind === 'WORKING'
                                ? 'pending'
                                : 'neutral'
                          }
                        />
                      </Link>
                      <Link
                        className={styles.metricsLink}
                        href={`/admin/carnets/${chapter.id}/analytics`}
                      >
                        Mesures de lecture · #
                        {String(chapter.number).padStart(3, '0')}
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {!!arc.missing.length && !data.filtered && (
                <div className={styles.gaps}>
                  <p>
                    {arc.missing.length} position
                    {arc.missing.length === 1 ? '' : 's'} sans chapitre créé
                  </p>
                  {arc.missing.slice(0, 6).map((position) => (
                    <Link
                      key={position}
                      href={`/admin/carnets/nouveau?${new URLSearchParams({ arcTitle: arc.title!, arcPosition: String(position), arcTotal: String(arc.total) })}`}
                    >
                      <Circle size={15} aria-hidden="true" />
                      <span>Position {position} · chapitre non créé</span>
                      <Plus size={15} aria-hidden="true" />
                    </Link>
                  ))}
                  {arc.missing.length > 6 && (
                    <small>
                      Les six premières positions manquantes sont affichées.
                    </small>
                  )}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
      <nav aria-label="Pagination des arcs" className={admin.pagination}>
        <span>
          {data.total} groupe{data.total === 1 ? '' : 's'}
          {data.pages > 1 ? ` · Page ${data.page} sur ${data.pages}` : ''}
        </span>
        {data.pages > 1 && (
          <div className={admin.pageLinks}>
            {data.page > 1 ? (
              <Link
                href={adminListHref('/admin/carnets', params, {
                  page: String(data.page - 1),
                })}
              >
                Précédente
              </Link>
            ) : (
              <span aria-disabled="true">Précédente</span>
            )}
            {data.page < data.pages ? (
              <Link
                href={adminListHref('/admin/carnets', params, {
                  page: String(data.page + 1),
                })}
              >
                Suivante
              </Link>
            ) : (
              <span aria-disabled="true">Suivante</span>
            )}
          </div>
        )}
      </nav>
    </section>
  );
}
