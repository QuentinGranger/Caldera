import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminProduct, getAdminOptions } from '@/lib/admin/queries';
import { publicationAction } from '@/lib/admin/actions';
import { euros, formatDate, label } from '@/lib/admin/format';
import { PageHeader, Badge } from '@/components/admin/AdminUI';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { ProductInformationForm } from '@/components/admin/ProductInformationForm';
import { VariantEditor } from '@/components/admin/VariantEditor';
import { ImageManager } from '@/components/admin/ImageManager';
import styles from '@/components/admin/Admin.module.scss';
export default async function ProductAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [product, options] = await Promise.all([
    getAdminProduct((await params).id),
    getAdminOptions(),
  ]);
  if (!product) notFound();
  return (
    <>
      <PageHeader
        title={product.name}
        description={`Mis à jour le ${formatDate(product.updatedAt)} · heure de Paris`}
      >
        <div className={styles.inline}>
          <Badge value={product.status} />
          {product.status === 'ACTIVE' && (
            <Link href={`/produit/${product.slug}`}>
              Voir sur la boutique ↗
            </Link>
          )}
          <Link href="/admin/produits">Retour aux produits</Link>
        </div>
      </PageHeader>
      <nav className={styles.tabs} aria-label="Sections produit">
        <a href="#informations">Informations & organisation</a>
        <a href="#variantes">Variantes</a>
        <a href="#images">Images</a>
        <a href="#publication">Publication</a>
      </nav>
      <details className={styles.card} id="informations" open>
        <summary>Informations & organisation</summary>
        <ProductInformationForm
          key={product.updatedAt.toISOString()}
          product={product}
          options={options}
        />
      </details>
      <section className={styles.card} id="variantes">
        <h2>Variantes · {product.variants.length}</h2>
        {product.variants.map((variant) => (
          <details key={variant.id} className={styles.card}>
            <summary>
              {variant.sku} · {label(variant.language)} · {euros(variant.price)}{' '}
              · {variant.availableQuantity} disponible(s)
              {variant.isDefault ? ' · Par défaut' : ''}
              {!variant.isActive ? ' · Inactive' : ''}
            </summary>
            <VariantEditor
              key={variant.updatedAt.toISOString()}
              productId={product.id}
              variant={variant}
            />
          </details>
        ))}
        <details open={!product.variants.length}>
          <summary>Ajouter une variante</summary>
          <VariantEditor productId={product.id} />
        </details>
      </section>
      <section className={styles.card} id="images">
        <h2>Images</h2>
        <ImageManager product={product} />
      </section>
      <section className={styles.card} id="publication">
        <h2>Publication</h2>
        <p>
          Les brouillons et produits archivés sont masqués sur la boutique. Les
          commandes historiques restent intactes.
        </p>
        <div className={styles.actions}>
          {(['ACTIVE', 'DRAFT', 'ARCHIVED'] as const)
            .filter((status) => status !== product.status)
            .map((status) => (
              <AdminForm
                key={status}
                action={publicationAction}
                submit={
                  status === 'ACTIVE'
                    ? 'Publier'
                    : status === 'DRAFT'
                      ? 'Dépublier'
                      : 'Archiver'
                }
                confirm={
                  status === 'ACTIVE'
                    ? undefined
                    : 'Ce produit ne sera plus proposé sur la boutique. Confirmer ?'
                }
              >
                <Hidden name="id" value={product.id} />
                <Hidden name="status" value={status} />
              </AdminForm>
            ))}
        </div>
      </section>
    </>
  );
}
