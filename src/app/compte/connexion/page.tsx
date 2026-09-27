import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { AccountShell } from '@/components/account/AccountShell';
import { signInAction } from '@/lib/account/actions';
import { currentCustomer } from '@/lib/account/auth';
import { PASSWORD_MAX, safeReturnPath } from '@/lib/account/validation';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Connexion' };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const destination = safeReturnPath(params.retour);
  if (await currentCustomer()) redirect(destination);
  const notice =
    params['mot-de-passe'] === 'modifie'
      ? 'Mot de passe modifié : connectez-vous avec le nouveau.'
      : null;
  return (
    <AccountShell
      title="Connexion"
      lead="Retrouvez vos commandes et votre adresse de livraison."
      notice={notice}
    >
      <div className={styles.card}>
        <AccountForm action={signInAction} submit="Se connecter">
          <input type="hidden" name="retour" value={destination} />
          <AccountField
            label="Adresse e-mail"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
          />
          <AccountField
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
          />
        </AccountForm>
      </div>
      <div className={styles.links}>
        <Link href="/compte/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        <Link href="/compte/inscription">Créer un compte</Link>
      </div>
    </AccountShell>
  );
}
