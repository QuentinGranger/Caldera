import Link from 'next/link';
import { AdminLogo } from '@/components/admin/AdminLogo';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/auth';
import { loginAction } from '@/lib/admin/actions';
import { AdminForm } from '@/components/admin/AdminForm';
import { Field } from '@/components/admin/AdminFields';
import styles from '@/components/admin/Admin.module.scss';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await currentAdmin()) redirect('/admin');
  const params = await searchParams;
  return (
    <main id="contenu" className={styles.login}>
      <div className={styles.brand}>
        <AdminLogo />
      </div>
      <div className={styles.card}>
        <span className={styles.eyebrow}>Accès équipe</span>
        <h1>Administration</h1>
        <p className={styles.loginIntro}>
          Connectez-vous pour gérer les commandes, le catalogue et les stocks.
        </p>
        <AdminForm
          action={loginAction}
          submit="Se connecter"
          pendingLabel="Connexion…"
          guard={false}
        >
          <div className={styles.fields}>
            <div className={styles.full}>
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </div>
            <div className={styles.full}>
              <Field
                label="Mot de passe"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={12}
                maxLength={128}
              />
            </div>
          </div>
        </AdminForm>
        {params['mot-de-passe'] === 'modifie' && (
          <p className={styles.message} role="status">
            Mot de passe modifié. Vous pouvez maintenant vous connecter.
          </p>
        )}
        <p>
          <Link href="/admin/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>
      </div>
      <p className={styles.muted}>
        Accès réservé à l’équipe Caldera.
        <br />
        <Link href="/">Retour à la boutique</Link>
      </p>
    </main>
  );
}
