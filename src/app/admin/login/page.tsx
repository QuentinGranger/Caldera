import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/auth';
import { loginAction } from '@/lib/admin/actions';
import { AdminForm } from '@/components/admin/AdminForm';
import { Field } from '@/components/admin/AdminFields';
import styles from '@/components/admin/Admin.module.scss';
export default async function LoginPage() {
  if (await currentAdmin()) redirect('/admin');
  return (
    <main id="contenu" className={styles.login}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>
          <Gamepad2 size={28} aria-hidden="true" />
        </span>
        <span>
          <strong>CALDERA</strong>
          <small>CONTROL ROOM</small>
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.eyebrow}>Accès équipe</span>
        <h1>Administration</h1>
        <p className={styles.loginIntro}>
          Connectez-vous pour gérer les commandes, le catalogue et les stocks.
        </p>
        <AdminForm action={loginAction} submit="Se connecter">
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
      </div>
      <p className={styles.muted}>
        Accès réservé à l’équipe Caldera.
        <br />
        <Link href="/">Retour à la boutique</Link>
      </p>
    </main>
  );
}
