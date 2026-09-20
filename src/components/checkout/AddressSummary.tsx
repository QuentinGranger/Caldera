import type { AddressValues, CountryView } from '@/lib/checkout/types';
import styles from './Checkout.module.scss';
export function AddressSummary({
  address,
  countries,
}: {
  address: AddressValues;
  countries: CountryView[];
}) {
  return (
    <address className={styles.address}>
      <span>
        {address.firstName} {address.lastName}
      </span>
      {address.company && <span>{address.company}</span>}
      <span>{address.addressLine1}</span>
      {address.addressLine2 && <span>{address.addressLine2}</span>}
      <span>
        {address.postalCode} {address.city}
      </span>
      {address.region && <span>{address.region}</span>}
      <span>
        {countries.find((country) => country.code === address.countryCode)
          ?.name ?? address.countryCode}
      </span>
    </address>
  );
}
