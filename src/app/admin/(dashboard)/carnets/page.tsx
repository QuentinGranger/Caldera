import Link from 'next/link';
import { Plus, BookOpen, CalendarDays } from 'lucide-react';
import {
  AdminTable,
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { FilterPanel } from '@/components/admin/FilterPanel';
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
  const data = await getAdminCarnets(params);
  return (
    <>
      <PageHeader
        title="Les Carnets de Caldera"
        description="Un chapitre écrit une seule fois, un extrait newsletter dérivé de sa coupure. Cette section prépare les récits sans les publier."
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
      <FilterPanel
        params={params}
        action="/admin/carnets"
        search={param(params, 'search')}
        placeholder="Titre, numéro ou arc"
        activeCount={param(params, 'status') ? 1 : 0}
      >
        <label>
          Statut éditorial
          <select name="status" defaultValue={param(params, 'status')}>
            <option value="">Brouillons et prêts</option>
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
  );
}
