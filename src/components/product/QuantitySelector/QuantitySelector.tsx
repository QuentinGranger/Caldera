import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { normalizeQuantity } from '@/lib/product/purchase';
import styles from './QuantitySelector.module.scss';
export function QuantitySelector({
  quantity,
  max,
  disabled = false,
  onChange,
  commitOnBlur = false,
}: {
  quantity: number;
  max: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
  commitOnBlur?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={styles.quantity}>
      <label htmlFor={id}>Quantité</label>
      <div>
        <button
          type="button"
          disabled={disabled || quantity <= 1}
          aria-label="Diminuer la quantité"
          onClick={() => onChange(normalizeQuantity(quantity - 1, max))}
        >
          <Minus size={15} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, max)}
          step={1}
          value={draft ?? quantity}
          disabled={disabled}
          onChange={(event) => {
            if (commitOnBlur) setDraft(event.currentTarget.value);
            else onChange(normalizeQuantity(event.currentTarget.value, max));
          }}
          onBlur={() => {
            if (draft !== null) {
              const next = normalizeQuantity(draft, max);
              setDraft(null);
              if (next !== quantity) onChange(next);
            }
          }}
          onKeyDown={(event) => {
            if (commitOnBlur && event.key === 'Enter')
              event.currentTarget.blur();
          }}
        />
        <button
          type="button"
          disabled={disabled || quantity >= max}
          aria-label="Augmenter la quantité"
          onClick={() => onChange(normalizeQuantity(quantity + 1, max))}
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
