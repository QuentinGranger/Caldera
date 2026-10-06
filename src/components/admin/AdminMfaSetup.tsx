'use client';

import { useActionState } from 'react';
import {
  regenerateBackupCodesAction,
  replaceAuthenticatorAction,
  startMfaEnrollmentAction,
  verifyMfaEnrollmentAction,
  type EnrollmentState,
} from '@/lib/admin/two-factor-actions';
import { AdminForm } from './AdminForm';
import { Field } from './AdminFields';
import styles from './Admin.module.scss';
import mfa from './Mfa.module.scss';

const initial: EnrollmentState = { success: false, message: '' };

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <section aria-label="Codes de secours" className={mfa.codes}>
      <h2>Codes de secours</h2>
      <p>
        Chaque code fonctionne une seule fois. Enregistrez-les hors ligne, dans
        un endroit distinct de votre mot de passe. Ils ne seront plus affichés
        après avoir quitté cette page.
      </p>
      <ul>
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Enrollment() {
  const [state, action, pending] = useActionState(
    startMfaEnrollmentAction,
    initial,
  );
  let secret = '';
  if (state.totpURI) {
    try {
      secret = new URL(state.totpURI).searchParams.get('secret') ?? '';
    } catch {
      secret = '';
    }
  }
  return (
    <>
      <ol className={mfa.steps}>
        <li>Confirmez votre mot de passe.</li>
        <li>Ajoutez le compte Caldera dans votre application TOTP.</li>
        <li>
          Conservez les codes de secours, puis vérifiez un code à six chiffres.
        </li>
      </ol>
      <form action={action} aria-busy={pending}>
        <fieldset disabled={pending}>
          <Field
            label="Mot de passe actuel"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={12}
            maxLength={128}
            required
          />
          <div className={styles.actions}>
            <button type="submit">
              {pending ? 'Préparation…' : 'Configurer mon application'}
            </button>
          </div>
        </fieldset>
        {state.message && (
          <p
            role={state.success ? 'status' : 'alert'}
            className={styles.message}
          >
            {state.message}
          </p>
        )}
      </form>
      {state.totpURI && state.backupCodes && (
        <div className={mfa.enrollment}>
          <p>
            Dans votre application, choisissez « Ajouter manuellement », puis
            saisissez le nom <strong>Caldera Administration</strong> et cette
            clé :
          </p>
          <code className={mfa.secret}>{secret}</code>
          <RecoveryCodes codes={state.backupCodes} />
          <AdminForm
            action={verifyMfaEnrollmentAction}
            submit="Activer la protection"
          >
            <div className={styles.fields}>
              <div className={styles.full}>
                <Field
                  label="Code à six chiffres de l’application"
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
            <label className={mfa.confirm}>
              <input type="checkbox" name="backupSaved" required />
              J’ai enregistré mes codes de secours hors ligne.
            </label>
          </AdminForm>
        </div>
      )}
    </>
  );
}

function ManageMfa() {
  const [state, action, pending] = useActionState(
    regenerateBackupCodesAction,
    initial,
  );
  return (
    <>
      <section className={mfa.manage}>
        <h2>Renouveler les codes de secours</h2>
        <p>Les anciens codes cesseront immédiatement de fonctionner.</p>
        <form action={action} aria-busy={pending}>
          <fieldset disabled={pending}>
            <Field
              label="Mot de passe actuel"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
              required
            />
            <div className={styles.actions}>
              <button type="submit">
                {pending ? 'Renouvellement…' : 'Générer de nouveaux codes'}
              </button>
            </div>
          </fieldset>
          {state.message && (
            <p
              role={state.success ? 'status' : 'alert'}
              className={styles.message}
            >
              {state.message}
            </p>
          )}
        </form>
        {state.backupCodes && <RecoveryCodes codes={state.backupCodes} />}
      </section>
      <section className={mfa.manage}>
        <h2>Remplacer l’application</h2>
        <p>
          Si vous avez utilisé un code de secours pour vous connecter, vous
          pouvez remplacer votre application. Toutes vos sessions seront fermées
          ; à la prochaine connexion, une nouvelle configuration sera
          obligatoire.
        </p>
        <AdminForm
          action={replaceAuthenticatorAction}
          submit="Remplacer mon application"
          confirm="Votre application actuelle et vos codes de secours seront révoqués. Vous devrez vous reconnecter et configurer une nouvelle application."
        >
          <Field
            label="Mot de passe actuel"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={12}
            maxLength={128}
            required
          />
        </AdminForm>
      </section>
    </>
  );
}

export function AdminMfaSetup({ enabled }: { enabled: boolean }) {
  return enabled ? <ManageMfa /> : <Enrollment />;
}
