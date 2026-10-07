import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/auth';
import {
  verifyAdminBackupCodeAction,
  verifyAdminTotpAction,
} from '@/lib/admin/two-factor-actions';
import { AdminForm } from '@/components/admin/AdminForm';
import { Field } from '@/components/admin/AdminFields';
import styles from '@/components/admin/Admin.module.scss';

export default async function SecondFactorPage() {
  const admin = await currentAdmin();
  if (admin) redirect(admin.twoFactorEnabled ? '/admin' : '/admin/securite');
  return (
    <main id="contenu" className={styles.login}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>Accès équipe</span>
        <h1>Vérification de sécurité</h1>
        <p className={styles.loginIntro}>
          Saisissez le code à six chiffres de votre application
          d’authentification. La demande expire après dix minutes.
        </p>
        <AdminForm
          action={verifyAdminTotpAction}
          submit="Vérifier le code"
          pendingLabel="Vérification…"
          guard={false}
        >
          <div className={styles.fields}>
            <div className={styles.full}>
              <Field
                label="Code de l’application"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
              />
            </div>
          </div>
        </AdminForm>
        <h2>Vous n’avez plus accès à votre application ?</h2>
        <p>Utilisez un code de secours enregistré lors de l’activation.</p>
        <AdminForm
          action={verifyAdminBackupCodeAction}
          submit="Utiliser un code de secours"
          pendingLabel="Vérification…"
          guard={false}
        >
          <div className={styles.fields}>
            <div className={styles.full}>
              <Field
                label="Code de secours"
                name="code"
                type="text"
                autoComplete="off"
                minLength={8}
                maxLength={32}
                required
              />
            </div>
          </div>
        </AdminForm>
        <p>
          <Link href="/admin/login">Recommencer la connexion</Link>
        </p>
      </div>
    </main>
  );
}
