import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Field } from '@/components/admin/AdminFields';
import { LinkTokenInput } from '@/components/auth/LinkTokenInput';
import { resetAdminPasswordAction } from '@/lib/admin/password-reset-actions';
import styles from '@/components/admin/Admin.module.scss';

export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
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
        <h1>Nouveau mot de passe</h1>
        <p className={styles.loginIntro}>
          Choisissez un nouveau mot de passe pour le back-office (12 caractères
          minimum, jamais exposé dans une fuite de données connue). Toutes les
          sessions seront fermées et un e-mail de confirmation sera envoyé.
        </p>
        <AdminForm
          action={resetAdminPasswordAction}
          submit="Enregistrer le mot de passe"
        >
          {/* The token arrives in the link fragment (#token=), read here. */}
          <LinkTokenInput
            fallback={typeof token === 'string' ? token : ''}
            className={`${styles.message} ${styles.error}`}
            missing="Ce lien est incomplet : ouvrez le lien complet reçu par e-mail, ou demandez-en un nouveau."
          />
          <div className={styles.fields}>
            <div className={styles.full}>
              <Field
                label="Nouveau mot de passe"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </div>
            <div className={styles.full}>
              <Field
                label="Confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </div>
          </div>
        </AdminForm>
        <p>
          <Link href="/admin/mot-de-passe-oublie">
            Demander un nouveau lien
          </Link>
        </p>
      </div>
    </main>
  );
}
