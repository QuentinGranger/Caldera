import Link from 'next/link';
import { getNextCarnetNumber } from '@/lib/carnets/admin';
import { PageHeader } from '@/components/admin/AdminUI';
import { CarnetEditor } from '@/components/admin/carnets/CarnetEditor';
import { saveCarnetChapterAction } from '@/lib/carnets/actions';
import { emptyCarnetContent } from '@/lib/carnets/content';
import styles from '@/components/admin/Admin.module.scss';
export default async function NewCarnetPage() {
  const number = await getNextCarnetNumber();
  return (
    <>
      <PageHeader
        title="Nouveau Carnet"
        description="Écrivez le chapitre complet et placez la fin de son extrait newsletter."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/carnets"
        >
          Tous les Carnets
        </Link>
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/newsletter"
        >
          Newsletter
        </Link>
      </PageHeader>
      <CarnetEditor
        action={saveCarnetChapterAction}
        value={{
          revision: 0,
          number,
          title: '',
          slug: '',
          arcTitle: '',
          arcPosition: '',
          arcTotal: '',
          status: 'DRAFT',
          content: emptyCarnetContent(),
        }}
      />
    </>
  );
}
