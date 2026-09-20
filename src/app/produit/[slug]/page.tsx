import Link from 'next/link';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { ProductGallery } from '@/components/product/ProductGallery/ProductGallery';
import { ProductPurchasePanel } from '@/components/product/ProductPurchasePanel/ProductPurchasePanel';
import { ProductDetails } from '@/components/product/ProductDetails/ProductDetails';
import { ProductSetSection } from '@/components/product/ProductSetSection/ProductSetSection';
import { RelatedProducts } from '@/components/product/RelatedProducts/RelatedProducts';
import { getProductBySlug } from '@/lib/catalog/queries';
import { getRelatedProducts } from '@/lib/catalog/getRelatedProducts';
import { getCategory } from '@/lib/catalog/taxonomy';
import { productTypeLabels } from '@/lib/product/purchase';
import {
  productMetadata,
  productJsonLd,
  serializeJsonLd,
} from '@/lib/product/seo';
import styles from './product.module.scss';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  await connection();
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  return productMetadata(product);
}
export default async function ProductPage({ params }: Props) {
  await connection();
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const [category, related] = await Promise.all([
    getCategory(product.categoryInfo.slug),
    getRelatedProducts(product),
  ]);
  const breadcrumb = [
    { label: 'Accueil', href: '/' },
    { label: 'Catalogue', href: '/catalogue' },
    ...(category
      ? [...category.ancestors, category].map((c) => ({
          label: c.name,
          href: `/categorie/${c.slug}`,
        }))
      : []),
    { label: product.name },
  ];
  const images = product.images.length
    ? product.images
    : [{ url: product.image, alt: product.imageAlt }];
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(productJsonLd(product)),
          }}
        />
        <Breadcrumb items={breadcrumb} />
        <div className={styles.hero}>
          <ProductGallery
            key={product.id}
            images={images}
            name={product.name}
          />
          <div className={styles.info}>
            <p className={styles.eyebrow}>
              {productTypeLabels[product.productType]}
            </p>
            <h1>{product.name}</h1>
            {product.tcgSet && (
              <Link
                href={`/extensions/${product.tcgSet.slug}`}
                className={styles.setLink}
              >
                Extension : {product.tcgSet.name}
              </Link>
            )}
            {product.shortDescription && (
              <p className={styles.summary}>{product.shortDescription}</p>
            )}
            <ProductPurchasePanel
              key={product.id}
              productId={product.id}
              variants={product.variants}
              newArrival={product.newArrival}
              releaseDate={product.releaseDate}
              typeLabel={productTypeLabels[product.productType]}
            />
          </div>
        </div>
        <ProductDetails description={product.description} tags={product.tags} />
        {product.tcgSet && <ProductSetSection set={product.tcgSet} />}
        <RelatedProducts products={related} />
      </Container>
    </main>
  );
}
