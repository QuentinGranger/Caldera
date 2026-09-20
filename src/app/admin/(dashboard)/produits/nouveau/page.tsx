import Link from 'next/link';
import { getAdminOptions } from '@/lib/admin/queries';
import { PageHeader } from '@/components/admin/AdminUI';
import { ProductInformationForm } from '@/components/admin/ProductInformationForm';
import styles from '@/components/admin/Admin.module.scss';
export default async function NewProductPage() {
  const options = await getAdminOptions();
  return (
    <>
      <PageHeader
        title="Nouveau produit"
        description="Créez un brouillon, puis ajoutez les variantes et les images avant de publier."
      >
        <Link href="/admin/produits">Retour aux produits</Link>
      </PageHeader>
      <section className={styles.card}>
        <ProductInformationForm options={options} />
      </section>
    </>
  );
}
