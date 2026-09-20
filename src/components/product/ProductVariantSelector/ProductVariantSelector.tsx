import { useId } from 'react';
import { languageLabels } from '@/lib/catalog/params';
import { availabilityLabels } from '@/lib/catalog/getAvailability';
import type { ProductVariantView } from '@/lib/product/purchase';
import styles from './ProductVariantSelector.module.scss';
export function ProductVariantSelector({
  variants,
  selected,
  onChange,
}: {
  variants: ProductVariantView[];
  selected: string;
  onChange: (sku: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className={styles.selector}>
      <legend>Langue et version</legend>
      <div>
        {variants.map((variant) => (
          <label key={variant.id} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={variant.sku}
              checked={variant.sku === selected}
              onChange={() => onChange(variant.sku)}
            />
            <span>
              <strong>{languageLabels[variant.language]}</strong>
              <small>{availabilityLabels[variant.availability]}</small>
              {variants.filter((v) => v.language === variant.language).length >
                1 && <small>{variant.sku}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
