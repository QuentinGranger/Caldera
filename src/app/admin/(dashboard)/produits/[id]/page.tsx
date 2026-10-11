import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Package } from 'lucide-react';
import { DetailNavigation } from '@/components/admin/DetailNavigation';
import { DetailOverview } from '@/components/admin/DetailOverview';
import { notFound } from 'next/navigation';
import { getAdminProduct, getAdminOptions } from '@/lib/admin/queries';
import { getProductSupplierOffers } from '@/lib/supplier-import/admin';
import { getStorefrontStatus } from '@/lib/admin/storefront';
import { StorefrontPanel } from '@/components/admin/StorefrontPanel';
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
  const [offers, storefront] = await Promise.all([
    getProductSupplierOffers(product.id),
    getStorefrontStatus(product.id),
  ]);
  const activeVariants = product.variants.filter((variant) => variant.isActive);
  const available = activeVariants.reduce(
    (sum, variant) => sum + variant.availableQuantity,
    0,
  );
  const lowestPrice = activeVariants.length
    ? Math.min(...activeVariants.map((variant) => variant.price.toNumber()))
    : null;
  const image =
    product.images.find((item) => item.isPrimary) ?? product.images[0];
  return (
    <div className={styles.detailPage}>
      <PageHeader
        title={product.name}
        description={`Mis à jour le ${formatDate(product.updatedAt)} · heure de Paris`}
      >
        <div className={styles.inline}>
          <Badge value={product.status} />
          <Link href="/admin/produits">Retour aux produits</Link>
        </div>
      </PageHeader>
      <DetailOverview
        visual={
          image ? (
            <Image src={image.url} alt="" width={88} height={88} />
          ) : (
            <Package size={30} aria-hidden="true" />
          )
        }
        entries={[
          {
            label: 'Prix de vente',
            value: lowestPrice === null ? '—' : euros(lowestPrice),
            detail:
              activeVariants.length > 1
                ? 'À partir de · variantes actives'
                : activeVariants.length
                  ? 'Variante active'
                  : 'Aucune variante active',
          },
          {
            label: 'Stock disponible',
            value: available,
            detail: 'Sur les variantes actives',
          },
          {
            label: 'Organisation',
            value:
              options.categories.find((item) => item.id === product.categoryId)
                ?.name ?? '—',
            detail: label(product.productType),
          },
          {
            label: 'Visibilité boutique',
            value: storefront.listed ? 'En ligne' : 'Masqué',
            detail: `${product.images.length} visuel${product.images.length > 1 ? 's' : ''}`,
          },
        ]}
      />
      <StorefrontPanel {...storefront} href={`/produit/${product.slug}`} />
      <DetailNavigation
        sections={[
          { id: 'informations', label: 'Informations' },
          {
            id: 'variantes',
            label: 'Variantes',
            count: product.variants.length,
          },
          { id: 'images', label: 'Images', count: product.images.length },
          { id: 'fournisseurs', label: 'Fournisseurs', count: offers.length },
          { id: 'publication', label: 'Publication' },
        ]}
      />
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
          <details key={variant.id} className={styles.variantCard}>
            <summary>
              <span className={styles.variantIdentity}>
                <strong>{variant.sku}</strong>
                <small>
                  {label(variant.language)}
                  {variant.isDefault ? ' · Variante par défaut' : ''}
                </small>
              </span>
              <span className={styles.variantPrice}>
                {euros(variant.price)}
              </span>
              <span className={styles.variantAvailability}>
                {variant.isActive
                  ? `${variant.availableQuantity} disponible(s)`
                  : 'Inactive'}
              </span>
              <ChevronDown size={18} aria-hidden="true" />
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
      <section className={styles.card} id="fournisseurs">
        <h2>Offres fournisseurs · {offers.length}</h2>
        {offers.length ? (
          <ul className={styles.plainList}>
            {offers.map((offer) => (
              <li key={offer.id}>
                <Link href={`/admin/fournisseurs/${offer.supplier.id}`}>
                  {offer.supplier.name}
                </Link>{' '}
                · <code>{offer.supplierSku}</code> · achat HT{' '}
                {euros(offer.purchasePrice)}
                {offer.msrp ? ` · PVC ${euros(offer.msrp)}` : ''} ·{' '}
                {label(`AVAIL_${offer.availability}`)}
                {offer.stock !== null ? ` (${offer.stock})` : ''} · variante{' '}
                {offer.variant?.sku}
                {offer.status === 'MISSING' && (
                  <>
                    {' '}
                    <Badge value="OFFER_MISSING" tone="danger" />
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Aucune offre fournisseur liée : elles apparaissent après un import
            de catalogue validé.
          </p>
        )}
      </section>
      <section
        className={`${styles.card} ${styles.publicationPanel}`}
        id="publication"
      >
        <h2>Publication</h2>
        <p>
          Les brouillons et produits archivés sont masqués sur la boutique. Les
          commandes historiques restent intactes.
        </p>
        {product.sourceImportId && product.status === 'DRAFT' && (
          <p>
            Créé depuis un catalogue fournisseur : avant publication, ajoutez
            une image, une description, sa vraie catégorie et un prix de vente,
            et relisez son titre.
          </p>
        )}
        <div className={styles.actions}>
          {(['ACTIVE', 'DRAFT', 'ARCHIVED'] as const)
            .filter((status) => status !== product.status)
            .map((status) => (
              <AdminForm
                key={status}
                action={publicationAction}
                tone={status === 'ARCHIVED' ? 'danger' : undefined}
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
    </div>
  );
}
