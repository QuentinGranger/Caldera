import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { AccountShell } from '@/components/account/AccountShell';
import { signUpAction } from '@/lib/account/actions';
import { currentCustomer } from '@/lib/account/auth';
import {
  ACCOUNT_PATH,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '@/lib/account/validation';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function SignUpPage() {
  if (await currentCustomer()) redirect(ACCOUNT_PATH);
  return (
    <AccountShell
      title="Créer un compte"
      lead="Gratuit et jamais obligatoire pour commander. Vos commandes passées avec la même adresse e-mail y seront réunies."
      tabs="inscription"
    >
      <AccountForm action={signUpAction} submit="Créer mon compte" done wide>
        <AccountField
          label="Nom"
          name="name"
          autoComplete="name"
          maxLength={NAME_MAX}
        />
        <AccountField
          label="Adresse e-mail"
          name="email"
          type="email"
          autoComplete="email"
          hint="Un lien de confirmation y sera envoyé."
          maxLength={254}
        />
        <AccountField
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`${PASSWORD_MIN} caractères minimum. Une phrase de plusieurs mots est plus sûre et plus facile à retenir.`}
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
        />
        <p className={styles.legal}>
          Vos données servent uniquement à gérer votre compte et vos commandes :{' '}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </AccountForm>
    </AccountShell>
  );
}
