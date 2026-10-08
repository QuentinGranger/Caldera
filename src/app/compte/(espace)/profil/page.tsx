import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, Lock, MessagesSquare } from 'lucide-react';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import {
  changePasswordAction,
  deleteAccountAction,
  updateNameAction,
} from '@/lib/account/actions';
import { requireCustomer } from '@/lib/account/guard';
import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/account/validation';
import { getPrisma } from '@/lib/db/prisma';
import { discordAccountConfigured } from '@/lib/discord/account';
import { DiscordInviteLink } from '@/components/discord/DiscordInviteLink';
import {
  connectDiscordAction,
  disconnectDiscordAction,
  retryDiscordRoleAction,
} from '@/lib/discord/actions';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Profil et sécurité' };

const discordMessages: Record<string, string> = {
  linked: 'Votre compte Discord est connecté et le rôle a été attribué.',
  unlinked: 'Votre compte Discord a été délié et le rôle retiré.',
  already_linked: 'Ce compte Discord est déjà associé à un compte Caldera.',
  not_member: 'Rejoignez d’abord le serveur Discord Caldera, puis réessayez.',
  refused: 'La connexion Discord a été annulée.',
  authorization: 'La connexion Discord a expiré ou est invalide. Réessayez.',
  session_expired: 'Votre session Caldera a expiré. Reconnectez-vous.',
  unavailable: 'Discord est momentanément indisponible. Réessayez plus tard.',
  limited: 'Trop de tentatives. Réessayez dans quelques minutes.',
};

export default async function AccountProfile({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const customer = await requireCustomer('/compte/profil');
  const [discordLink, params] = await Promise.all([
    getPrisma().customerDiscordLink.findUnique({
      where: { customerId: customer.id },
    }),
    searchParams,
  ]);
  const result = typeof params.discord === 'string' ? params.discord : '';
  const discordMessage = discordMessages[result];
  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Mon compte</p>
        <h1 className={styles.title}>Profil et sécurité</h1>
      </header>

      {discordMessage && (
        <p className={styles.notice} role="status">
          {discordMessage}
        </p>
      )}

      <section className={styles.panel} aria-labelledby="informations">
        <h2 id="informations">Informations personnelles</h2>
        <div className={styles.readonly}>
          <span className={styles.readonlyLabel}>Adresse e-mail</span>
          <span className={styles.readonlyValue}>
            <Lock size={14} aria-hidden="true" />
            {customer.email}
          </span>
          <span className={styles.hint}>
            Pour la changer, <Link href="/contact">écrivez-nous</Link> : nous
            vérifierons votre identité.
          </span>
        </div>
        <AccountForm action={updateNameAction} submit="Enregistrer" id="profil">
          <AccountField
            label="Nom"
            name="name"
            autoComplete="name"
            defaultValue={customer.name}
            maxLength={NAME_MAX}
          />
        </AccountForm>
      </section>

      <section className={styles.panel} aria-labelledby="mot-de-passe">
        <h2 id="mot-de-passe">Mot de passe</h2>
        <p className={styles.panelLead}>
          Après le changement, vos autres appareils sont déconnectés.
        </p>
        <AccountForm
          action={changePasswordAction}
          submit="Changer le mot de passe"
          resetOnSuccess
          id="securite"
        >
          <AccountField
            label="Mot de passe actuel"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
          />
          <div className={styles.pair}>
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
              hint="Le même, une seconde fois."
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
            />
          </div>
        </AccountForm>
      </section>

      <section className={styles.panel} aria-labelledby="discord">
        <h2 id="discord" className={styles.discordHeading}>
          <MessagesSquare size={24} aria-hidden="true" /> Discord
        </h2>
        <p className={styles.panelLead}>
          Rejoignez notre serveur officiel pour échanger avec la communauté. La
          liaison de votre compte Caldera reste facultative.
        </p>
        <DiscordInviteLink className={styles.secondary} />
        {discordLink ? (
          <>
            <p className={styles.panelLead}>
              Compte connecté : <strong>{discordLink.displayName}</strong>
            </p>
            {discordLink.roleGrantedAt ? (
              <p>Votre rôle « Compte Caldera lié » est actif sur le serveur.</p>
            ) : (
              <>
                <p>
                  Le rôle n’a pas encore pu être attribué. Vérifiez que vous
                  êtes membre du serveur, puis réessayez.
                </p>
                <form action={retryDiscordRoleAction}>
                  <button className={styles.submit} type="submit">
                    Réessayer l’attribution
                  </button>
                </form>
              </>
            )}
            <form action={disconnectDiscordAction}>
              <button className={styles.secondary} type="submit">
                Délier Discord
              </button>
            </form>
          </>
        ) : (
          <>
            <p>
              Reliez votre compte pour obtenir le rôle « Compte Caldera lié » si
              vous êtes membre de notre serveur Discord.
            </p>
            {discordAccountConfigured() ? (
              <form action={connectDiscordAction}>
                <button className={styles.submit} type="submit">
                  Connecter Discord
                </button>
              </form>
            ) : (
              <p className={styles.panelLead}>
                La connexion Discord sera bientôt disponible.
              </p>
            )}
          </>
        )}
      </section>

      <details className={styles.dangerZone}>
        <summary>
          Supprimer mon compte
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className={styles.dangerBody}>
          <p>
            Votre compte, votre adresse enregistrée et vos sessions sont effacés
            immédiatement et définitivement. Vos commandes restent conservées le
            temps imposé par la loi (factures), sans lien avec un compte.
          </p>
          <AccountForm
            action={deleteAccountAction}
            submit="Supprimer définitivement"
            danger
            id="suppression-compte"
          >
            <AccountField
              label="Mot de passe, pour confirmer"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
            />
          </AccountForm>
        </div>
      </details>
    </>
  );
}
