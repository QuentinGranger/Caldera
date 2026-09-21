import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCustomer } from '@/lib/auth/customer/session';
import { getCustomerAddresses } from '@/lib/customer/data';
import {
  deleteAddressAction,
  setDefaultAddressAction,
} from '@/lib/customer/actions';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Mes adresses | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default async function AddressesPage() {
  const customer = await requireCustomer();
  const addresses = await getCustomerAddresses(customer.id);
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MON COMPTE</p>
        <h1>Mes adresses</h1>
        <p>
          Enregistrez vos adresses habituelles pour accélérer vos prochaines
          commandes.
        </p>
        <div className={styles.actions}>
          <Link className={styles.button} href="/compte/adresses/nouveau">
            Ajouter une adresse
          </Link>
        </div>
      </header>
      {addresses.length ? (
        <div className={styles.addressList}>
          {addresses.map((address) => (
            <article className={styles.addressItem} key={address.id}>
              <strong>
                {address.label}{' '}
                {address.isDefaultShipping && '· Livraison par défaut'}{' '}
                {address.isDefaultBilling && '· Facturation par défaut'}
              </strong>
              <address>
                {address.firstName} {address.lastName}
                <br />
                {address.company && (
                  <>
                    {address.company}
                    <br />
                  </>
                )}
                {address.addressLine1}
                <br />
                {address.addressLine2 && (
                  <>
                    {address.addressLine2}
                    <br />
                  </>
                )}
                {address.postalCode} {address.city}
                <br />
                {address.countryCode}
              </address>
              <div className={styles.actions}>
                <Link
                  className={styles.textLink}
                  href={`/compte/adresses/${address.id}`}
                >
                  Modifier
                </Link>
                {!address.isDefaultShipping && (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={address.id} />
                    <input type="hidden" name="role" value="shipping" />
                    <button className={styles.textLink} type="submit">
                      Définir livraison
                    </button>
                  </form>
                )}
                {!address.isDefaultBilling && (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={address.id} />
                    <input type="hidden" name="role" value="billing" />
                    <button className={styles.textLink} type="submit">
                      Définir facturation
                    </button>
                  </form>
                )}
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={address.id} />
                  <button className={styles.textLink} type="submit">
                    Supprimer
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.card}>
          <h2>Votre carnet est vide</h2>
          <p>Ajoutez une adresse pour la retrouver au checkout.</p>
        </section>
      )}
    </>
  );
}
