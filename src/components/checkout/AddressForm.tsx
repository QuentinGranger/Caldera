import { useEffect, useRef, useState } from 'react';
import type { AddressValues, CountryView } from '@/lib/checkout/types';
import styles from './Checkout.module.scss';

type AddressField = readonly [
  key: keyof AddressValues,
  label: string,
  autocomplete: string,
  maxLength: number,
  required: boolean,
];
const addressFields: AddressField[] = [
  ['firstName', 'Prénom', 'given-name', 80, true],
  ['lastName', 'Nom', 'family-name', 80, true],
  ['addressLine1', 'Adresse', 'address-line1', 200, true],
  ['postalCode', 'Code postal', 'postal-code', 16, true],
  ['city', 'Ville', 'address-level2', 120, true],
];
const optionalFields: AddressField[] = [
  ['company', 'Société — facultatif', 'organization', 120, false],
  ['addressLine2', 'Complément — facultatif', 'address-line2', 200, false],
];
const regionField: AddressField = [
  'region',
  'Région — facultatif',
  'address-level1',
  120,
  false,
];
const POSTAL_EXAMPLES: Record<string, string> = { FR: '75001', BE: '1000' };

export function AddressForm({
  prefix,
  value,
  countries,
  errors,
  onChange,
}: {
  prefix: 'shipping' | 'billing';
  value: AddressValues;
  countries: CountryView[];
  errors: Record<string, string>;
  onChange: (value: AddressValues) => void;
}) {
  const [hasSavedExtras] = useState(
    Boolean(value.company || value.addressLine2),
  );
  const [hasSavedRegion, setHasSavedRegion] = useState(Boolean(value.region));
  const postalExample = POSTAL_EXAMPLES[value.countryCode];
  const showRegion =
    !['FR', 'BE'].includes(value.countryCode) ||
    hasSavedRegion ||
    Boolean(errors[`${prefix}.region`]);
  const extras = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (
      extras.current &&
      (errors[`${prefix}.company`] || errors[`${prefix}.addressLine2`])
    ) {
      extras.current.open = true;
    }
  }, [errors, prefix]);

  function renderField([
    key,
    label,
    autocomplete,
    maxLength,
    required,
  ]: AddressField) {
    const id = `${prefix}.${key}`,
      error = errors[id];
    return (
      <div
        key={key}
        className={
          ['addressLine1', 'addressLine2', 'company', 'region'].includes(key)
            ? styles.full
            : undefined
        }
      >
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        <input
          id={id}
          name={id}
          type="text"
          autoComplete={`${prefix} ${autocomplete}`}
          value={value[key]}
          required={required}
          maxLength={maxLength}
          inputMode={key === 'postalCode' && postalExample ? 'numeric' : 'text'}
          placeholder={
            key === 'postalCode'
              ? POSTAL_EXAMPLES[value.countryCode]
              : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) =>
            onChange({ ...value, [key]: event.target.value })
          }
        />
        {error && (
          <p id={`${id}-error`} className={styles.fieldError}>
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={styles.fields}>
      <div className={styles.full}>
        <label htmlFor={`${prefix}.countryCode`}>
          Pays <span aria-hidden="true">*</span>
        </label>
        <select
          id={`${prefix}.countryCode`}
          name={`${prefix}.countryCode`}
          autoComplete={`${prefix} country`}
          required
          value={value.countryCode}
          aria-invalid={Boolean(errors[`${prefix}.countryCode`])}
          aria-describedby={
            errors[`${prefix}.countryCode`]
              ? `${prefix}.countryCode-error`
              : undefined
          }
          onChange={(event) => {
            setHasSavedRegion(false);
            onChange({ ...value, countryCode: event.target.value, region: '' });
          }}
        >
          {!countries.some((country) => country.code === value.countryCode) && (
            <option value={value.countryCode} disabled>
              Pays actuellement indisponible
            </option>
          )}
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        {errors[`${prefix}.countryCode`] && (
          <p id={`${prefix}.countryCode-error`} className={styles.fieldError}>
            {errors[`${prefix}.countryCode`]}
          </p>
        )}
      </div>
      {addressFields.map(renderField)}
      {showRegion && renderField(regionField)}
      <details
        ref={extras}
        className={styles.addressExtras}
        open={hasSavedExtras}
      >
        <summary>
          {value.company || value.addressLine2
            ? 'Société et complément d’adresse'
            : 'Ajouter une société ou un complément'}
        </summary>
        <div className={styles.fields}>{optionalFields.map(renderField)}</div>
      </details>
    </div>
  );
}
