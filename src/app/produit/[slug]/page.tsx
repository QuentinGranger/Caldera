import { ArrivalLayers } from '@/components/transitions/ArrivalLayers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { notFound, permanentRedirect } from 'next/navigation';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { ProductGallery } from '@/components/product/ProductGallery/ProductGallery';
import { ProductPageSkeleton } from '@/components/loading/LoadingSkeleton';
import { currentCustomer } from '@/lib/account/auth';
import { PurchaseAssurance } from '@/components/shipping/PurchaseAssurance';
import { ProductSpecifications } from '@/components/product/ProductPurchasePanel/ProductSpecifications';
import { ProductPurchasePanel } from '@/components/product/ProductPurchasePanel/ProductPurchasePanel';
import { ProductWishlistButton } from '@/components/product/ProductWishlistButton/ProductWishlistButton';
import { ProductDetails } from '@/components/product/ProductDetails/ProductDetails';
import { ProductSetSection } from '@/components/product/ProductSetSection/ProductSetSection';
import { ProductExplore } from '@/components/product/ProductExplore/ProductExplore';
import { RelatedProducts } from '@/components/product/RelatedProducts/RelatedProducts';
import {
  getProductPageRoute,
  loadProductPage,
  loadProductDiscovery,
  productPageMetadata,
} from '@/lib/product/page';
import type { ProductDetail } from '@/lib/catalog/queries';
import { productTypeLabels } from '@/lib/product/purchase';
import { isSealedProduct } from '@/lib/product/services';
import { productPath } from '@/lib/product/seo';
import styles from './product.module.scss';
type Props = { params: Promise<{ slug: string }> };
async function resolve(params: Props['params']) {
  await connection();
  const route = await getProductPageRoute((await params).slug);
  if (route.type === 'redirect') permanentRedirect(route.path);
  // 'gone' answers 410 in src/proxy.ts; a stale proxy list still gets a 404.
  if (route.type === 'not-found' || route.type === 'gone') notFound();
  return route;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { product, decision } = await resolve(params);
  return productPageMetadata(product, decision);
}
async function ProductContent({
  route,
}: {
  route: Awaited<ReturnType<typeof resolve>>;
}) {
  const { product, decision } = route;
  const page = await loadProductPage(product, decision);
  const images = product.images.length
    ? product.images
    : [{ url: product.image, alt: product.imageAlt }];
  const salesEnabled = process.env.CATALOG_DEMO_MODE !== '1';
  // Back-in-stock alerts go to a signed-in customer's address.
  const alertEmail =
    salesEnabled &&
    !product.isDemonstration &&
    product.variants.some((variant) => variant.availability === 'OUT_OF_STOCK')
      ? ((await currentCustomer())?.email ?? null)
      : null;
  return (
    <main id="contenu" tabIndex={-1} className={styles.main} data-product-world>
      <Container>
        <JsonLd data={page.structuredData} />
        <Breadcrumb
          items={page.breadcrumb}
          currentPath={productPath(product.slug)}
        />
        <div className={styles.hero}>
          <ProductGallery
            key={product.id}
            images={images}
            name={product.name}
            slug={product.slug}
          />
          <div className={styles.info}>
            <ArrivalLayers>
              <p className={styles.eyebrow}>
                {productTypeLabels[product.productType]}
              </p>
              <h1>{product.name}</h1>
              {product.tcgSet &&
                (page.setHref ? (
                  <Link href={page.setHref} className={styles.setLink}>
                    Extension : {product.tcgSet.name}
                  </Link>
                ) : (
                  <p className={styles.setName}>
                    Extension : {product.tcgSet.name}
                  </p>
                ))}
              <div className={styles.purchasePanel}>
                {product.isDemonstration ? (
                  <div className={styles.notice}>
                    <strong>Produit d’exemple — non commercialisé.</strong>
                    <p>
                      Cette fiche sert à présenter le site. Aucun prix, stock,
                      date de sortie ou délai de livraison réel n’est annoncé.
                      Aucun achat ni alerte stock n’est possible.
                    </p>
                  </div>
                ) : !salesEnabled ? (
                  <div className={styles.notice}>
                    <strong>Les achats ne sont pas encore ouverts.</strong>
                    <p>
                      Vous pouvez découvrir ce produit et l’enregistrer dans vos
                      favoris.
                    </p>
                  </div>
                ) : (
                  <ProductPurchasePanel
                    key={product.id}
                    productId={product.id}
                    variants={product.variants}
                    newArrival={product.newArrival}
                    preorder={product.preorder}
                    releaseDate={product.releaseDate}
                    typeLabel={productTypeLabels[product.productType]}
                    sealed={isSealedProduct(product.productType)}
                    shipping={page.shipping}
                    accountEmail={alertEmail}
                  />
                )}
                {(product.isDemonstration || !salesEnabled) && (
                  <PurchaseAssurance commerce={false} />
                )}
                {salesEnabled && !product.isDemonstration && (
                  <Suspense fallback={null}>
                    <UnavailableNotice product={product} />
                  </Suspense>
                )}
              </div>
              {product.shortDescription && (
                <p className={styles.summary}>{product.shortDescription}</p>
              )}
              <ProductWishlistButton
                productId={product.id}
                productName={product.name}
              />
            </ArrivalLayers>
          </div>
        </div>
        <Suspense fallback={null}>
          <ProductAlternatives product={product} />
        </Suspense>
        {salesEnabled && !product.isDemonstration && (
          <ProductSpecifications
            variants={product.variants}
            typeLabel={productTypeLabels[product.productType]}
            releaseDate={product.releaseDate}
          />
        )}
        <ProductDetails description={product.description} tags={product.tags} />
        {product.tcgSet && (
          <ProductSetSection set={product.tcgSet} href={page.setHref} />
        )}
        <Suspense fallback={null}>
          <ProductDiscovery product={product} />
        </Suspense>
      </Container>
    </main>
  );
}
function alternativesFor(
  product: ProductDetail,
  page: Awaited<ReturnType<typeof loadProductDiscovery>>,
) {
  return product.availability === 'OUT_OF_STOCK'
    ? page.related.filter((item) => item.availability !== 'OUT_OF_STOCK')
    : [];
}

async function UnavailableNotice({ product }: { product: ProductDetail }) {
  if (product.availability !== 'OUT_OF_STOCK') return null;
  const alternatives = alternativesFor(
    product,
    await loadProductDiscovery(product),
  );
  if (!product.variants.length && !alternatives.length) return null;
  return (
    <div className={styles.notice}>
      {product.variants.length > 0 && (
        <p>
          <strong>Produit épuisé.</strong>{' '}
          {product.variants.length > 1
            ? 'Toutes les versions de ce produit sont en rupture de stock.'
            : 'Ce produit est en rupture de stock.'}
        </p>
      )}
      {alternatives.length > 0 && (
        <a href="#alternatives-title">
          {alternatives.length > 1
            ? `Voir les ${alternatives.length} produits similaires disponibles`
            : 'Voir un produit similaire disponible'}
        </a>
      )}
    </div>
  );
}

async function ProductAlternatives({ product }: { product: ProductDetail }) {
  if (product.availability !== 'OUT_OF_STOCK') return null;
  const alternatives = alternativesFor(
    product,
    await loadProductDiscovery(product),
  );
  return alternatives.length > 0 ? (
    <RelatedProducts
      tone="night"
      products={alternatives}
      id="alternatives-title"
      eyebrow={product.variants.length ? 'Produit épuisé' : 'Indisponible'}
      title="Alternatives disponibles"
    />
  ) : null;
}

async function ProductDiscovery({ product }: { product: ProductDetail }) {
  const page = await loadProductDiscovery(product);
  const alternatives = alternativesFor(product, page);
  const suggestions = [
    ...page.complementary,
    ...page.related.filter(
      (item) =>
        item.availability !== 'OUT_OF_STOCK' &&
        item.availability !== 'PREORDER' &&
        !page.complementary.some((accessory) => accessory.id === item.id),
    ),
  ].slice(0, 4);
  return (
    <>
      <ProductExplore
        links={page.links}
        glossary={page.glossary}
        guides={page.guides}
      />
      {!alternatives.length && (
        <RelatedProducts
          products={suggestions}
          tone="night"
          title="Vous pourriez aussi aimer"
          eyebrow={
            page.complementary.length
              ? 'Pour compléter votre sélection'
              : 'Poursuivre l’exploration'
          }
          description={
            page.complementary.length
              ? 'Des accessoires de protection et des produits à découvrir. Vérifiez le format et les dimensions sur chaque fiche avant de choisir.'
              : undefined
          }
        />
      )}
    </>
  );
}

export default async function ProductPage({ params }: Props) {
  // Decide 404/410/308 before opening a streaming boundary so HTTP semantics
  // remain exact. The heavier product view can then reveal progressively.
  const route = await resolve(params);
  return (
    <Suspense fallback={<ProductPageSkeleton product={route.product} />}>
      <ProductContent route={route} />
    </Suspense>
  );
}
