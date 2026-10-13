import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader, Badge } from '@/components/admin/AdminUI';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { CarnetEditor } from '@/components/admin/carnets/CarnetEditor';
import { getAdminCarnet } from '@/lib/carnets/admin';
import {
  saveCarnetChapterAction,
  archiveCarnetChapterAction,
  restoreCarnetChapterAction,
} from '@/lib/carnets/actions';
import {
  parseCarnetContent,
  CARNET_STATUS_LABELS,
} from '@/lib/carnets/content';
import { formatDate } from '@/lib/admin/format';
import styles from '@/components/admin/Admin.module.scss';
export default async function EditCarnetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapter = await getAdminCarnet(id);
  if (!chapter) notFound();
  const archived = chapter.status === 'ARCHIVED';
  return (
    <>
      <PageHeader
        title={`Carnet #${String(chapter.number).padStart(3, '0')} · ${chapter.title}`}
        description="La newsletter et le chapitre utilisent une seule source narrative."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/carnets"
        >
          Tous les Carnets
        </Link>
      </PageHeader>
      <section className={styles.card} aria-label="État éditorial">
        <Badge
          value={CARNET_STATUS_LABELS[chapter.status]}
          tone={chapter.status === 'READY' ? 'success' : 'neutral'}
        />
        <p>
          Modifié le {formatDate(chapter.updatedAt)} · créé par{' '}
          {chapter.createdBy.name} · révision {chapter.revision}
        </p>
        <small>
          Aucune publication ni diffusion automatique dans cette étape.
        </small>
      </section>
      <CarnetEditor
        action={saveCarnetChapterAction}
        readOnly={archived}
        revision={String(chapter.revision)}
        value={{
          id: chapter.id,
          revision: chapter.revision,
          number: chapter.number,
          title: chapter.title,
          slug: chapter.slug,
          arcTitle: chapter.arcTitle ?? '',
          arcPosition: chapter.arcPosition?.toString() ?? '',
          arcTotal: chapter.arcTotal?.toString() ?? '',
          status: chapter.status === 'READY' ? 'READY' : 'DRAFT',
          content: parseCarnetContent(chapter.content),
        }}
      />
      <section className={styles.card} aria-label="Archivage du Carnet">
        <h2>{archived ? 'Restaurer ce Carnet' : 'Archiver ce Carnet'}</h2>
        <p>
          {archived
            ? 'Restaurez le récit pour reprendre son écriture. Il retrouvera le statut brouillon.'
            : 'L’archivage retire le Carnet de la liste courante et conserve le récit. Cette action est réversible.'}
        </p>
        <AdminForm
          action={
            archived ? restoreCarnetChapterAction : archiveCarnetChapterAction
          }
          guard={false}
          requireSaved={!archived}
          savedWarning="Enregistrez les modifications du Carnet avant de l’archiver."
          submit={archived ? 'Restaurer en brouillon' : 'Archiver le Carnet'}
          confirm={
            archived
              ? undefined
              : 'Archiver ce Carnet ? Le récit sera conservé et pourra être restauré.'
          }
        >
          <Hidden name="id" value={chapter.id} />
          <Hidden name="revision" value={chapter.revision} />
        </AdminForm>
      </section>
    </>
  );
}
