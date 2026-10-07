import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { getCustomerAuth } from '@/lib/account/auth';
import { getPrisma } from '@/lib/db/prisma';
import {
  changeDiscordLinkedRole,
  DiscordAccountError,
  hasDiscordGuildMember,
} from './account';

const STATE_LIFETIME_MS = 10 * 60_000;

export async function discordCustomerSession() {
  try {
    const session = await getCustomerAuth().api.getSession({
      headers: await headers(),
    });
    return session
      ? { customerId: session.user.id, sessionId: session.session.id }
      : null;
  } catch {
    return null;
  }
}

function digest(state: string) {
  return createHash('sha256').update(state).digest('hex');
}

export async function createDiscordOAuthState(sessionId: string) {
  const state = randomBytes(32).toString('hex');
  await getPrisma().discordOAuthState.upsert({
    where: { sessionId },
    create: {
      sessionId,
      stateHash: digest(state),
      expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
    },
    update: {
      stateHash: digest(state),
      expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
    },
  });
  return state;
}

/** Atomic consume. A state from another session, an expired state and replay fail. */
export async function consumeDiscordOAuthState(
  state: string | null,
  sessionId: string,
) {
  if (!state || !/^[a-f0-9]{64}$/.test(state)) return false;
  const deleted = await getPrisma().discordOAuthState.deleteMany({
    where: {
      stateHash: digest(state),
      sessionId,
      expiresAt: { gt: new Date() },
    },
  });
  return deleted.count === 1;
}

export type LinkResult =
  'linked' | 'already_linked' | 'not_member' | 'unavailable';

export async function linkDiscordAccount(
  customerId: string,
  identity: { id: string; displayName: string },
): Promise<LinkResult> {
  try {
    if (!(await hasDiscordGuildMember(identity.id))) return 'not_member';
  } catch {
    return 'unavailable';
  }

  try {
    await getPrisma().customerDiscordLink.create({
      data: {
        customerId,
        discordUserId: identity.id,
        displayName: identity.displayName,
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    )
      return 'already_linked';
    return 'unavailable';
  }

  // The row remains with roleGrantedAt=null on an API failure, allowing the
  // owner to retry. Never report a successful role grant before Discord's 204.
  try {
    await changeDiscordLinkedRole(identity.id, true);
    await getPrisma().customerDiscordLink.update({
      where: { customerId },
      data: { roleGrantedAt: new Date() },
    });
    return 'linked';
  } catch {
    return 'unavailable';
  }
}

export async function synchronizeDiscordLinkedRole(customerId: string) {
  const link = await getPrisma().customerDiscordLink.findUnique({
    where: { customerId },
  });
  if (!link) return 'not_linked' as const;
  try {
    if (!(await hasDiscordGuildMember(link.discordUserId)))
      return 'not_member' as const;
    await changeDiscordLinkedRole(link.discordUserId, true);
    await getPrisma().customerDiscordLink.update({
      where: { customerId },
      data: { roleGrantedAt: new Date() },
    });
    return 'linked' as const;
  } catch {
    return 'unavailable' as const;
  }
}

export async function unlinkDiscordAccount(customerId: string) {
  const link = await getPrisma().customerDiscordLink.findUnique({
    where: { customerId },
  });
  if (!link) return 'not_linked' as const;
  try {
    await changeDiscordLinkedRole(link.discordUserId, false);
  } catch (error) {
    if (error instanceof DiscordAccountError) return 'unavailable' as const;
    return 'unavailable' as const;
  }
  try {
    await getPrisma().customerDiscordLink.delete({
      where: { customerId },
    });
    return 'unlinked' as const;
  } catch {
    return 'unavailable' as const;
  }
}
