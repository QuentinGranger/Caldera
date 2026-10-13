import Link from 'next/link';
import { Plus, BookOpen } from 'lucide-react';
import {
  AdminTable,
  Badge,
  EmptyState,
  FilterSelect,
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
        <FilterSelect
          name="status"
          label="Statut éditorial"
          value={param(params, 'status')}
          options={CARNET_STATUSES.map((value) => ({
            value,
            label: CARNET_STATUS_LABELS[value],
          }))}
        />
        <FilterSelect
          name="sort"
          label="Ordre"
          value={param(params, 'sort')}
          options={[
            { value: 'number', label: 'Numéro du Carnet' },
            { value: 'modified', label: 'Dernière modification' },
          ]}
        />
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
          <p>
            Aucun Carnet dans cette sélection. Créez votre premier récit ou
            consultez les archives.
          </p>
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
