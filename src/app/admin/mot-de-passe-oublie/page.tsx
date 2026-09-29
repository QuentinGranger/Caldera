import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { Field } from '@/components/admin/AdminFields';
import { currentAdmin } from '@/lib/admin/auth';
import { requestAdminPasswordResetAction } from '@/lib/admin/password-reset-actions';
import styles from '@/components/admin/Admin.module.scss';

export default async function AdminForgotPasswordPage() {
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
        <span className={styles.eyebrow}>Récupération sécurisée</span>
        <h1>Mot de passe oublié</h1>
        <p className={styles.loginIntro}>
          Indiquez l’adresse du compte administrateur. Le lien reçu sera valable
          une heure et ne fonctionnera qu’une fois.
        </p>
        <AdminForm
          action={requestAdminPasswordResetAction}
          submit="Recevoir le lien"
        >
          <div className={styles.fields}>
            <div className={styles.full}>
              <Field
                label="Email administrateur"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </div>
          </div>
        </AdminForm>
        <p>
          <Link href="/admin/login">Retour à la connexion</Link>
        </p>
      </div>
    </main>
  );
}
