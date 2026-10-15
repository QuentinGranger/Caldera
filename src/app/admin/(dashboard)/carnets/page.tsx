import Link from 'next/link';
import { Plus, BookOpen, CalendarDays, Layers3, List } from 'lucide-react';
import {
  AdminTable,
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { FilterPanel } from '@/components/admin/FilterPanel';
import { getAdminCarnetArcs } from '@/lib/carnets/arcs';
import { CarnetArcs } from '@/components/admin/carnets/CarnetArcs';
import { adminListHref } from '@/lib/admin/list-url';
import { getAdminCarnets } from '@/lib/carnets/admin';
import { CARNET_STATUSES, CARNET_STATUS_LABELS } from '@/lib/carnets/content';
import { formatDate } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import styles from '@/components/admin/Admin.module.scss';
export default async function CarnetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const list = param(params, 'vue') === 'liste';
  const data = list ? await getAdminCarnets(params) : null;
  const arcs = list ? null : await getAdminCarnetArcs(params);
  return (
    <>
      <PageHeader
        title="Les Carnets de Caldera"
        description="Organisez vos récits par arc et retrouvez les prochains chapitres à préparer."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/carnets/calendrier"
        >
          <CalendarDays size={16} aria-hidden="true" />
          Calendrier éditorial
        </Link>
        <Link className={styles.button} href="/admin/carnets/nouveau">
          <Plus size={16} /> Nouveau Carnet
        </Link>
      </PageHeader>
      <nav className={styles.tabs} aria-label="Vue des Carnets">
        <Link
          href={adminListHref('/admin/carnets', params, { vue: undefined })}
          aria-current={!list ? 'page' : undefined}
        >
          <Layers3 size={16} aria-hidden="true" />
          Par arc
        </Link>
        <Link
          href={adminListHref('/admin/carnets', params, { vue: 'liste' })}
          aria-current={list ? 'page' : undefined}
        >
          <List size={16} aria-hidden="true" />
          Liste des épisodes
        </Link>
      </nav>
      <FilterPanel
        params={params}
        keep={list ? { vue: 'liste' } : {}}
        action="/admin/carnets"
        search={param(params, 'search')}
        placeholder="Titre, numéro ou arc"
        activeCount={param(params, 'status') ? 1 : 0}
      >
        <label>
          Statut éditorial
          <select name="status" defaultValue={param(params, 'status')}>
            <option value="">Carnets non archivés</option>
            {CARNET_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CARNET_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ordre
          <select
            name="sort"
            defaultValue={
              param(params, 'sort') === 'modified' ? 'modified' : 'number'
            }
          >
            <option value="number">Numéro du Carnet</option>
            <option value="modified">Dernière modification</option>
          </select>
        </label>
      </FilterPanel>
      {arcs && <CarnetArcs data={arcs} params={params} />}
      {data && (
        <>
          {data.chapters.length ? (
            <AdminTable
              caption="Carnets éditoriaux"
              headings={['Numéro', 'Titre', 'Arc', 'Statut', 'Modification']}
            >
              {data.chapters.map((chapter) => (
                <tr key={chapter.id}>
                  <td>#{String(chapter.number).padStart(3, '0')}</td>
                  <td>
                    <Link href={`/admin/carnets/${chapter.id}`}>
                      {chapter.title}
                    </Link>
                    <small>{chapter.slug}</small>
                  </td>
                  <td>
                    {chapter.arcTitle ?? '—'}
                    {chapter.arcPosition && chapter.arcTotal ? (
                      <small>
                        {chapter.arcPosition} / {chapter.arcTotal}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <Badge
                      value={CARNET_STATUS_LABELS[chapter.status]}
                      tone={chapter.status === 'READY' ? 'success' : 'neutral'}
                    />
                  </td>
                  <td>{formatDate(chapter.updatedAt)}</td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <EmptyState>
              <BookOpen size={26} />
              Aucun Carnet dans cette sélection. Créez votre premier récit ou
              consultez les archives.
            </EmptyState>
          )}
          <Pagination
            path="/admin/carnets"
            page={data.page}
            total={data.total}
            params={params}
          />
        </>
      )}
    </>
  );
}
