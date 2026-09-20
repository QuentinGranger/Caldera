import type { AddressValues, CountryView } from '@/lib/checkout/types';
import styles from './Checkout.module.scss';
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
  const fields = [
    ['firstName', 'Prénom', 'given-name', 80, true],
    ['lastName', 'Nom', 'family-name', 80, true],
    ['company', 'Société — facultatif', 'organization', 120, false],
    ['addressLine1', 'Adresse', 'address-line1', 200, true],
    ['addressLine2', 'Complément — facultatif', 'address-line2', 200, false],
    ['postalCode', 'Code postal', 'postal-code', 16, true],
    ['city', 'Ville', 'address-level2', 120, true],
    ['region', 'Région — facultatif', 'address-level1', 120, false],
  ] as const;
  return (
    <div className={styles.fields}>
      {fields.map(([key, label, autocomplete, maxLength, required]) => {
        const id = `${prefix}.${key}`,
          error = errors[id];
        return (
          <div
            key={key}
            className={
              ['addressLine1', 'addressLine2', 'company', 'region'].includes(
                key,
              )
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
              inputMode={
                key === 'postalCode' && ['FR', 'BE'].includes(value.countryCode)
                  ? 'numeric'
                  : 'text'
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
      })}
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
          onChange={(event) =>
            onChange({ ...value, countryCode: event.target.value })
          }
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
    </div>
  );
}
