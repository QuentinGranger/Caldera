import type { Metadata } from 'next';
import { AccountAddressForm } from '@/components/account/AccountAddressForm';
import { requireCustomer } from '@/lib/account/guard';
import {
  getCustomerAddress,
  getShippingCountries,
} from '@/lib/account/queries';
import { emptyAddress } from '@/lib/checkout/types';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Adresse de livraison' };

export default async function AccountAddress() {
  const customer = await requireCustomer('/compte/adresse');
  const [address, countries] = await Promise.all([
    getCustomerAddress(customer.id),
    getShippingCountries(),
  ]);
  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Mon compte</p>
        <h1 className={styles.title}>Adresse de livraison</h1>
        <p className={styles.lead}>
          Elle est proposée automatiquement lors de votre prochaine commande ;
          vous pourrez toujours la modifier au moment de commander.
        </p>
      </header>
      <section className={styles.panel} aria-label="Adresse de livraison">
        <AccountAddressForm
          initial={address ?? emptyAddress()}
          countries={countries}
        />
      </section>
    </>
  );
}
