'use server';
import { redirect } from 'next/navigation';
import { getPrisma } from '@/lib/db/prisma';
import { allowAccountAttempt } from '@/lib/account/limits';
import { discordAuthorizationUrl } from './account';
import {
  createDiscordOAuthState,
  discordCustomerSession,
  synchronizeDiscordLinkedRole,
  unlinkDiscordAccount,
} from './link';

const PROFILE = '/compte/profil';

export async function connectDiscordAction() {
  const session = await discordCustomerSession();
  if (!session) redirect('/compte/connexion?retour=%2Fcompte%2Fprofil');
  if (!(await allowAccountAttempt('discord-connect', session.customerId)))
    redirect(`${PROFILE}?discord=limited`);
  let existing: boolean;
  let destination: string | null = null;
  try {
    existing = !!(await getPrisma().customerDiscordLink.findUnique({
      where: { customerId: session.customerId },
    }));
    if (!existing) {
      const state = await createDiscordOAuthState(session.sessionId);
      destination = discordAuthorizationUrl(state);
    }
  } catch {
    redirect(`${PROFILE}?discord=unavailable`);
  }
  if (existing) redirect(`${PROFILE}?discord=already_linked`);
  if (!destination) redirect(`${PROFILE}?discord=unavailable`);
  redirect(destination);
}

export async function disconnectDiscordAction() {
  const session = await discordCustomerSession();
  if (!session) redirect('/compte/connexion?retour=%2Fcompte%2Fprofil');
  if (!(await allowAccountAttempt('discord-disconnect', session.customerId)))
    redirect(`${PROFILE}?discord=limited`);
  const result = await unlinkDiscordAccount(session.customerId);
  redirect(`${PROFILE}?discord=${result}`);
}

export async function retryDiscordRoleAction() {
  const session = await discordCustomerSession();
  if (!session) redirect('/compte/connexion?retour=%2Fcompte%2Fprofil');
  if (!(await allowAccountAttempt('discord-role', session.customerId)))
    redirect(`${PROFILE}?discord=limited`);
  const result = await synchronizeDiscordLinkedRole(session.customerId);
  redirect(`${PROFILE}?discord=${result}`);
}
