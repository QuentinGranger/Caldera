import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminMfaSetup } from '@/components/admin/AdminMfaSetup';
import styles from '@/components/admin/Admin.module.scss';

export default async function AdminSecurityPage() {
  const admin = await requireAdmin({ allowMfaEnrollment: true });
  return (
    <main id="contenu" className={styles.login}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>Sécurité du compte</span>
        <h1>Double authentification</h1>
        <p className={styles.loginIntro}>
          {admin.twoFactorEnabled
            ? 'Votre compte est protégé par une application d’authentification.'
            : 'Configurez une application d’authentification pour accéder à l’administration.'}
        </p>
        <AdminMfaSetup enabled={admin.twoFactorEnabled} />
        {admin.twoFactorEnabled && (
          <p>
            <Link href="/admin">Retour à l’administration</Link>
          </p>
        )}
      </div>
    </main>
  );
}
