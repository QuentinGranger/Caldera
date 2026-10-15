import Link from 'next/link';
import { getCarnetArcTitles } from '@/lib/carnets/arcs';
import { arcDraftDefaults } from '@/lib/carnets/arcs-model';
import type { SearchParams } from '@/lib/admin/queries';
import { getCarnetProducts } from '@/lib/carnets/comptoir';
import { getNextCarnetNumber } from '@/lib/carnets/admin';
import { PageHeader } from '@/components/admin/AdminUI';
import { CarnetEditor } from '@/components/admin/carnets/CarnetEditor';
import { saveCarnetChapterAction } from '@/lib/carnets/actions';
import { emptyCarnetContent } from '@/lib/carnets/content';
import styles from '@/components/admin/Admin.module.scss';
export default async function NewCarnetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const defaults = arcDraftDefaults(await searchParams);
  const [number, products, arcTitles] = await Promise.all([
    getNextCarnetNumber(),
    getCarnetProducts(),
    getCarnetArcTitles(),
  ]);
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
        products={products}
        arcTitles={arcTitles}
        value={{
          revision: 0,
          number,
          title: '',
          slug: '',
          ...defaults,
          status: 'DRAFT',
          content: emptyCarnetContent(),
        }}
      />
    </>
  );
}
