import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountAddressForm } from '@/components/account/AccountAddressForm';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { Container } from '@/components/ui/Container/Container';
import {
  changePasswordAction,
  deleteAccountAction,
  signOutAction,
  updateNameAction,
} from '@/lib/account/actions';
import { requireCustomer } from '@/lib/account/guard';
import {
  getCustomerAddress,
  getCustomerOrders,
  getShippingCountries,
} from '@/lib/account/queries';
import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/account/validation';
import { emptyAddress } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Mon compte' };

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: Props) {
  const customer = await requireCustomer();
  const [orders, address, countries, params] = await Promise.all([
    getCustomerOrders(customer),
    getCustomerAddress(customer.id),
    getShippingCountries(),
    searchParams,
  ]);
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        {params.bienvenue === '1' && (
          <p className={styles.notice} role="status">
            Adresse confirmée : votre compte est actif.
          </p>
        )}
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Mon compte</p>
            <h1 className={styles.title}>Bonjour {customer.name}</h1>
            <p>{customer.email}</p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className={styles.secondary}>
              Se déconnecter
            </button>
          </form>
        </div>

        <div className={styles.sections}>
          <div className={styles.column}>
            <section className={styles.section} aria-labelledby="commandes">
              <h2 id="commandes">Mes commandes</h2>
              <p>
                Les commandes passées avec ce compte ou avec l’adresse{' '}
                {customer.email}, même sans être connecté.
              </p>
              {orders.length ? (
                <ul className={styles.orders}>
                  {orders.map((order) => {
                    const content = (
                      <>
                        <strong>Commande {order.orderNumber}</strong>
                        <span className={styles.total}>
                          {formatPrice(order.total)}
                        </span>
                        <span>
                          {dateFormat.format(order.createdAt)} ·{' '}
                          {order.itemCount} article
                          {order.itemCount > 1 ? 's' : ''}
                        </span>
                        <span>
                          <span className={styles.status}>{order.label}</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={order.orderNumber}>
                        {order.href ? (
                          <Link href={order.href}>{content}</Link>
                        ) : (
                          <div className={styles.orderRow}>{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.empty}>
                  Aucune commande pour l’instant.{' '}
                  <Link href="/catalogue">Parcourir le catalogue</Link>
                </p>
              )}
            </section>

            <section className={styles.section} aria-labelledby="adresse">
              <h2 id="adresse">Adresse de livraison</h2>
              <p>Proposée automatiquement lors de votre prochaine commande.</p>
              <AccountAddressForm
                initial={address ?? emptyAddress()}
                countries={countries}
              />
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.section} aria-labelledby="informations">
              <h2 id="informations">Mes informations</h2>
              <p>
                Adresse e-mail : {customer.email}. Pour la changer, écrivez-nous
                depuis la <Link href="/contact">page contact</Link>.
              </p>
              <AccountForm
                action={updateNameAction}
                submit="Enregistrer"
                id="profil"
              >
                <AccountField
                  label="Nom"
                  name="name"
                  autoComplete="name"
                  defaultValue={customer.name}
                  maxLength={NAME_MAX}
                />
              </AccountForm>
            </section>

            <section className={styles.section} aria-labelledby="mot-de-passe">
              <h2 id="mot-de-passe">Mot de passe</h2>
              <p>Vos autres appareils seront déconnectés.</p>
              <AccountForm
                action={changePasswordAction}
                submit="Changer le mot de passe"
                id="securite"
              >
                <AccountField
                  label="Mot de passe actuel"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  maxLength={PASSWORD_MAX}
                />
                <AccountField
                  label="Nouveau mot de passe"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  hint={`${PASSWORD_MIN} caractères minimum.`}
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX}
                />
                <AccountField
                  label="Confirmation"
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX}
                />
              </AccountForm>
            </section>

            <section
              className={`${styles.section} ${styles.danger}`}
              aria-labelledby="suppression"
            >
              <h2 id="suppression">Supprimer mon compte</h2>
              <p>
                Votre compte, votre adresse enregistrée et vos sessions sont
                effacés immédiatement. Les commandes restent conservées le temps
                imposé par la loi (factures), sans lien avec un compte.
              </p>
              <AccountForm
                action={deleteAccountAction}
                submit="Supprimer définitivement"
                danger
                id="suppression-compte"
              >
                <AccountField
                  label="Mot de passe"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={PASSWORD_MAX}
                />
              </AccountForm>
            </section>
          </div>
        </div>
      </Container>
    </main>
  );
}
