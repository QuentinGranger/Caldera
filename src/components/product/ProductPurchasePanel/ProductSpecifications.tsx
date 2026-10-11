'use client';
import { useSearchParams } from 'next/navigation';
import { languageLabels } from '@/lib/catalog/params';
import {
  selectProductVariant,
  conditionLabels,
  type ProductVariantView,
} from '@/lib/product/purchase';
import { formatProductDate, formatProductWeight } from '@/utils/formatProduct';
import styles from './ProductPurchasePanel.module.scss';

export function ProductSpecifications({
  variants,
  typeLabel,
  releaseDate,
}: {
  variants: ProductVariantView[];
  typeLabel: string;
  releaseDate: string | null;
}) {
  const params = useSearchParams();
  const variant = selectProductVariant(variants, params.get('variant'));
  if (!variant) return null;
  return (
    <section
      className={styles.specs}
      aria-label="Caractéristiques de la variante"
    >
      <h2>Caractéristiques</h2>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{typeLabel}</dd>
        </div>
        <div>
          <dt>Langue</dt>
          <dd>{languageLabels[variant.language]}</dd>
        </div>
        <div>
          <dt>État</dt>
          <dd>{conditionLabels[variant.condition]}</dd>
        </div>
        <div>
          <dt>SKU</dt>
          <dd>{variant.sku}</dd>
        </div>
        {releaseDate && (
          <div>
            <dt>Date de sortie</dt>
            <dd>{formatProductDate(releaseDate)}</dd>
          </div>
        )}
        {variant.weightGrams !== null && (
          <div>
            <dt>Poids</dt>
            <dd>{formatProductWeight(variant.weightGrams)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
